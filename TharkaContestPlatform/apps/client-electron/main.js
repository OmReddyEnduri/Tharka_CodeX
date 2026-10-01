const path = require("path");
const fs = require("fs");
const http = require("http");
const { app, BrowserWindow, dialog, ipcMain, Menu, Notification, shell } = require("electron");

// A second, plain-text copy of anything update- or crash-related, written
// straight to the Downloads folder - somewhere a student/admin will actually
// look, unlike the normal electron-log file buried in AppData\Roaming. Uses
// a synchronous append (not electron-log's async file transport) so a line
// is guaranteed to be on disk even if the process dies immediately after.
// Defined before anything else that can throw, and wired to
// uncaughtException/unhandledRejection immediately below, specifically so a
// packaged build that "just doesn't start" leaves a trace instead of dying
// silently with no console attached and nowhere for the error to go -
// previously these hooks (and every require() below) ran BEFORE this was
// set up, so a require-time failure in any of them (a missing native dep, a
// packaging issue) was completely invisible.
// Full diagnostic log (hangs, crashes, freezes, slow operations) in
// DocumentsTharkaCodexLogsdiagnostics.log - see diaglog.js. Loaded inside a
// try so a problem in the logger itself can never stop the app from starting.
let diag = { init() {}, start() {}, shutdown() {}, info() {}, warn() {}, error() {}, installIpcTiming() {}, installConsoleMirror() {}, watchWindow() {} };
try {
  diag = require("./diaglog");
  diag.init(app);
  diag.installIpcTiming(require("electron").ipcMain); // before any ipcMain.handle below
  diag.installConsoleMirror();
} catch (err) {
  console.error("diaglog failed to load:", err?.message);
}

const UPDATE_LOG_PATH = path.join(app.getPath("downloads"), "TharkaCodexUpdate.log");
function logToDownloads(line) {
  try {
    fs.appendFileSync(UPDATE_LOG_PATH, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // Downloads folder missing/unwritable on this machine - nothing more we
    // can do; this is already the last-resort log target.
  }
}
process.on("uncaughtException", (err) => {
  logToDownloads(`FATAL uncaughtException: ${err?.stack || err}`);
  diag.error(`FATAL uncaughtException: ${err?.stack || err}`);
});
process.on("unhandledRejection", (reason) => {
  logToDownloads(`FATAL unhandledRejection: ${reason?.stack || reason}`);
  diag.error(`FATAL unhandledRejection: ${reason?.stack || reason}`);
});

let log, ioClient, judge, InteractiveSession, db;
try {
  log = require("electron-log");
  ({ io: ioClient } = require("socket.io-client"));
  // Vendored locally (not a workspace/npm dependency) so electron-builder can
  // bundle it without fighting npm workspace hoisting - see package.json note.
  judge = require("./judge-cpp");
  ({ InteractiveSession } = require("./judge-cpp/interactive"));
  db = require("./db");
} catch (err) {
  logToDownloads(`FATAL: a required module failed to load at startup - the app cannot continue. ${err?.stack || err}`);
  dialog.showErrorBox(
    "Tharka Codex failed to start",
    `A required file is missing or broken:\n\n${err.message}\n\nSee ${UPDATE_LOG_PATH} for details.`
  );
  app.quit();
  process.exit(1);
}

// Also route uncaught errors through electron-log now that it's loaded, for
// anyone checking the normal log location instead of Downloads.
process.on("uncaughtException", (err) => log.error("[fatal] uncaughtException:", err));
process.on("unhandledRejection", (reason) => log.error("[fatal] unhandledRejection:", reason));

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
// Fixed, not random (`server.listen(0, ...)` used to pick a new port every
// launch). localStorage is scoped per-origin, and this server's port IS the
// app's origin (http://127.0.0.1:<port>) - a different port every launch
// meant a completely fresh, empty localStorage every single time the app
// started, silently wiping code drafts, the saved template, editor
// settings, and local submission history on every restart. Picked from the
// dynamic/private port range to make a collision with something else on the
// laptop unlikely; falls back to a random port (with a console warning)
// only if this exact one is somehow already taken, rather than failing to
// start at all.
const STATIC_SERVER_PORT = 51837;

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
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(
          `[startStaticServer] port ${STATIC_SERVER_PORT} is already in use - falling back to a random port. ` +
            "localStorage (drafts, settings, submission history) won't carry over from the last run this time."
        );
        server.listen(0, "127.0.0.1", () => resolve(server.address().port));
      } else {
        throw err;
      }
    });
    server.listen(STATIC_SERVER_PORT, "127.0.0.1", () => resolve(server.address().port));
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

  diag.watchWindow(mainWindow);
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

