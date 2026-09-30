// Runs on a codeforces.com problem page when the bookmarklet is clicked.
// Extracts the same fields the AI prompt expects and copies them to the
// clipboard as one plain-text block, formatted so pasting it straight into
// the textarea (or via the "Paste from clipboard" button) just works.
const BOOKMARKLET_SOURCE = `(function(){
  var s = document.querySelector('.problem-statement');
  if (!s) { alert('No problem statement found on this page.'); return; }
  function preToText(pre) {
    var divs = pre.querySelectorAll(':scope > div');
    if (divs.length) return Array.prototype.map.call(divs, function (d) { return d.textContent; }).join('\\n');
    return pre.innerHTML.replace(/<br\\s*\\/?>/gi, '\\n').replace(/<[^>]+>/g, '');
  }
  function sectionText(el) {
    if (!el) return '';
    var clone = el.cloneNode(true);
    var title = clone.querySelector('.section-title, .property-title');
    if (title) title.remove();
    return clone.textContent.trim();
  }
  var sourceUrl = location.href;
  var rawTitle = (s.querySelector('.header .title') || {}).textContent || '';
  var title = rawTitle.replace(/^[A-Za-z0-9]+\\.\\s*/, '').trim();
  var tl = (s.querySelector('.header .time-limit') || {}).textContent || '';
  var ml = (s.querySelector('.header .memory-limit') || {}).textContent || '';
  var bodyParts = [];
  Array.prototype.forEach.call(s.children, function (el) {
    if (el.classList.contains('header')) return;
    if (el.matches('.input-specification,.output-specification,.sample-tests,.note')) return;
    var t = el.textContent.trim();
    if (t) bodyParts.push(t);
  });
  var inputFormat = sectionText(s.querySelector('.input-specification'));
  var outputFormat = sectionText(s.querySelector('.output-specification'));
  var note = sectionText(s.querySelector('.note'));
  var inputs = s.querySelectorAll('.sample-tests .input pre');
  var outputs = s.querySelectorAll('.sample-tests .output pre');
  var examples = '';
  for (var i = 0; i < inputs.length; i++) {
    examples += 'Example ' + (i + 1) + '\\nInput\\n' + preToText(inputs[i]) + '\\nOutput\\n' + preToText(outputs[i]) + '\\n\\n';
  }
  var text = 'Source: ' + sourceUrl + '\\n' + title + '\\n\\n' + bodyParts.join('\\n\\n') +
    '\\n\\nInput\\n' + inputFormat + '\\n\\nOutput\\n' + outputFormat +
    (note ? ('\\n\\nNote\\n' + note) : '') + '\\n\\n' + examples +
    (tl ? ('\\n' + tl) : '') + (ml ? ('\\n' + ml) : '');
  navigator.clipboard.writeText(text.trim()).then(function () {
    alert('Copied "' + title + '" \u2014 switch to CF Importer and click "Paste from clipboard".');
  }, function (err) {
    alert('Copy failed: ' + err.message);
  });
})();`;

const els = {
  refs: document.getElementById("refs"),
  pasteBtn: document.getElementById("pasteBtn"),
  bookmarklet: document.getElementById("bookmarklet"),
  provider: document.getElementById("provider"),
  baseUrlField: document.getElementById("baseUrlField"),
  baseUrl: document.getElementById("baseUrl"),
  model: document.getElementById("model"),
  apiKey: document.getElementById("apiKey"),
  generateHidden: document.getElementById("generateHidden"),
  providerHint: document.getElementById("providerHint"),
  convertBtn: document.getElementById("convertBtn"),
  convertStatus: document.getElementById("convertStatus"),
  resultsSection: document.getElementById("resultsSection"),
  results: document.getElementById("results"),
  copyAllBtn: document.getElementById("copyAllBtn"),
  sendSection: document.getElementById("sendSection"),
  contestSelect: document.getElementById("contestSelect"),
  refreshContestsBtn: document.getElementById("refreshContestsBtn"),
  sendBtn: document.getElementById("sendBtn"),
  sendResult: document.getElementById("sendResult"),
};

const PROVIDER_INFO = {
  omniroute: {
    baseUrl: "http://localhost:20128/v1",
    baseUrlEditable: true,
    modelPlaceholder: "whatever model id you have configured in OmniRoute",
    hint: "Grab the API key from the OmniRoute dashboard (usually http://localhost:20128) — Settings → API Keys.",
  },
  anthropic: {
    baseUrl: "",
    baseUrlEditable: false,
    modelPlaceholder: "claude-sonnet-5",
    hint: "API key from console.anthropic.com.",
  },
  openrouter: {
    baseUrl: "",
    baseUrlEditable: false,
    modelPlaceholder: "e.g. anthropic/claude-sonnet-5",
    hint: "API key from openrouter.ai/keys. Model must be an OpenRouter model id (provider/model).",
  },
  gemini: {
    baseUrl: "",
    baseUrlEditable: false,
    modelPlaceholder: "e.g. gemini-2.5-flash",
    hint: "API key from aistudio.google.com/apikey.",
  },
};

const STORAGE_KEY = "cf_importer_settings";
let lastResults = [];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.provider) els.provider.value = saved.provider;
    if (saved.baseUrl) els.baseUrl.value = saved.baseUrl;
    if (saved.model) els.model.value = saved.model;
    if (saved.apiKey) els.apiKey.value = saved.apiKey;
    if (saved.generateHidden) els.generateHidden.checked = true;
  } catch {}
  applyProviderInfo();
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      provider: els.provider.value,
      baseUrl: els.baseUrl.value,
      model: els.model.value,
      apiKey: els.apiKey.value,
      generateHidden: els.generateHidden.checked,
    })
  );
}

