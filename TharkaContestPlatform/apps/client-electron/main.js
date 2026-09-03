const path = require("path");
const fs = require("fs");
const http = require("http");
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { io: ioClient } = require("socket.io-client");
// Vendored locally (not a workspace/npm dependency) so electron-builder can
// bundle it without fighting npm workspace hoisting - see package.json note.
const judge = require("./judge-cpp");
const { InteractiveSession } = require("./judge-cpp/interactive");
const db = require("./db");

// Windows ties taskbar pinning, icon grouping, and jump lists to this
// per-app identity - without it a pinned shortcut can silently stop
// launching/grouping correctly. Must match `build.appId` in package.json,
// and be set before the app is ready (as early as possible).
if (process.platform === "win32") {
  app.setAppUserModelId("com.tharka.codex");
}

const DEFAULT_SERVER_URL = "http://192.168.1.101:3001";

let mainWindow = null;
let socket = null;

function getServerUrl() {
  return db.getSetting("server_url", DEFAULT_SERVER_URL);
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Vite emits <script type="module"> - Chromium refuses to load ES module
// scripts from a file:// origin (CORS), which is exactly what made the
// packaged app render a blank white screen: index.html loaded fine, its
// script tag silently didn't. Serving the built site over a real (if
// loopback-only) http:// origin from inside the app sidesteps that entirely
// - this has nothing to do with the contest server's reachability.
function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(rootDir, urlPath === "/" ? "index.html" : urlPath);

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback for any client-side route.
          fs.readFile(path.join(rootDir, "index.html"), (err2, indexData) => {
            if (err2) {
              res.writeHead(404);
              res.end("Not found");
              return;
            }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(indexData);
          });
          return;
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function createWindow() {
  // No File/Edit/View/Window/Help menu bar - this is a kiosk-style lab app,
  // not a document editor, and the default menu's items (zoom, reload,
  // dev tools toggle, etc.) aren't relevant to students.
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    // Dev: point at the running Vite dev server for fast iteration.
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // Packaged: the built client-web site, copied in as an extraResource
    // (see package.json's build.extraResources), served locally (see above).
    const dir = path.join(process.resourcesPath, "client-web-dist");
    const port = await startStaticServer(dir);
    console.log("[createWindow] serving", dir, "on port", port);
    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }

  mainWindow.webContents.on("did-finish-load", () => console.log("[window] did-finish-load"));
  mainWindow.webContents.on("did-fail-load", (e, code, desc, url) => console.log("[window] did-fail-load", code, desc, url));
  mainWindow.webContents.on("console-message", (e, level, message) => console.log("[renderer console]", message));
}

// --- Sync -----------------------------------------------------------------

// Pushed to the renderer at every sync state transition so the UI can show
// something other than silence - the confusing bug report this was added
// for was a student going offline mid-sync (or before the first sync ever
// landed) with zero on-screen indication that anything was in flight, then
// finding some problems missing locally with no idea why. States:
// "syncing" (a pull is in flight), "synced" (last pull succeeded, carries
// lastSyncedAt), "offline" (last attempt failed, still on cached data).
function broadcastSyncStatus(status) {
  mainWindow?.webContents.send("sync-status", { status, ...db.getLocalVersion() });
}

async function pullFullSync() {
  const res = await fetch(`${getServerUrl()}/api/sync/full`);
  if (!res.ok) throw new Error(`sync/full failed: ${res.status}`);
  const snapshot = await res.json();
  db.replaceContestData(snapshot);
  return snapshot.version;
}

// Compares local vs server version and pulls a fresh full snapshot if
// they differ. This is the one place that decides "do we need to re-sync" -
// used both on app open and every time the socket (re)connects, so a laptop
// that missed a sync:push while offline (or was never connected when the
// admin clicked Sync) still catches up as soon as it's back on the network,
// without the admin having to remember to press Sync again. Also flushes
// any submissions queued while offline, since reaching the server at all
// means this is a real opportunity to get them recorded.
// Silently keeps working off the local cache if the server isn't reachable.
async function checkStaleAndSync(logPrefix) {
  await flushPendingSubmissions().catch((err) => console.warn(`[${logPrefix}] flush failed:`, err.message));
  try {
    const res = await fetch(`${getServerUrl()}/api/sync/version`);
    if (!res.ok) return;
    const { version } = await res.json();
    const local = db.getLocalVersion();
    console.log(`[${logPrefix}] server version=`, version, "local=", local);
    if (!local || local.version !== version) {
      broadcastSyncStatus("syncing");
      await pullFullSync();
      console.log(`[${logPrefix}] pulled full sync, new local=`, db.getLocalVersion());
      mainWindow?.webContents.send("sync-push");
      broadcastSyncStatus("synced");
    } else {
      broadcastSyncStatus("synced");
    }
  } catch (err) {
    console.warn(`[${logPrefix}] stale check failed (offline?), using cached local data:`, err.message);
    broadcastSyncStatus("offline");
  }
}

