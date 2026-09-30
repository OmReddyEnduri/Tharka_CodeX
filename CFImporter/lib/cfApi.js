// Codeforces' public API (unlike the main site) isn't behind the
// Cloudflare challenge, and problemset.problems needs no auth - it just
// never returns statement/sample/test data (metadata only: name, rating,
// tags). That's exactly the piece the pasted-text flow can't reliably get
// (rating isn't always visible on the page), so we use it purely to
// improve the AI's category/difficulty guess, never to fetch problem text.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let cache = null; // Map<"contestId index", {rating, tags}>
let cacheAt = 0;
const CACHE_MS = 60 * 60 * 1000;

async function loadIndex() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;

  const res = await fetch("https://codeforces.com/api/problemset.problems", {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Codeforces API returned ${res.status}`);
  const data = await res.json();
  if (data.status !== "OK") throw new Error(data.comment || "Codeforces API call failed");

  const map = new Map();
  for (const p of data.result.problems) {
    map.set(`${p.contestId} ${p.index}`, { rating: p.rating || null, tags: p.tags || [] });
  }
  cache = map;
  cacheAt = Date.now();
  return cache;
}

// contestId/index as they'd appear in a CF URL, e.g. (1900, "F").
async function lookupMeta(contestId, index) {
  try {
    const map = await loadIndex();
    return map.get(`${contestId} ${index}`) || null;
  } catch {
    return null; // best-effort only - never block conversion on this
  }
}

module.exports = { lookupMeta };
