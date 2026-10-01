// Diagnostic log for "why did the app hang / stop / crash?".
//
// Written to  Documents\TharkaCodexLogs\diagnostics.log  - somewhere a person
// will actually look. Synchronous appends (a line is on disk even if the
// process dies a millisecond later), size-capped with one rotated copy, and
// every function here swallows its own errors: logging must never be the
// thing that breaks or slows the app.
//
// What it records:
//   - session start (version, OS, CPU, RAM) and whether the PREVIOUS session
//     ended cleanly. A session that vanishes with no exit line means the app
//     crashed hard, was force-killed, or the whole PC froze/restarted - the
//     gap between the last heartbeat and the next start says how long.
//   - fatal errors, renderer/GPU/child process crashes
//   - the window going unresponsive / responsive again (the visible "hang")
//   - the main process being blocked (event-loop lag), with what was running
//   - IPC calls that are slow or still running (what the app was waiting on)
//   - low system memory / runaway CPU or memory in any app process, plus the
//     top memory-hungry programs on the machine at that moment
//   - console warnings/errors from main and renderer (incl. judge notices)
//   - judge runs: verdict + duration, so a slow/stuck student program shows up
//   - a heartbeat line every minute (cheap proof of what the machine looked
//     like right before any freeze)
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const MAX_BYTES = 5 * 1024 * 1024;
const HEARTBEAT_MS = 10 * 1000; // lock-file touch + anomaly checks
const HEARTBEAT_LOG_EVERY = 6; // ...and one log line every 6th beat (1 min)
const LAG_WARN_MS = 1000; // main process blocked longer than this
const SLOW_IPC_MS = 2000;
const STUCK_IPC_MS = 10 * 1000;
const LOW_FREE_MEM_FRACTION = 0.1;
const LOW_FREE_MEM_MB = 600;
const HIGH_CPU_PERCENT = 85;
const HIGH_PROC_MEM_MB = 1500;

let app = null;
let logFile = null;
let logDir = null;
let lockFile = null;
let started = false;
let beat = 0;
let maxLagSinceBeat = 0;
let lastTopProcsAt = 0;
let highCpuStreak = {};
const inflight = new Map(); // id -> { channel, start, warnedStuck }
let nextIpcId = 1;

function ensurePaths() {
  if (logFile) return true;
  try {
    let docs;
    try {
      docs = app ? app.getPath("documents") : require("electron").app.getPath("documents");
    } catch {
      docs = path.join(os.homedir(), "Documents");
    }
    logDir = path.join(docs, "TharkaCodexLogs");
    fs.mkdirSync(logDir, { recursive: true });
    logFile = path.join(logDir, "diagnostics.log");
    lockFile = path.join(logDir, ".session.json");
    return true;
  } catch {
    return false;
  }
}

function rotateIfNeeded() {
  try {
    if (fs.statSync(logFile).size > MAX_BYTES) {
      fs.renameSync(logFile, path.join(logDir, "diagnostics.old.log"));
    }
  } catch {
    /* no file yet, or rotate raced - fine */
  }
}

// Local wall-clock time with UTC offset, e.g. 2026-10-01 10:12:03 +05:30 - easier to match against "it froze at about 10:12" than UTC.
function localStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

function write(level, msg) {
  try {
    if (!ensurePaths()) return;
    const isNew = !fs.existsSync(logFile);
    if (isNew) {
      fs.appendFileSync(
        logFile,
        "# Tharka Codex diagnostic log. Newest entries are at the bottom. Send this file (and diagnostics.old.log) when reporting a hang or crash.\n" +
          "# Look for WARN/ERROR lines, 'did NOT exit cleanly', 'unresponsive' and 'blocked' just before the problem time.\n"
      );
    } else {
      rotateIfNeeded();
    }
    const text = String(msg).length > 4000 ? String(msg).slice(0, 4000) + "...[truncated]" : String(msg);
    fs.appendFileSync(logFile, `[${localStamp()}] ${level.padEnd(5)} ${text}\n`);
  } catch {
    /* logging must never throw */
  }
}

const info = (m) => write("INFO", m);
const warn = (m) => write("WARN", m);
const error = (m) => write("ERROR", m);

function mb(bytes) {
  return Math.round(bytes / 1024 / 1024);
}