// Persisted to app.getPath("userData")/logs/main.log by default.
log.transports.file.level = "info";

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
  const startedAt = Date.now();
  const result = await judge.run({
    sourceCode: code,
    testCases,
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    judgeSettings: db.getJudgeSettings(),
    checker: problem.checker,
  });
  const took = Date.now() - startedAt;
  const line = `judge ${mode} problem=${problemId} verdict=${result.status} passed=${result.testCasesPassed}/${result.totalTestCases} took=${took}ms`;
  if (result.status === "Memory Limit Exceeded" || result.status === "Time Limit Exceeded" || took > 15000) diag.warn(line);
  else diag.info(line);
  return result;
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

// The local store keeps hidden test cases UNREDACTED (localJudge below needs
// the real input/expected output), but everything handed to the renderer must
// not carry them - devtools/IPC would otherwise expose the whole answer key
// even though the result UI hides it. Same rule as the server's
// stripHiddenTestCaseIO(): replace each hidden case with {} (keeps the count)
// unless the admin turned contest.settings.hideHiddenTestCasesWhileLive off.
function redactContestForRenderer(contest) {
  if (!contest) return contest;
  if (contest.settings?.hideHiddenTestCasesWhileLive === false) return contest;
  return {
    ...contest,
    problems: (contest.problems || []).map((p) =>
      p && typeof p === "object" ? { ...p, hiddenTestCases: (p.hiddenTestCases || []).map(() => ({})) } : p
    ),
  };
}

