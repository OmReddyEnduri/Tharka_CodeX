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

// Documents, not AppData\Roaming - the whole point of this file is to be
// something a non-technical lab admin can actually find and look at, and
// AppData is hidden by default in Explorer.
function filePath() {
  return path.join(app.getPath("documents"), "Tharka Codex", "contest-store.json");
}

// Where this file used to live, before it moved to Documents. Only read
// once, to migrate an existing laptop's data on its first run after
// updating - never written to again.
function legacyFilePath() {
  return path.join(app.getPath("userData"), "contest-store.json");
}

function defaultStore() {
  return { settings: {}, syncState: { version: 0, lastSyncedAt: null }, contests: {}, pendingSubmissions: [] };
}

function load() {
  if (cache) return cache;
  const target = filePath();
  try {
    if (!fs.existsSync(target) && fs.existsSync(legacyFilePath())) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(legacyFilePath(), target);
    }
    // Strip a leading UTF-8 BOM if present (e.g. a hand-edited file saved by
    // an editor/tool that adds one) - JSON.parse rejects it outright
    // otherwise, and that failure would silently look like "no data yet".
    const raw = fs.readFileSync(target, "utf8").replace(/^﻿/, "");
    cache = JSON.parse(raw);
    // Back-fill fields added after this store file may have been written.
    if (!cache.pendingSubmissions) cache.pendingSubmissions = [];
  } catch {
    cache = defaultStore();
  }
  return cache;
}

function persist() {
  const target = filePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Write to a temp file then rename over the target, rather than
  // overwriting it in place. A crash or power loss mid-write (a real risk
  // on a lab laptop) used to leave contest-store.json truncated/invalid;
  // load()'s catch-all would then silently fall back to an empty default
  // store, wiping the local contest mirror, sync version, and any queued
  // offline submissions with nothing shown to the student. A rename is
  // atomic on the same filesystem, so the file on disk is always either the
  // old complete version or the new complete version, never a partial one.
  const tmpPath = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(cache), "utf8");
  fs.renameSync(tmpPath, target);
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
  // Validate before touching the live store. This used to do
  // `store.contests = {}` and then loop over `snapshot.contests` to refill
  // it - if the snapshot was malformed (missing/non-array `contests`, or
  // anything else in the loop threw), the in-memory store was already wiped
  // but persist() was never reached. The on-disk file stayed fine, but the
  // running app then showed zero contests for the rest of its session,
  // reported by every caller as generic "offline" with no real explanation.
  // Building the new map in a local variable first means a bad snapshot
  // throws before anything live is touched.
  if (!snapshot || !Array.isArray(snapshot.contests)) {
    throw new Error("replaceContestData: snapshot.contests must be an array");
  }

  const contests = {};
  for (const contest of snapshot.contests) {
    contests[contest._id] = contest;
  }

  const store = load();
  store.contests = contests;
  store.syncState = { version: snapshot.version, lastSyncedAt: new Date().toISOString() };
  // Judge engine config (blocklist, compile timeout, output cap, interactive
  // session cap - see server's models/JudgeSettings.js) rides along in the
  // same full-sync snapshot, so an admin's change reaches this laptop's
  // local judge on the next sync with no separate fetch.
  if (snapshot.judgeSettings) store.settings.judgeSettings = snapshot.judgeSettings;
  persist();
}

function getJudgeSettings() {
  return load().settings.judgeSettings || null;
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
  getJudgeSettings,
  listContests,
  getContestById,
  getContestProblemById,
  queuePendingSubmission,
  listPendingSubmissions,
  removePendingSubmissions,
};