function connectSyncSocket() {
  if (socket) socket.disconnect();
  socket = ioClient(getServerUrl(), { transports: ["websocket", "polling"], reconnection: true });
  // Connectivity just came back (first connect, or a reconnect after being
  // offline) - don't just wait for the next explicit sync:push broadcast
  // (which this laptop may have missed entirely while disconnected); check
  // for and pull any fresher data right away, same as app-open does.
  socket.on("connect", () => {
    checkStaleAndSync("socket:connect");
  });
  // Socket.IO's own reconnection loop keeps retrying underneath, but this is
  // the client's first-hand signal that it's no longer talking to the
  // server right now - flip the indicator immediately instead of waiting on
  // the next stale check (which only runs on open/reconnect) to notice.
  socket.on("disconnect", () => broadcastSyncStatus("offline"));
  // The admin explicitly pressed Sync - always do a full unconditional pull,
  // never gated on a version comparison. That gate exists only to avoid
  // needless pulls on an opportunistic reconnect; an explicit sync:push is a
  // direct request from the admin and must always be honored in full,
  // whether or not this client thinks its local version already matches.
  socket.on("sync:push", async () => {
    broadcastSyncStatus("syncing");
    await flushPendingSubmissions().catch((err) => console.warn("[sync:push] flush failed:", err.message));
    try {
      await pullFullSync();
      console.log("[sync:push] pulled full sync, new local=", db.getLocalVersion());
      mainWindow?.webContents.send("sync-push");
      broadcastSyncStatus("synced");
    } catch (err) {
      console.warn("[sync:push] pull failed (offline?):", err.message);
      broadcastSyncStatus("offline");
    }
  });
}

// Runs once on app open: compare local vs server version, pull if stale.
async function staleCheckOnOpen() {
  console.log("[staleCheckOnOpen] checking against", getServerUrl());
  await checkStaleAndSync("staleCheckOnOpen");
}

// --- Local judging (via packages/judge-cpp, no network round trip) --------

async function localJudge(problemId, code, mode) {
  const problem = db.getContestProblemById(problemId);
  if (!problem) return { status: "Error", message: "This problem hasn't been synced to this laptop yet." };
  const testCases = mode === "run" ? problem.sampleTestCases : problem.hiddenTestCases;
  return judge.run({ sourceCode: code, testCases, timeLimit: problem.timeLimit, memoryLimit: problem.memoryLimit });
}

// Pushes one submission to the server for the leaderboard/admin view. On any
// failure (offline, server down, mid-request network drop) the submission is
// queued in the local store instead of dropped - flushPendingSubmissions()
// retries it later (on reconnect, or the next sync). The submission always
// lives in the renderer's local submission history either way (see
// lib/localSubmissions.ts); this only affects whether the SERVER's copy
// (leaderboard, admin view) has it yet. Returns true if it reached the
// server just now, false if it was queued for later.
async function pushSubmission(contestId, problemId, code, studentName, studentRollNumber, localId, result) {
  const payload = {
    contestId,
    localId,
    contestProblemId: Number(problemId),
    studentName,
    studentRollNumber,
    language: "cpp",
    code,
    verdict: result.status,
    testCasesPassed: result.testCasesPassed,
    totalTestCases: result.totalTestCases,
    timeTaken: result.timeTaken,
    submittedAt: new Date().toISOString(),
  };
  try {
    const res = await fetch(`${getServerUrl()}/api/contests/${contestId}/submissions/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissions: [payload] }),
    });
    if (!res.ok) throw new Error(`submissions/sync failed: ${res.status}`);
    return true;
  } catch (err) {
    console.warn("Failed to push submission to server (queued for later):", err.message);
    db.queuePendingSubmission(payload);
    return false;
  }
}

// Retries every queued submission, grouped by contest (the sync endpoint
// takes a batch). Submissions that land successfully are removed from the
// queue; anything left (still offline, or the server rejected the batch)
// stays queued for the next attempt. Called on reconnect, on receiving an
// admin-triggered sync:push, and on app-open staleness check.
async function flushPendingSubmissions() {
  const pending = db.listPendingSubmissions();
  if (pending.length === 0) return;

  const byContest = new Map();
  for (const sub of pending) {
    if (!byContest.has(sub.contestId)) byContest.set(sub.contestId, []);
    byContest.get(sub.contestId).push(sub);
  }

  for (const [contestId, submissions] of byContest) {
    try {
      const res = await fetch(`${getServerUrl()}/api/contests/${contestId}/submissions/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissions }),
      });
      if (!res.ok) throw new Error(`submissions/sync failed: ${res.status}`);
      db.removePendingSubmissions(submissions.map((s) => s.localId));
      console.log(`[flushPendingSubmissions] synced ${submissions.length} queued submission(s) for contest ${contestId}`);
    } catch (err) {
      console.warn(`Flushing queued submissions for contest ${contestId} failed (still offline?):`, err.message);
    }
  }
}

