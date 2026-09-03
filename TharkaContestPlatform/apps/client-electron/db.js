const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// Local mirror of the server's contest data (kept current by main.js's sync
// logic) plus a small settings table - this is what makes the app usable
// between LAN syncs, when the server isn't reachable. Identity, editor
// preferences, and local submission history stay in the renderer's
// localStorage (already durable enough for this - see client-web's
// identity.ts / localSubmissions.ts), so this file only needs the pieces
// that must survive a full page reload / app restart from the main process.
//
// Plain JSON file, not a real SQLite database: this app's actual query
// needs are "replace the whole contest list on sync" and "look up one
// contest/problem by id" - no joins, no indexes needed. better-sqlite3 was
// the original plan, but it's a native module and this machine has no
// working Python/MSVC toolchain to compile it against Electron's Node ABI
// (and installing a full build toolchain just for this is a heavy, risky
// system change for no functional benefit here). A JSON file gets the same
// durability with zero native-compile risk.
let cache = null;

function filePath() {
  return path.join(app.getPath("userData"), "contest-store.json");
}

function defaultStore() {
  return { settings: {}, syncState: { version: 0, lastSyncedAt: null }, contests: {}, pendingSubmissions: [] };
}

function load() {
  if (cache) return cache;
  try {
    // Strip a leading UTF-8 BOM if present (e.g. a hand-edited file saved by
    // an editor/tool that adds one) - JSON.parse rejects it outright
    // otherwise, and that failure would silently look like "no data yet".
    const raw = fs.readFileSync(filePath(), "utf8").replace(/^﻿/, "");
    cache = JSON.parse(raw);
    // Back-fill fields added after this store file may have been written.
    if (!cache.pendingSubmissions) cache.pendingSubmissions = [];
  } catch {
    cache = defaultStore();
  }
  return cache;
}

function persist() {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(cache), "utf8");
}

function getSetting(key, fallback = null) {
  const store = load();
  return key in store.settings ? store.settings[key] : fallback;
}

function setSetting(key, value) {
  const store = load();
  store.settings[key] = value;
  persist();
}

function getLocalVersion() {
  return load().syncState;
}

// Full replace, not incremental diff - deliberately simple, matches the
// server's own "Sync always sends the whole dataset" design (see plan).
// `snapshot.contests` is the populated array from GET /api/sync/full - each
// contest carries its own `problems` array, stored inline.
function replaceContestData(snapshot) {
  const store = load();
  store.contests = {};
  for (const contest of snapshot.contests) {
    store.contests[contest._id] = contest;
  }
  store.syncState = { version: snapshot.version, lastSyncedAt: new Date().toISOString() };
  persist();
}

function listContests() {
  return Object.values(load().contests).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
}

function getContestById(id) {
  return load().contests[id] || null;
}

function getContestProblemById(problemId) {
  for (const contest of Object.values(load().contests)) {
    const found = (contest.problems || []).find((p) => p.id === Number(problemId));
    if (found) return found;
  }
  return null;
}

// --- Pending submissions -------------------------------------------------
// A submission that was judged locally (offline-capable) but couldn't be
// pushed to the server right away (no network at the time) is queued here
// instead of being silently dropped. Flushed by main.js whenever
// connectivity comes back - on sync (admin-triggered push or app-open
// staleness check) and on socket reconnect - so it eventually reaches the
// server and can count toward the leaderboard, without the student having
// to do anything.

function queuePendingSubmission(payload) {
  const store = load();
  store.pendingSubmissions.push(payload);
  persist();
}

function listPendingSubmissions() {
  return load().pendingSubmissions;
}

// Removes queued submissions whose localId is in `localIds` (successfully
// synced) - whatever's left stays queued for the next attempt.
function removePendingSubmissions(localIds) {
  const store = load();
  const ids = new Set(localIds);
  store.pendingSubmissions = store.pendingSubmissions.filter((s) => !ids.has(s.localId));
  persist();
}

module.exports = {
  getSetting,
  setSetting,
  getLocalVersion,
  replaceContestData,
  listContests,
  getContestById,
  getContestProblemById,
  queuePendingSubmission,
  listPendingSubmissions,
  removePendingSubmissions,
};