function applyProviderInfo() {
  const info = PROVIDER_INFO[els.provider.value];
  els.baseUrlField.hidden = !info.baseUrlEditable;
  if (info.baseUrlEditable && !els.baseUrl.value) els.baseUrl.value = info.baseUrl;
  els.model.placeholder = info.modelPlaceholder;
  els.providerHint.textContent = info.hint;
}

els.provider.addEventListener("change", () => {
  applyProviderInfo();
  saveSettings();
});
[els.baseUrl, els.model, els.apiKey, els.generateHidden].forEach((el) =>
  el.addEventListener("change", saveSettings)
);

function parseBlocks() {
  return els.refs.value
    .split(/^===PROBLEM===$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderResults(results) {
  lastResults = results;
  els.resultsSection.hidden = false;
  els.results.innerHTML = "";
  results.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "problem-card";
    if (r.ok) {
      card.innerHTML = `
        <div class="title-row">
          <span class="name">${escapeHtml(r.problem.title)}</span>
          <span class="badge ok">ok</span>
        </div>
        <textarea readonly>${escapeHtml(JSON.stringify(r.problem, null, 2))}</textarea>
        <button class="secondary copy-one" data-i="${i}" type="button">Copy this problem's JSON</button>
      `;
    } else {
      card.innerHTML = `
        <div class="title-row">
          <span class="name">${escapeHtml(r.ref)}</span>
          <span class="badge err">error</span>
        </div>
        <p class="error-text">${escapeHtml(r.error)}</p>
      `;
    }
    els.results.appendChild(card);
  });

  els.results.querySelectorAll(".copy-one").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = lastResults[Number(btn.dataset.i)];
      navigator.clipboard.writeText(JSON.stringify(r.problem, null, 2));
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy this problem's JSON"), 1200);
    });
  });

  els.sendSection.hidden = !results.some((r) => r.ok);
  if (!els.sendSection.hidden && els.contestSelect.options.length === 0) {
    loadContests();
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

els.convertBtn.addEventListener("click", async () => {
  const blocks = parseBlocks();
  if (blocks.length === 0) {
    els.convertStatus.textContent = "Paste at least one problem's text first.";
    return;
  }
  const provider = els.provider.value;
  const apiKey = els.apiKey.value.trim();
  const model = els.model.value.trim();
  const baseUrl = els.baseUrl.value.trim();
  if (!apiKey || !model) {
    els.convertStatus.textContent = "API key and model are both required.";
    return;
  }

  els.convertBtn.disabled = true;
  els.convertStatus.textContent = `Converting ${blocks.length} problem(s)...`;
  try {
    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks,
        provider,
        apiKey,
        model,
        baseUrl,
        generateHidden: els.generateHidden.checked,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || "Request failed");
    renderResults(data.results);
    const okCount = data.results.filter((r) => r.ok).length;
    els.convertStatus.textContent = `Done — ${okCount}/${data.results.length} succeeded.`;
  } catch (err) {
    els.convertStatus.textContent = `Error: ${err.message}`;
  } finally {
    els.convertBtn.disabled = false;
  }
});

els.copyAllBtn.addEventListener("click", () => {
  const problems = lastResults.filter((r) => r.ok).map((r) => r.problem);
  navigator.clipboard.writeText(JSON.stringify(problems, null, 2));
  els.copyAllBtn.textContent = "Copied!";
  setTimeout(() => (els.copyAllBtn.textContent = "Copy all as JSON array"), 1200);
});

async function loadContests() {
  els.contestSelect.innerHTML = `<option>Loading...</option>`;
  try {
    const res = await fetch("/api/contests");
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || "Request failed");
    els.contestSelect.innerHTML = data
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.id})</option>`)
      .join("");
  } catch (err) {
    els.contestSelect.innerHTML = `<option value="">(could not load: ${escapeHtml(err.message)})</option>`;
  }
}

els.refreshContestsBtn.addEventListener("click", loadContests);

els.sendBtn.addEventListener("click", async () => {
  const contestId = els.contestSelect.value;
  const problems = lastResults.filter((r) => r.ok).map((r) => r.problem);
  if (!contestId) {
    els.sendResult.innerHTML = `<p class="error-text">Pick a contest first.</p>`;
    return;
  }
  if (problems.length === 0) {
    els.sendResult.innerHTML = `<p class="error-text">No successfully converted problems to send.</p>`;
    return;
  }
  els.sendBtn.disabled = true;
  try {
    const res = await fetch("/api/send-to-contest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contestId, problems }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || "Request failed");
    els.sendResult.innerHTML = data.results
      .map((r) => `<div class="row-item"><span>${escapeHtml(r.title || r.id)}</span><span>${escapeHtml(r.status)}</span></div>`)
      .join("");
  } catch (err) {
    els.sendResult.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  } finally {
    els.sendBtn.disabled = false;
  }
});

els.bookmarklet.href = "javascript:" + encodeURIComponent(BOOKMARKLET_SOURCE);

els.pasteBtn.addEventListener("click", async () => {
  try {
    const clip = (await navigator.clipboard.readText()).trim();
    if (!clip) return;
    const current = els.refs.value.trim();
    els.refs.value = current ? `${current}\n\n===PROBLEM===\n${clip}` : clip;
  } catch (err) {
    alert(`Could not read clipboard: ${err.message}`);
  }
});

loadSettings();