// --- IPC handlers -----------------------------------------------------

ipcMain.handle("get-server-url", () => getServerUrl());
ipcMain.handle("set-server-url", (event, url) => {
  db.setSetting("server_url", url);
  connectSyncSocket();
  return true;
});

ipcMain.handle("get-contests", () => db.listContests());
ipcMain.handle("get-contest", (event, contestId) => db.getContestById(contestId));
ipcMain.handle("get-contest-problem", (event, contestId, problemId) => db.getContestProblemById(problemId));
// The leaderboard travels down as part of the full sync snapshot (see
// server's syncRoutes.js /full) - reading it here is a local lookup, no
// network, and it only ever changes when the admin presses Sync (not a
// live poll), matching the same offline-first pattern as contests/problems.
ipcMain.handle("get-results", (event, contestId) => db.getContestById(contestId)?.results ?? null);

ipcMain.handle("run-code", (event, { problemId, code }) => localJudge(problemId, code, "run"));

ipcMain.handle("submit-code", async (event, { contestId, problemId, code, studentName, studentRollNumber, localId }) => {
  // Intentionally NOT gated on endTime - students can keep submitting after
  // the contest ends (practice/review). The server's leaderboard route
  // filters every submission by `submittedAt <= contest.endTime`
  // independently, so a late submission is recorded but can never move the
  // leaderboard, regardless of what happens here.
  const result = await localJudge(problemId, code, "submit");
  if (result.status !== "Error") {
    const pushedNow = await pushSubmission(contestId, problemId, code, studentName, studentRollNumber, localId, result);
    // Lets the UI tell the student "saved, will sync automatically" instead
    // of implying the server already has it - the verdict itself is still
    // fully valid either way (judged locally, not by the server).
    if (!pushedNow) result.queuedForSync = true;
  }
  return result;
});

ipcMain.handle("run-standalone", (event, { code, input }) => judge.runOnce({ sourceCode: code, input }));

// --- Interactive terminal (Compiler page's "Console" tab) -----------------
// Same seam idea as everything else: without this, that tab would fall back
// to a direct socket.io connection to the server, which is exactly the
// "server isn't always running" problem this whole app exists to avoid.
// One session at a time, same as the browser/server socket implementation.
let interactiveSession = null;

ipcMain.handle("interactive-start", async (event, code) => {
  if (interactiveSession) interactiveSession.stop();
  interactiveSession = new InteractiveSession();
  await interactiveSession.start(code, {
    onStdout: (chunk) => mainWindow?.webContents.send("interactive-stdout", chunk),
    onStderr: (chunk) => mainWindow?.webContents.send("interactive-stderr", chunk),
    onExit: (info) => {
      mainWindow?.webContents.send("interactive-exit", info);
      interactiveSession = null;
    },
  });
  return true;
});

ipcMain.handle("interactive-input", (event, data) => {
  interactiveSession?.write(data);
});

ipcMain.handle("interactive-stop", () => {
  interactiveSession?.stop();
  interactiveSession = null;
});

ipcMain.handle("sync-now", async () => {
  broadcastSyncStatus("syncing");
  await flushPendingSubmissions().catch((err) => console.warn("Flush during manual sync failed:", err.message));
  try {
    const version = await pullFullSync();
    broadcastSyncStatus("synced");
    return { ok: true, version };
  } catch (err) {
    broadcastSyncStatus("offline");
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-pending-submissions-count", () => db.listPendingSubmissions().length);
ipcMain.handle("get-sync-state", () => ({ ...db.getLocalVersion(), online: !!socket?.connected }));

// --- App lifecycle ------------------------------------------------------

app.whenReady().then(() => {
  console.log("[app] ready, userData =", app.getPath("userData"), "server url =", getServerUrl());
  createWindow();
  connectSyncSocket();
  staleCheckOnOpen();

  require("child_process").exec("g++ --version", (error) => {
    if (error) console.warn("WARNING: g++ is not installed or not in PATH. Local judging will fail.");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
