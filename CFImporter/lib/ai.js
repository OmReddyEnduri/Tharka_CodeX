// Provider-agnostic full-extraction call. Codeforces sits behind a
// Cloudflare bot-challenge now, so server-side scraping isn't viable - the
// user pastes the real problem text themselves (copied from their own
// browser, which loads fine since they're a real visitor), and the AI's job
// is the same "convert to bulk-import JSON" task the project's existing
// prompts/bulk-problems-prompt.md already documents for manual use, just
// automated here. sampleTestCases must be transcribed EXACTLY from the
// pasted text - the AI never invents those, only classifies/formats around
// them and (only if asked) adds separately-flagged hidden cases.

const OMNIROUTE_DEFAULT_BASE_URL = "http://localhost:20128/v1";

function buildPrompt(rawText, generateHidden, meta) {
  const system = `You convert a pasted Codeforces problem statement into a single JSON object for import into a school contest platform.

Respond with ONLY a single JSON object (no markdown fences, no commentary), shaped exactly like this:
{
  "title": "string - the problem's title, without any leading index like \\"A.\\"",
  "description": "string - the full problem statement, rewritten cleanly in Markdown (keep all math/constraints, use **bold**/code fences where helpful)",
  "category": "string - e.g. Arrays, DP, Graphs, Math, Strings, Greedy, Number Theory, Data Structures, General",
  "difficulty": "Easy" | "Medium" | "Hard",
  "constraints": "string - the input constraints, e.g. \\"1 <= n <= 10^5\\" (empty string if none stated)",
  "inputFormat": "string - short label, default \\"Standard Input\\" if nothing more specific is stated",
  "outputFormat": "string - short label, default \\"Standard Output\\" if nothing more specific is stated",
  "timeLimitMs": number (default 1000 if not stated),
  "memoryLimitMb": number (default 256 if not stated),
  "sampleTestCases": [{ "input": "string", "output": "string" }],
  "hiddenTestCases": [{ "input": "string", "output": "string" }]
}

Rules:
- sampleTestCases: transcribe the example input/output blocks from the pasted text EXACTLY, character for character (preserve line breaks as \\n) - never alter, "clean up", or invent one. If the pasted text has no examples, use an empty array.
- difficulty: if a Codeforces rating is stated or implied, use <=1200 Easy, 1300-2000 Medium, >2000 Hard as a guide, but override it if the statement itself clearly disagrees.
- hiddenTestCases: ${generateHidden
    ? "you MUST work out correct input/output pairs yourself by actually solving the problem correctly - never fabricate a plausible-looking but wrong output. Aim for 2-4 cases that cover edge cases (min/max bounds, tricky cases) not already covered by the samples. If you are not confident you can solve it correctly, return an empty array instead of guessing."
    : "always return an empty array - do not generate any, real hidden test data isn't available for this problem and guessing is not wanted right now."}`;

  const metaLine = meta
    ? `Known from the Codeforces API (use this to inform difficulty, don't restate it in the description): rating ${meta.rating ?? "unknown"}, tags: ${(meta.tags || []).join(", ") || "none"}\n\n`
    : "";

  const user = `${metaLine}Here is the pasted problem:\n\n${rawText}`;

  return { system, user };
}

function stripFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

async function callOpenAICompatible({ baseUrl, apiKey, model }, system, user) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic({ apiKey, model }, system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("");
}

async function callGemini({ apiKey, model }, system, user) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
}

async function extractProblem({ provider, apiKey, baseUrl, model }, rawText, generateHidden, meta) {
  const { system, user } = buildPrompt(rawText, generateHidden, meta);
  let raw;

  if (provider === "omniroute") {
    raw = await callOpenAICompatible({ baseUrl: baseUrl || OMNIROUTE_DEFAULT_BASE_URL, apiKey, model }, system, user);
  } else if (provider === "openrouter") {
    raw = await callOpenAICompatible({ baseUrl: "https://openrouter.ai/api/v1", apiKey, model }, system, user);
  } else if (provider === "anthropic") {
    raw = await callAnthropic({ apiKey, model }, system, user);
  } else if (provider === "gemini") {
    raw = await callGemini({ apiKey, model }, system, user);
  } else {
    throw new Error(`Unknown provider "${provider}"`);
  }

  let parsed;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    throw new Error(`AI did not return valid JSON: ${err.message}\n---\n${raw.slice(0, 800)}`);
  }
  return parsed;
}

module.exports = { extractProblem, OMNIROUTE_DEFAULT_BASE_URL };