// Top programs by memory on the whole machine - answers "what was eating the
// RAM when it froze". tasklist ships with every Windows version.
function logTopProcesses(reason) {
  const now = Date.now();
  if (now - lastTopProcsAt < 60 * 1000) return; // at most once a minute
  lastTopProcsAt = now;
  if (process.platform !== "win32") return;
  try {
    execFile(
      path.join(process.env.SystemRoot || "C:/Windows", "System32", "tasklist.exe"),
      ["/FO", "CSV", "/NH"],
      { windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return warn(`top-processes (${reason}) unavailable: ${err.message}`);
        const rows = stdout
          .split(/\r?\n/)
          .filter((l) => l.startsWith('"'))
          .map((l) => {
            const f = l.slice(1, -1).split('","');
            return { name: f[0], pid: f[1], kb: parseInt((f[4] || "").replace(/\D/g, ""), 10) || 0 };
          })
          .sort((a, b) => b.kb - a.kb)
          .slice(0, 8);
        warn(`top memory users (${reason}): ` + rows.map((r) => `${r.name}#${r.pid}=${Math.round(r.kb / 1024)}MB`).join(", "));
      }
    );
  } catch {
    /* best effort */
  }
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(lockFile, "utf8"));
  } catch {
    return null;
  }
}

function touchLock(extra = {}) {
  try {
    fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, startedAt: sessionStart, lastBeat: new Date().toISOString(), ...extra }));
  } catch {
    /* best effort */
  }
}

let sessionStart = new Date().toISOString();

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function checkHealth() {
  const free = os.freemem();
  const total = os.totalmem();
  const freeFraction = free / total;

  if (freeFraction < LOW_FREE_MEM_FRACTION || mb(free) < LOW_FREE_MEM_MB) {
    warn(`LOW SYSTEM MEMORY: ${mb(free)} MB free of ${mb(total)} MB (${Math.round(freeFraction * 100)}%) - the PC may start swapping/freezing`);
    logTopProcesses("low memory");
  }

  let metrics = [];
  try {
    metrics = app.getAppMetrics();
  } catch {
    /* app not ready */
  }
  const seen = {};
  for (const m of metrics) {
    const cpu = m.cpu?.percentCPUUsage ?? 0;
    const mem = mb((m.memory?.workingSetSize ?? 0) * 1024);
    const key = `${m.type}#${m.pid}`;
    seen[key] = true;
    if (cpu > HIGH_CPU_PERCENT) {
      highCpuStreak[key] = (highCpuStreak[key] || 0) + 1;
      if (highCpuStreak[key] === 3) {
        warn(`HIGH CPU: ${m.type} process ${m.pid} has used ${Math.round(cpu)}% CPU for ~30s`);
        logTopProcesses("high cpu");
      }
    } else {
      delete highCpuStreak[key];
    }
    if (mem > HIGH_PROC_MEM_MB) {
      warn(`HIGH MEMORY: ${m.type} process ${m.pid} is using ${mem} MB`);
    }
  }
  for (const k of Object.keys(highCpuStreak)) if (!seen[k]) delete highCpuStreak[k];

  const now = Date.now();
  for (const [id, call] of inflight) {
    const age = now - call.start;
    if (age > STUCK_IPC_MS && call.warnedAt !== Math.floor(age / 60000)) {
      call.warnedAt = Math.floor(age / 60000);
      warn(`IPC '${call.channel}' has been running for ${Math.round(age / 1000)}s and has not finished (the app may be waiting on it)`);
    }
  }
}

function heartbeat() {
  beat++;
  touchLock();
  try {
    checkHealth();
  } catch (e) {
    warn(`health check failed: ${e?.message || e}`);
  }
  if (beat % HEARTBEAT_LOG_EVERY === 0) {
    let procs = "";
    try {
      procs = app
        .getAppMetrics()
        .map((m) => `${m.type}:${Math.round(m.cpu?.percentCPUUsage ?? 0)}%/${mb((m.memory?.workingSetSize ?? 0) * 1024)}MB`)
        .join(" ");
    } catch {
      /* ignore */
    }
    info(
      `heartbeat free=${mb(os.freemem())}/${mb(os.totalmem())}MB mainRss=${mb(process.memoryUsage().rss)}MB maxLoopLag=${maxLagSinceBeat}ms inflightIpc=${inflight.size} procs[${procs}]`
    );
    maxLagSinceBeat = 0;
  }
}

function startLagMonitor() {
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const lag = now - last - 500;
    last = now;
    if (lag > maxLagSinceBeat) maxLagSinceBeat = lag;
    if (lag > LAG_WARN_MS) {
      const running = [...inflight.values()].map((c) => `${c.channel}(${Math.round((now - c.start) / 1000)}s)`).join(", ") || "none";
      warn(`MAIN PROCESS BLOCKED for ~${lag}ms (the whole app froze that long). IPC in flight: ${running}`);
    }
  }, 500).unref();
}