ipcMain.handle("get-contests", () => db.listContests().map(redactContestForRenderer));
ipcMain.handle("get-contest", (event, contestId) => redactContestForRenderer(db.getContestById(contestId)));
ipcMain.handle("get-contest-problem", (event, contestId, problemId) => {
  const contest = db.getContestById(contestId);
  const problem = db.getContestProblemById(problemId);
  if (!problem) return problem;
  return redactContestForRenderer({ settings: contest?.settings, problems: [problem] }).problems[0];
});
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

  // Hidden test cases are the "answer key" - unless the admin has flipped
  // contest.settings.hideHiddenTestCasesWhileLive off, strip the actual
  // input/expected/got values before this ever reaches the renderer,
  // mirroring the server's own submit-route redaction (see
  // contestRoutes.js/hiddenTestCases.js). `contest` here is this laptop's
  // locally-synced copy (see db.js/replaceContestData), which already
  // carries `settings` since it's just part of the Contest document returned
  // by GET /api/sync/full - so an admin toggling this in the admin app takes
  // effect on every lab PC the next time it syncs, with no Electron code
  // change needed. Defaults to hiding (`!== false`) so an un-synced/older
  // local copy without a `settings` field is still safe. This is controlled
  // purely by the toggle, independent of whether the contest is running or
  // has ended. The UI already renders the "hidden" placeholder whenever
  // `res.input` is undefined - no client-web/React change needed.
  const contest = db.getContestById(contestId);
  const shouldHideHiddenIO = contest?.settings?.hideHiddenTestCasesWhileLive !== false;
  if (shouldHideHiddenIO && Array.isArray(result.results)) {
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

ipcMain.handle("run-standalone", (event, { code, input, defineLocal }) =>
  judge.runOnce({ sourceCode: code, input, judgeSettings: db.getJudgeSettings(), defineLocal })
);

// --- Interactive terminal (Compiler page's "Console" tab) -----------------
// Same seam idea as everything else: without this, that tab would fall back
// to a direct socket.io connection to the server, which is exactly the
// "server isn't always running" problem this whole app exists to avoid.
// One session at a time, same as the browser/server socket implementation.
let interactiveSession = null;

ipcMain.handle("interactive-start", async (event, { code, defineLocal } = {}) => {
  if (interactiveSession) interactiveSession.stop();
  // Callbacks are tied to THIS session object. A stopped older session still
  // fires its own late 'exit'/output events; without the identity check that
  // late exit nulled out the NEW session (orphaning a running program that
  // Stop/input could no longer reach) and flipped the UI to "not running".
  const session = new InteractiveSession();
  interactiveSession = session;
  const isCurrent = () => interactiveSession === session;
  const judgeSettings = db.getJudgeSettings() || {};
  await session.start(
    code,
    {
      onStdout: (chunk) => isCurrent() && mainWindow?.webContents.send("interactive-stdout", chunk),
      onStderr: (chunk) => isCurrent() && mainWindow?.webContents.send("interactive-stderr", chunk),
      onExit: (info) => {
        if (!isCurrent()) return;
        diag.info(`interactive session ended: ${info.status}${info.code !== undefined ? " code=" + info.code : ""}`);
        mainWindow?.webContents.send("interactive-exit", info);
        interactiveSession = null;
      },
    },
    {
      maxSessionMs: judgeSettings.interactiveSessionMaxMs,
      maxOutputBytes: judgeSettings.maxOutputBytes,
      blockedKeywords: judgeSettings.blockedKeywords,
      defineLocal,
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
// Source files are small. Reading is synchronous on the main process, so a
// huge file picked via the "All files" filter (a video, a log) would freeze
// every window and eat RAM - refuse anything over 2MB instead.
const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
function readSourceFile(filePath) {
  const { size } = fs.statSync(filePath);
  if (size > MAX_SOURCE_FILE_BYTES) {
    throw new Error(`That file is too large to open in the editor (${(size / 1024 / 1024).toFixed(1)} MB, limit 2 MB).`);
  }
  return fs.readFileSync(filePath, "utf8");
}

const SOURCE_FILE_FILTERS = [
  { name: "C++ source", extensions: ["cpp", "cc", "cxx", "c", "h", "hpp"] },
  { name: "Text", extensions: ["txt"] },
  { name: "All files", extensions: ["*"] },
];
// A standing folder on the Desktop for the Compiler page's file sidebar -
// unlike open-file/save-file above (one-off native dialogs, save anywhere),
// this is the one place the sidebar always looks. Created on first access,
// not at app startup, so a laptop that never touches the Compiler page
// never gets an empty folder dropped on someone's Desktop for no reason.
function getWorkspaceDir() {
  const dir = path.join(app.getPath("desktop"), "Tharka Codex");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

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
      content: readSourceFile(filePath),
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("save-file", async (event, { content, path: filePath, suggestedName, saveAs }) => {
  let target = filePath;
  if (!target) {
    if (saveAs) {
      // Explicit "Save As" - the whole point is letting the student choose
      // a location/name, so this is the one save path that still prompts.
      const res = await dialog.showSaveDialog(mainWindow, {
        title: "Save source file",
        // Default into the workspace folder so a save-as-new-file naturally
        // lands somewhere the sidebar will show it, rather than wherever the
        // OS last remembered - the whole point of that folder is "the place
        // your files are", so a brand new file should start there too.
        defaultPath: path.join(getWorkspaceDir(), suggestedName || "Main.cpp"),
        filters: SOURCE_FILE_FILTERS,
      });
      if (res.canceled || !res.filePath) return { canceled: true };
      target = res.filePath;
    } else {
      // Plain Save on a buffer with no path yet - never prompt; just write
      // straight into the workspace folder (creating or silently overwriting
      // whatever's already there under that name), same as every later
      // Ctrl+S on this same file will do once it has a path.
      target = path.join(getWorkspaceDir(), suggestedName || "Main.cpp");
    }
  }
  try {
    fs.writeFileSync(target, content, "utf8");
    return { canceled: false, path: target, name: path.basename(target) };
  } catch (err) {
    return { error: err.message };
  }
});

// --- Workspace folder (Compiler page's left file sidebar) ------------------
// A real, navigable tree now (not just a flat file list) - Sublime-style:
// the sidebar can expand into subfolders and create new files/folders
// anywhere in it. Every entry point below takes `relPath`, a path relative
// to getWorkspaceDir() (e.g. "" for the root, "notes/todo.txt" for a nested
// file) - resolveInWorkspace() is the one place that turns that into a real
// absolute path and is also the one place that rejects anything (via ".."
// or an absolute path) that would resolve outside the workspace folder, so
// every handler below inherits that guard just by using it.

ipcMain.handle("get-workspace-dir", () => getWorkspaceDir());

function resolveInWorkspace(relPath) {
  const root = getWorkspaceDir();
  const target = path.resolve(root, String(relPath || ""));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Invalid path");
  }
  return target;
}

ipcMain.handle("list-workspace-entries", (event, relDir) => {
  try {
    const dir = resolveInWorkspace(relDir || "");
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .map((entry) => {
        const stat = fs.statSync(path.join(dir, entry.name));
        return { name: entry.name, isDirectory: entry.isDirectory(), mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));
  } catch (err) {
    return { error: err.message };
  }
});

// Opens a file by its path relative to the workspace root - no dialog, since
// the sidebar already showed the student exactly what's in there.
ipcMain.handle("open-workspace-file", (event, relPath) => {
  try {
    const filePath = resolveInWorkspace(relPath);
    return { path: filePath, name: path.basename(filePath), content: readSourceFile(filePath) };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("create-workspace-file", (event, relPath) => {
  try {
    const target = resolveInWorkspace(relPath);
    if (fs.existsSync(target)) return { error: "A file or folder with that name already exists" };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "", "utf8");
    return { name: path.basename(target) };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("create-workspace-folder", (event, relPath) => {
  try {
    const target = resolveInWorkspace(relPath);
    if (fs.existsSync(target)) return { error: "A file or folder with that name already exists" };
    fs.mkdirSync(target, { recursive: true });
    return { name: path.basename(target) };
  } catch (err) {
    return { error: err.message };
  }
});

// Drag-and-drop in the sidebar (Sublime-style: drag a file/folder onto
// another folder to move it there). `from` is the moved entry's path
// relative to the workspace root; `toDir` is the destination folder's path
// (also relative, "" for the root itself).
ipcMain.handle("move-workspace-entry", (event, { from, toDir }) => {
  try {
    const source = resolveInWorkspace(from);
    const destDir = resolveInWorkspace(toDir || "");
    const destPath = path.join(destDir, path.basename(source));
    if (destPath === source) return { error: "Already there" };
    if (fs.statSync(source).isDirectory() && (destPath === source || destPath.startsWith(source + path.sep))) {
      return { error: "Can't move a folder into itself" };
    }
    if (fs.existsSync(destPath)) return { error: "A file or folder with that name already exists there" };
    fs.renameSync(source, destPath);
    return { path: destPath, name: path.basename(destPath) };
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

ipcMain.handle("get-app-version", () => app.getVersion());

ipcMain.handle("get-sync-state", () => ({ ...db.getLocalVersion(), online: !!socket?.connected }));

// --- App lifecycle ------------------------------------------------------

app.whenReady().then(() => {
  console.log("[app] ready, userData =", app.getPath("userData"), "server url =", getServerUrl());
  logToDownloads(`App started - version ${app.getVersion()}, packaged=${app.isPackaged}`);
  diag.start({ version: app.getVersion(), serverUrl: getServerUrl() });
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

// The renderer (the actual page - the "everything goes wild and freezes"
// reports point here) or a compiled student program's own subprocess dying
// unexpectedly - neither is an uncaughtException in *this* process, so
// neither would otherwise leave any trace at all.
app.on("render-process-gone", (event, webContents, details) => {
  logToDownloads(`Renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`);
  diag.error(`app render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
  log.error("[fatal] render-process-gone:", details);
});
app.on("child-process-gone", (event, details) => {
  logToDownloads(`Child process gone: type=${details.type} reason=${details.reason}`);
  diag.error(`child-process-gone: type=${details.type} name=${details.name || ""} reason=${details.reason} exitCode=${details.exitCode}`);
  log.error("[fatal] child-process-gone:", details);
});

// The interactive terminal's child process isn't spawned detached, but that
// doesn't guarantee it dies with this app on Windows - closing the window
// mid-run used to leave a compiled student program running in the
// background on the shared lab machine for up to its own session-timeout
// ceiling (5 minutes by default).
app.on("before-quit", () => {
  diag.shutdown("before-quit");
  interactiveSession?.stop();
  interactiveSession = null;
});
