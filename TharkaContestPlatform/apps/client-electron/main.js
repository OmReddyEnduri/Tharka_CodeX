const path = require("path");
const fs = require("fs");
const http = require("http");
const { app, BrowserWindow, dialog, ipcMain, Menu, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
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

// Must exactly match the server's SYNC_DEVICE_TOKEN (apps/server/.env) - see
// apps/server/lib/syncAuth.js for why GET /api/sync/full needs this. Not a
// secret worth protecting much harder than this: it's baked into every
// installed copy of this app the same way DEFAULT_SERVER_URL is, so it only
// ever raises the bar from "anyone who knows the URL" to "anyone who
// extracts this string from the packaged app" - same tradeoff as the
// server's own admin token.
const SYNC_DEVICE_TOKEN = "388f9ae71491781926fc53ae7e6b3786321b6d6875645b40";

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
      // Stripping the app menu already removes the usual DevTools shortcuts,
      // but this closes the question outright rather than relying on that.
      // Matters because save-file's IPC handler (below) trusts whatever
      // path it's handed on the assumption that only this app itself ever
      // supplies one - true only as long as DevTools stays unreachable.
      devTools: false,
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
  const res = await fetch(`${getServerUrl()}/api/sync/full`, {
    headers: { "x-contest-sync-token": SYNC_DEVICE_TOKEN },
  });
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
    const { version, serverTime } = await res.json();
    if (serverTime) db.setSetting("clockOffsetMs", new Date(serverTime).getTime() - Date.now());
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

// Whether hidden testcase I/O should still be redacted (the "answer key")
// must never be decided from this laptop's own clock - a student could just
// set it forward past the contest's endTime to unlock it early. Ask the
// server what time it actually is (a fast, tiny request) and use that;
// only if the server is genuinely unreachable right now do we fall back to
// this laptop's clock adjusted by the offset last observed during a real
// sync (still far harder to spoof than the raw local clock, since that
// offset was captured from the server, not typed in by the student).
async function getAuthoritativeNow() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${getServerUrl()}/api/sync/version`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const { serverTime } = await res.json();
      if (serverTime) return new Date(serverTime);
    }
  } catch {
    // offline or server unreachable right now - fall through to the cached offset
  }
  const offsetMs = db.getSetting("clockOffsetMs", 0);
  return new Date(Date.now() + offsetMs);
}

// --- Auto-update (packaged builds only, published to GitHub Releases) -----
// electron-builder's `publish` config (package.json) points at the GitHub
// repo; electron-updater checks that repo's latest Release for a newer
// version than app.getVersion() and, if found, downloads it in the
// background automatically. Installing it (which force-closes and restarts
// the app) is held back until no contest is currently live - every lab
// laptop updating at once would otherwise cut off any student mid-contest.
let updateReadyVersion = null; // set once a downloaded update is waiting on a safe moment to install

async function isAnyContestLive() {
  const now = await getAuthoritativeNow();
  return db.listContests().some((c) => new Date(c.startTime) <= now && now <= new Date(c.endTime));
}

async function installUpdateIfSafe() {
  if (!updateReadyVersion) return;
  if (await isAnyContestLive()) {
    console.log(`[autoUpdate] ${updateReadyVersion} ready but a contest is live - waiting`);
    return;
  }
  const version = updateReadyVersion;
  updateReadyVersion = null; // clear first so a concurrent call can't double-fire the install
  console.log(`[autoUpdate] installing ${version} now`);
  try {
    new Notification({
      title: "Tharka Codex is updating",
      body: `Restarting to install version ${version} in 15 seconds...`,
    }).show();
  } catch {
    // Notification unsupported/denied on this machine - proceed with the
    // update anyway, it's a courtesy heads-up, not a required step.
  }
  setTimeout(() => autoUpdater.quitAndInstall(), 15000);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return; // dev mode: there's no installed build for electron-updater to replace

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // we decide exactly when, via installUpdateIfSafe()

  autoUpdater.on("update-available", (info) => console.log("[autoUpdate] update available:", info.version));
  autoUpdater.on("update-not-available", () => console.log("[autoUpdate] already up to date"));
  autoUpdater.on("error", (err) => console.warn("[autoUpdate] check/download failed:", err.message));
  autoUpdater.on("update-downloaded", (info) => {
    updateReadyVersion = info.version;
    console.log(`[autoUpdate] downloaded ${info.version} - installing once no contest is live`);
    installUpdateIfSafe();
  });

  // A contest that was live when the download finished may have ended
  // since - keep checking rather than only trying once.
  setInterval(installUpdateIfSafe, 2 * 60 * 1000);
}

// Safe to call anytime (no-ops in dev mode) - both on app start and whenever
// the admin explicitly triggers a sync, so pressing "Sync" doubles as "check
// for and start rolling out a new app version" with no separate step.
function checkForAppUpdate(logPrefix) {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch((err) => console.warn(`[${logPrefix}] update check failed:`, err.message));
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
      // The admin triggering a sync is also a natural moment to check
      // whether a new app version has shipped - "push Sync" doubles as
      // "roll out the latest build" with no separate step for the admin.
      checkForAppUpdate("sync:push");
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
  return judge.run({
    sourceCode: code,
    testCases,
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    judgeSettings: db.getJudgeSettings(),
  });
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

  // Hidden test cases are the "answer key" - while the contest is still
  // running (and the admin hasn't flipped contest.settings.
  // hideHiddenTestCasesWhileLive off), strip the actual input/expected/got
  // values before this ever reaches the renderer, mirroring the server's own
  // submit-route redaction (see contestRoutes.js). `contest` here is this
  // laptop's locally-synced copy (see db.js/replaceContestData), which
  // already carries `settings` since it's just part of the Contest document
  // returned by GET /api/sync/full - so an admin toggling this in the admin
  // app takes effect on every lab PC the next time it syncs, with no
  // Electron code change needed. Defaults to hiding (`!== false`) so an
  // un-synced/older local copy without a `settings` field is still safe.
  // The UI already renders the "shown once the contest ends" placeholder
  // whenever `res.input` is undefined - no client-web/React change needed.
  const contest = db.getContestById(contestId);
  const shouldHideHiddenIO = contest?.settings?.hideHiddenTestCasesWhileLive !== false;
  const contestStillRunning = contest?.endTime && new Date(contest.endTime) > (await getAuthoritativeNow());
  if (shouldHideHiddenIO && contestStillRunning && Array.isArray(result.results)) {
    result.results = result.results.map((r) => ({ testCase: r.testCase, passed: r.passed, error: r.error }));
  }

  if (result.status !== "Error") {
    const pushedNow = await pushSubmission(contestId, problemId, code, studentName, studentRollNumber, localId, result);
    // Lets the UI tell the student "saved, will sync automatically" instead
    // of implying the server already has it - the verdict itself is still
    // fully valid either way (judged locally, not by the server).
    if (!pushedNow) result.queuedForSync = true;
  }
  return result;
});

ipcMain.handle("run-standalone", (event, { code, input }) =>
  judge.runOnce({ sourceCode: code, input, judgeSettings: db.getJudgeSettings() })
);

// --- Interactive terminal (Compiler page's "Console" tab) -----------------
// Same seam idea as everything else: without this, that tab would fall back
// to a direct socket.io connection to the server, which is exactly the
// "server isn't always running" problem this whole app exists to avoid.
// One session at a time, same as the browser/server socket implementation.
let interactiveSession = null;

ipcMain.handle("interactive-start", async (event, code) => {
  if (interactiveSession) interactiveSession.stop();
  interactiveSession = new InteractiveSession();
  const judgeSettings = db.getJudgeSettings() || {};
  await interactiveSession.start(
    code,
    {
      onStdout: (chunk) => mainWindow?.webContents.send("interactive-stdout", chunk),
      onStderr: (chunk) => mainWindow?.webContents.send("interactive-stderr", chunk),
      onExit: (info) => {
        mainWindow?.webContents.send("interactive-exit", info);
        interactiveSession = null;
      },
    },
    {
      maxSessionMs: judgeSettings.interactiveSessionMaxMs,
      maxOutputBytes: judgeSettings.maxOutputBytes,
      blockedKeywords: judgeSettings.blockedKeywords,
    }
  );
  return true;
});

ipcMain.handle("interactive-input", (event, data) => {
  interactiveSession?.write(data);
});

ipcMain.handle("interactive-stop", () => {
  interactiveSession?.stop();
  interactiveSession = null;
});

// --- Local file open/save (Compiler page's Open / Save / Ctrl+O / Ctrl+S) --
// Native OS dialogs, and a real absolute path handed back to the renderer so
// a later Ctrl+S overwrites the file the student opened instead of prompting
// again. The renderer never gets `fs` - it only round-trips the opaque path
// string we gave it. See apps/client-web/src/lib/fileIO.ts for the caller.
const SOURCE_FILE_FILTERS = [
  { name: "C++ source", extensions: ["cpp", "cc", "cxx", "c", "h", "hpp"] },
  { name: "Text", extensions: ["txt"] },
  { name: "All files", extensions: ["*"] },
];

ipcMain.handle("open-file", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Open source file",
    properties: ["openFile"],
    filters: SOURCE_FILE_FILTERS,
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  const filePath = res.filePaths[0];
  try {
    return {
      canceled: false,
      path: filePath,
      name: path.basename(filePath),
      content: fs.readFileSync(filePath, "utf8"),
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("save-file", async (event, { content, path: filePath, suggestedName }) => {
  let target = filePath;
  if (!target) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: "Save source file",
      defaultPath: suggestedName || "Main.cpp",
      filters: SOURCE_FILE_FILTERS,
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    target = res.filePath;
  }
  try {
    fs.writeFileSync(target, content, "utf8");
    return { canceled: false, path: target, name: path.basename(target) };
  } catch (err) {
    return { error: err.message };
  }
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
  setupAutoUpdater();
  checkForAppUpdate("app-ready");

  require("child_process").exec("g++ --version", (error) => {
    if (error) console.warn("WARNING: g++ is not installed or not in PATH. Local judging will fail.");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// The interactive terminal's child process isn't spawned detached, but that
// doesn't guarantee it dies with this app on Windows - closing the window
// mid-run used to leave a compiled student program running in the
// background on the shared lab machine for up to its own session-timeout
// ceiling (5 minutes by default).
app.on("before-quit", () => {
  interactiveSession?.stop();
  interactiveSession = null;
});