// Call once, early. Cheap and safe even before the app is ready.
function init(electronApp) {
  app = electronApp;
}

// Call once the app is ready.
function start({ version, serverUrl } = {}) {
  if (started) return;
  started = true;
  if (!ensurePaths()) return;

  const prev = readLock();
  if (prev && prev.pid !== process.pid) {
    const alive = isPidAlive(prev.pid);
    if (alive) {
      warn(`another Tharka Codex instance (pid ${prev.pid}) is still running - two copies at once can double the load`);
    } else {
      const gapMs = Date.now() - new Date(prev.lastBeat || prev.startedAt).getTime();
      warn(
        `PREVIOUS SESSION DID NOT EXIT CLEANLY: pid ${prev.pid} started ${prev.startedAt}, last heartbeat ${prev.lastBeat}` +
          ` (${Math.round(gapMs / 1000)}s before this start). It crashed, was force-closed/killed, or the whole PC froze or lost power.`
      );
    }
  }

  const cpus = os.cpus();
  info(
    `=== session start v${version || "?"} pid=${process.pid} packaged=${app?.isPackaged} ` +
      `os=${os.type()} ${os.release()} arch=${os.arch()} cpu="${cpus[0]?.model?.trim()}" x${cpus.length} ` +
      `ram=${mb(os.totalmem())}MB free=${mb(os.freemem())}MB uptime=${Math.round(os.uptime() / 60)}min server=${serverUrl || "?"} ===`
  );
  touchLock();

  startLagMonitor();
  setInterval(heartbeat, HEARTBEAT_MS).unref();

  try {
    const { powerMonitor } = require("electron");
    powerMonitor.on("suspend", () => warn("system is going to sleep/suspend"));
    powerMonitor.on("resume", () => info("system resumed from sleep"));
    powerMonitor.on("lock-screen", () => info("screen locked"));
    powerMonitor.on("unlock-screen", () => info("screen unlocked"));
    powerMonitor.on("shutdown", () => warn("system is shutting down"));
  } catch {
    /* power events unavailable */
  }
}

// Mark a clean exit so the next start doesn't report a crash.
function shutdown(reason = "quit") {
  if (!started) return;
  info(`=== session end (${reason}) ===`);
  try {
    fs.unlinkSync(lockFile);
  } catch {
    /* already gone */
  }
}

// Wrap ipcMain.handle so every handler's duration/failure is recorded. Must
// run BEFORE the handlers are registered.
function installIpcTiming(ipcMain) {
  const original = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) =>
    original(channel, async (event, ...args) => {
      const id = nextIpcId++;
      const startedAt = Date.now();
      inflight.set(id, { channel, start: startedAt });
      try {
        return await listener(event, ...args);
      } catch (err) {
        error(`IPC '${channel}' threw: ${err?.stack || err}`);
        throw err;
      } finally {
        inflight.delete(id);
        const took = Date.now() - startedAt;
        if (took > SLOW_IPC_MS) warn(`slow IPC '${channel}' took ${took}ms`);
      }
    });
}

// Mirror console.warn/console.error (main process) into the log - this is how
// the judge's own notices (e.g. memory-limit helper problems) get captured.
function installConsoleMirror() {
  for (const level of ["warn", "error"]) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      try {
        write(level === "warn" ? "WARN" : "ERROR", "console." + level + ": " + args.map((a) => (a instanceof Error ? a.stack : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      } catch {
        /* ignore */
      }
      orig(...args);
    };
  }
}

// Window-level symptoms: the hang a person actually sees.
function watchWindow(win) {
  const wc = win.webContents;
  let unresponsiveAt = 0;
  win.on("unresponsive", () => {
    unresponsiveAt = Date.now();
    error("WINDOW UNRESPONSIVE (the page stopped responding - the 'hang'). Check the lines just above for the cause.");
    logTopProcesses("window unresponsive");
  });
  win.on("responsive", () => {
    warn(`window responsive again after ~${Math.round((Date.now() - unresponsiveAt) / 1000)}s`);
  });
  wc.on("render-process-gone", (e, details) => error(`renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`));
  wc.on("did-fail-load", (e, code, desc, url) => error(`page failed to load: ${code} ${desc} ${url}`));
  wc.on("console-message", (e, level, message, line, sourceId) => {
    if (level >= 2) write(level >= 3 ? "ERROR" : "WARN", `renderer console: ${message} (${path.basename(String(sourceId || ""))}:${line})`);
  });
  win.on("close", () => info("main window closing"));
}

module.exports = { init, start, shutdown, info, warn, error, installIpcTiming, installConsoleMirror, watchWindow, logDirPath: () => (ensurePaths() ? logDir : null) };
