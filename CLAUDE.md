# TharkaLabContest

## What this is

A LAN-based programming contest platform for a school computer lab, pivoted from an
existing school website codebase. One admin server machine on the LAN holds all
contests/problems/testcases/timing; student laptops run a client that judges C++
submissions and (eventually, once Electron is built) works mostly offline, syncing
with the server only when the admin explicitly triggers a sync.

- `TharkaSchoolWebsite-main/` — the **original** school website repo (React/Vite +
  Express/Mongoose, Clerk auth, courses/videos/etc). Left untouched as reference/rollback.
  Do not edit this directory as part of contest-platform work.
- `TharkaContestPlatform/` — the **new**, active monorepo. All contest-platform work
  happens here.

## Architecture (TharkaContestPlatform/)

npm workspaces monorepo:
- `apps/server` — Express + Mongoose + Socket.IO. Contest/problem/testcase CRUD,
  judging (currently server-side, see "Current phase" below), sync push/pull.
- `apps/admin-web` — Vite/React admin dashboard (create/edit contests, problems,
  testcases, trigger sync, view live results). No auth. Runs on port 5174.
- `apps/client-web` — Vite/React student-facing site (join contest, solve problems,
  leaderboard, standalone compiler). No auth. Runs on port 5173.
- `apps/client-electron` — **not built yet**. Will wrap client-web for lab laptops.
- `packages/judge-cpp` — the C++ judge module (compile/execute/staticCheck/run/
  runOnce/interactive), shared by the server today, will run **locally in Electron**
  once that phase happens.
- `packages/shared-types` — intentionally skipped (not worth the coordination
  overhead for 2 apps); each app defines its own local TS types.

Full original design plan (phasing, rationale for each architecture decision) is at
`C:\Users\Administrator\.claude\plans\make-a-detailed-plan-typed-torvalds.md`.

## Key product decisions (don't re-litigate these without asking)

- **No auth.** Students identify by name + roll number at contest join (stored in
  browser localStorage per contest, not global). This is identification, not
  authentication — no password, a student could type someone else's roll number.
  Clerk code was deliberately left behind in the old repo, not ported.
- **Two ways to remove a student, deliberately different in kind.**
  *Disqualify* (`PUT /api/contests/:contestId/disqualify`) is a reversible
  toggle that keeps every submission for audit and just flags/sorts the
  student last on the leaderboard. *Delete* (`DELETE
  /api/contests/:contestId/participants/:roll`, or
  `DELETE /api/contests/participants/:roll` to purge from **every** contest)
  is permanent: participant row + disqualification row + every
  `ContestSubmission` they made, gone. Because it is the only irreversible
  admin action, it needs a **second secret on top of the admin token** —
  `STUDENT_DELETE_PASSWORD` in `apps/server/.env`, checked by
  `lib/deletePassword.js`, sent as an `x-student-delete-password` header or a
  `password` body field (never a query param — that leaks into logs). The
  reasoning for a *separate* secret: `ADMIN_BYPASS_TOKEN` is baked into the
  built admin dashboard, so it effectively means "whoever has the tab open";
  this one is never shipped to any client, so an unattended open admin tab
  can't wipe a student's history. It **fails closed** — an unset password
  means nobody may delete, never everybody. Wrong passwords are throttled
  per IP (5 failures → 15-minute 429 lockout, in-memory, so a service
  restart clears it), and every delete writes a `PERMANENT DELETE:` audit
  line to `daemon/tharkacontestserver.out.log` — the only remaining record
  that the data existed. Deleting a roll number that isn't there is a 404,
  not a silent success, so a typo can't read as "done".
  In the dashboard it's the red **Delete** button next to Disqualify on
  each Live Results row (`AdminResults.tsx`), which opens a dialog with a
  This contest / Every contest scope toggle and a password field. Wrong-
  password and lockout errors render inline in that dialog rather than as
  a toast, so the admin can retry without reopening - which is why
  `apiClient.ts`'s `apiFetch` now attaches `status` and the parsed `body`
  to the Error it throws (`ApiError`) instead of only a message string.
- **Judging**: C++ only (g++ confirmed on all lab machines). "Basic isolation" only —
  subprocess + time/memory limits + a static keyword/include blocklist. No OS-level
  sandboxing (nsjail, containers, VMs) — this is a trusted, non-adversarial lab.
- **Update (superseded)**: originally the server was meant to run only
  intermittently (up just when the admin is actively syncing). The user has
  since decided to run it continuously instead — as of this session it's
  installed as a Windows Service (`TharkaContestServer`, via
  `apps/server/install-service.js`/`uninstall-service.js`, using
  `node-windows`), auto-starting on boot and restarting itself on crash. Still
  keep the `window.contestAPI` feature-detection seam (`apps/client-web/src/lib/apiClient.ts`)
  everywhere it already exists though — a laptop being briefly unreachable
  (reboot, network blip, moved off the LAN) is still a real, common case the
  Electron client needs to tolerate, even though the server itself is no
  longer expected to be *deliberately* turned off between syncs.
- **Submissions are stored client-side in localStorage** (`apps/client-web/src/lib/
  localSubmissions.ts`), not fetched back from the server — each laptop keeps its own
  submission history. The server still records the same submission for the
  leaderboard/admin view, but the "Submissions" tab on the student page reads local
  storage only.
- **Private contests (`contest.isPrivate`) exist only for the admin site.** Students
  and the Electron lab clients can't list, open, join, submit to or see the
  leaderboard of one - every such route returns the same 404 an unknown id gets, and
  `/api/sync/full` leaves them out entirely, so their leaderboard/answers never reach
  a lab laptop. "Admin site" = any request carrying the admin token
  (`lib/privateContests.js`, `isAdminRequest`). Problem routes also refuse a private
  contest's problem requested through a *public* contest URL. Flipping the flag bumps
  the sync version and broadcasts, so a newly-private contest disappears from
  connected laptops immediately. A running private contest still counts toward
  `/live-status`'s `anyLive` (deploys/updates must wait) but is never named there.
- **"Code" checker = admin-written C++, by explicit request.** Besides the six
  rule-based checkers in `packages/judge-cpp/checkers.js` (which were deliberately
  options-not-scripts), a problem can use `checker: "code"` with
  `problem.checkerCode` defining `bool checker(string expected, string user)`. The
  user asked for this explicitly - don't remove it. `codeChecker.js` wraps it in a
  harness, compiles it once per distinct source (cached in
  `%TEMP%contest-checkers`), and runs it per test case (exit 0 = correct, 1 =
  wrong, anything else / >5s = checker error, never blamed on the student). Saving a
  problem with code that doesn't compile is rejected with the compiler output; the
  admin editor has a "Check code" button (`POST /api/contests/checker-code/validate`).
  Runs identically on the server and the Electron local judge; `checkerCode` is
  stripped from every student-facing response (server `stripHiddenTestCaseIO`,
  Electron `redactContestForRenderer`). Admin code is trusted (not blocklisted) but
  time-limited.
- **Hard memory cap via `jobrun.exe` (Windows Job Object)**, on top of
  `memoryProbe.js` sampling. Student programs are launched through
  `packages/judge-cpp/jobrun.exe` (source `jobrun.c`, ~50KB, ~1MB RAM): committed-
  memory limit enforced by Windows at allocation time, max 1 process (no
  fork/`start` escapes), killed with the launcher, below-normal priority. In the
  packaged app it lives in `app.asar.unpacked`; if it ever fails to start the
  judge marks it broken and falls back to sampling instead of failing runs.
- **Diagnostic log**: the Electron client writes
  `DocumentsTharkaCodexLogsdiagnostics.log` (`apps/client-electron/diaglog.js`):
  crashes, window unresponsive, main-process blocking, slow/stuck IPC, low memory /
  high CPU with the top processes, judge runs, and "previous session did not exit
  cleanly" detection. First place to look for "the app/PC hung" reports.
- **Hidden test case I/O is redacted while a contest is still running** — a Wrong
  Answer/TLE/etc. result only shows the verdict + which test number, not the actual
  input/expected/got values, until `contest.endTime` has passed (see
  `contestRoutes.js`'s submit route). Sample-testcase "Run" results are never
  redacted (student already has that I/O on the problem page).
- **Contests are gated by `startTime`** both server-side (403 on fetch/submit before
  start) and client-side (`Contest.tsx` shows a clear "hasn't started yet" card
  instead of an empty problem list).
- **Testcases can be bulk-loaded from files** in the admin problem editor: two file
  pickers (input files, output files), paired by **sorted filename order** (not
  fuzzy name matching) — e.g. `1.txt`+`1.txt` across the two pickers pairs together.
- **Standalone compiler page** (`/compiler` in client-web) is modeled on
  onecompiler.com: editor on one side, a `Console` (live interactive terminal via a
  dedicated Socket.IO `/compiler` namespace — real streaming stdin/stdout, not
  batch) / `I/O` (paste fixed stdin, run once, see full output) tabbed panel on the
  other. Interactive sessions are hard-capped at **10 seconds** total run time
  (`packages/judge-cpp/interactive.js` `MAX_SESSION_MS`) — this is tight for genuine
  back-and-forth typing; the user asked for exactly this cap knowing the tradeoff,
  but if it turns out too aggressive in practice, consider switching to an
  idle-timeout (reset on each input) instead of a total-session cap.

## Theming (both apps)

Not a light/dark binary — **6 named app themes** (`light`, `dark`, `dim`, `midnight`,
`solarized`, `highContrast`), defined via `[data-theme="X"]` CSS variable blocks in
each app's `index.css`, switched via `apps/*/src/lib/theme.ts` + a `<select>` in
`ThemeToggle.tsx` (top bar of every page — including the two full-screen pages that
skip `AppShell`, `ContestProblem.tsx` and `Compiler.tsx`). `.dark` class is toggled
alongside `data-theme` for the dark-family themes, since a few components still use
Tailwind `dark:` utility variants. **"Dark" was deliberately softened** (background
went from 8% to 15% lightness) after direct feedback that the original near-black
was too harsh — don't revert it back to near-black.

The Monaco **code editor's own theme** is separate and user-configurable via the
gear icon (`ContestSettingsDialog.tsx`) — 4 built-in Monaco themes plus 4 hand-defined
custom ones (Dracula, Monokai, Nord, GitHub Light) registered via
`apps/client-web/src/lib/monacoThemes.ts`'s `registerCustomMonacoThemes()`, called
from every `<Editor beforeMount={...}>` in the app. This is intentionally independent
of the app-wide theme (matches how real IDEs keep editor theme separate from app chrome).

When adding any new colored UI (badges, status pills, etc.), **never use a bare
light-shade Tailwind class** (`bg-green-100`, `text-green-700`, etc.) without a
`dark:` counterpart — grep for `bg-\w+-50\b|bg-\w+-100\b|text-\w+-800\b` across
`apps/*/src/**/*.tsx` before calling a UI change done; two spots (`Contest.tsx`
difficulty badges, `AdminContestsList.tsx` status badges) already needed this fix.

## Home page / server URL (client-web)

The server URL is **not editable on the Home page** — it's baked into
`apps/client-web/src/lib/apiClient.ts`'s `DEFAULT_SERVER_URL` (and mirrored in
`apps/client-electron/main.js`'s own `DEFAULT_SERVER_URL`) — currently
`http://192.168.1.101:3001`, the real lab server's LAN IP — and can only be overridden on
the dedicated `/settings` page (`Settings.tsx`, linked via a gear icon in
`AppShell`), not in the main flow. Home (`Home.tsx`) is purely a contest finder:
a search box filtering by name, contests grouped into Live/Upcoming/Previous
sections (computed client-side from `startTime`/`endTime`, same pattern as
`AdminContestsList.tsx`'s `contestStatus()` helper). When testing locally,
`localStorage.setItem('contest_server_url', 'http://localhost:3001')` overrides
the LAN default back to the dev server.

## Server runs as a Windows Service now

`apps/server` is installed as a Windows Service named **`TharkaContestServer`**
(shows as `tharkacontestserver.exe` in `Get-Service`), set up via
`apps/server/install-service.js` (uses the `node-windows` npm package, a
devDependency). It's set to auto-start on boot and auto-restart on crash
(`maxRetries: 60` with backoff, configured in that script). MongoDB is
already its own auto-starting Windows Service too (installed earlier via
`winget install MongoDB.Server`), so a full reboot brings the whole backend
back up with no manual steps.

Useful commands (PowerShell, as Administrator):
```
Get-Service TharkaContestServer              # check status
Restart-Service TharkaContestServer           # restart (e.g. after editing server.js)
cd apps/server; node uninstall-service.js     # remove the service entirely
cd apps/server; node install-service.js       # (re)install it
```
After editing any server-side code (`apps/server/**`, `packages/judge-cpp/**`),
restart the service to pick up the change — it does not hot-reload.

**The admin dashboard is a second service**: `TharkaAdminWeb` (shows as
`tharkaadminweb.exe`), installed via `apps/admin-web/install-service.cjs`.
It runs `vite preview` — the built `dist/`, not the dev server — on port
5174, so `http://localhost:5174/` (and `http://192.168.1.101:5174/` from the
LAN) is up whenever the machine is. Because it serves a *build*, editing
`apps/admin-web/src/**` changes nothing until you re-run
`npm run build --workspace=admin-web` and restart the service.

Note the real service **Name**s are `tharkacontestserver.exe` /
`tharkaadminweb.exe`; `TharkaContestServer` / `TharkaAdminWeb` are DisplayNames.
`Get-Service` accepts either, but raw `sc.exe` needs the `.exe` Name.

Two things `node-windows` can't configure, applied with `sc.exe` by the two
install scripts (and re-applied on reinstall — don't drop these):
- `TharkaContestServer` **depends on `MongoDB`**. Both are auto-start, so
  without the dependency Windows races them on boot. `server.js` only *logs*
  a failed `mongoose.connect()` rather than exiting, and mongoose does not
  retry once the initial connect rejects — so losing that race yields a
  server that answers HTTP but fails every DB query, i.e. looks healthy to
  any port check while the whole lab is broken. admin-web deliberately has
  **no** dependency: it should still load when the backend is down.
- **Windows-level recovery** on both (`sc failure ... restart/60000` ×3).
  `node-windows`'s `maxRetries: 60` only restarts the *child node process*
  from inside the wrapper; if the wrapper `.exe` itself dies, nothing
  recovers it. Both services were found stopped with exit 1067 for exactly
  this reason before recovery actions were added.

**Known hazard**: node-windows generates each daemon `.exe` in a `daemon/`
folder next to its `script`. For admin-web that `script` is
`node_modules/vite/bin/vite.js`, so its service binary lives *inside
node_modules* — a plain `npm install`/`npm ci` deletes it, leaving a service
that is still registered and still set to auto-start but can never start
again. After any dependency reinstall, re-run
`node uninstall-service.cjs && node install-service.cjs` in `apps/admin-web`.

## Current phase / status

Plan phases 1–5 (server rework, sync protocol, local-judge module design, both
frontend apps, admin app) are **done and verified live** (curl + Playwright
browser testing) as of the last session. Judging currently runs **server-side**
(interim, per the plan's deliberate sequencing) via `packages/judge-cpp`, called
directly from `contestRoutes.js`'s submit route — this is meant to be swapped for
local Electron judging in Phase 6 without touching page components, via the
`window.contestAPI` seam already built into `apiClient.ts` in both frontend apps.

Since then, also added (client feature requests, not in the original plan): a
security pass on `packages/judge-cpp` (compile timeout 15s→10s, interactive session
cap 10s, expanded `staticCheck.js` blocklist — Windows API names, `popen`/`remove`/
`unlink`/`rmdir`); testcase bulk-upload-from-files in the admin problem editor
(`TestCaseFileUpload.tsx`); client-side-only submission history via localStorage
(`localSubmissions.ts`) replacing the old server-fetch for the "Submissions" tab;
the `/compiler` standalone-compiler page (Console/I-O tabs, real interactive
terminal via a `/compiler` Socket.IO namespace); hidden-testcase-diff redaction
while a contest is active; a resizable (drag left edge) admin problem-editor sheet;
and the 6-theme system described above.

**Phase 6 (Electron) now exists** at `apps/client-electron/` — `main.js` (window +
IPC handlers + sync logic), `preload.js` (contextBridge, `contextIsolation: true`),
`db.js` (local data store). Verified working end-to-end: local judging via IPC
(`run-code`/`submit-code`/`run-standalone`, plus a live interactive terminal via
`InteractiveSession` for the Compiler page's Console tab), sync-on-open
(compares local vs server version, pulls if stale), and **live push sync**
(admin triggers sync → Electron's socket picks up `sync:push` → re-pulls →
notifies the renderer) — proven by triggering a real sync and watching the
local store's version update within milliseconds.

**Deviation from the original plan**: `db.js` is a **plain JSON file**
(`app.getPath('userData')/contest-store.json`), not SQLite/`better-sqlite3`.
This machine has no working Python/MSVC toolchain, so `better-sqlite3` (a
native module) fails to compile — `npm install` errors with `gyp ERR! find
Python`. Installing a full build toolchain just for this felt like a heavy,
risky system change for no real benefit, since the actual query needs here
(replace the whole contest list on sync, look up one contest/problem by id)
don't need real SQL - no joins, no indexes. If a future need actually
requires SQL, revisit `better-sqlite3` (needs Python 3 + VS Build Tools first)
or a WASM option like `sql.js` (no native compile, but async + manual
disk-persistence). Identity, editor prefs, and local submission history stay
in the renderer's `localStorage` as before (Electron's `BrowserWindow` has
real, persistent `localStorage` per origin, so no bridge was needed for those).

**Gotcha hit and fixed**: Windows PowerShell 5.1's `Set-Content -Encoding
utf8` writes a **UTF-8 BOM**, which silently broke `JSON.parse` in `db.js`
(caught by the try/catch, fell back to an empty default store with no error
surfaced) when hand-seeding the store file for testing. `db.js`'s `load()`
now strips a leading BOM defensively. If seeding/editing this file by hand
again, prefer `[System.IO.File]::WriteAllText($path, $json)` (no BOM) over
`Set-Content -Encoding utf8`.

**Also fixed while building this**: the Compiler page's interactive Console
tab was still hard-wired to a direct `socket.io-client` connection to the
server regardless of Electron - added the missing `window.contestAPI`
seam (`startInteractive`/`sendInteractiveInput`/`stopInteractive`/
`onInteractiveStdout`/`onInteractiveStderr`/`onInteractiveExit`) so it also
runs fully local via IPC when Electron is present. And the default Electron
File/Edit/View/Window/Help menu bar is now stripped (`Menu.setApplicationMenu(null)`
+ `autoHideMenuBar: true`) - this is a kiosk-style lab app, not a document editor.

**Packaging works**: `npm run build` in `apps/client-electron` produces the
NSIS installer at `dist/Tharka Codex.exe` (per-user, one-click, no admin
rights), verified building and packaging the built `client-web/dist` in as
`extraResources`. Phase 7 (real multi-laptop LAN pilot) still not started.
The installer also creates the Downloads + Desktop/Start Menu shortcuts and
**pins the app to the taskbar** - see `installer.nsh`'s `customInstall`, and
its comment for why writing a `.lnk` into the shell's own "User Pinned\TaskBar"
folder is the only approach that works (Windows gives installers no
supported "pin to taskbar" API), and why it is unconditional rather than an
opt-in checkbox page.

**App auto-update was removed entirely** - `electron-updater`, `relauncher.ps1`,
`diagnose-update.ps1`/`.bat`, `scripts/stamp-version.js`, `main.js`'s update
pipeline and its `TharkaCodexUpdate.log`, the `update-status` IPC broadcast and
`preload.js`'s `onUpdateStatus`/`checkForUpdate`/`openUpdateLog`/`getAppVersion`,
client-web's `UpdateStatusIndicator` and the Settings "Check for Updates" card,
admin-web's `PushUpdateCard`, and the whole server side
(`routes/appUpdateRoutes.js`, `models/AppUpdateState.js`, the `/api/app-update`
mount, the static `/updates` feed, `broadcastAppUpdate`, `apps/server/updates/`).
New builds are distributed by hand: build, then copy the installer to each
laptop. `main.js` still writes `~/Downloads/TharkaCodex.log` for crashes
(`logToFile`) - that survives the removal on purpose, since a packaged build
with devTools disabled has nowhere else to leave a trace.
Why it went: it was never reliable on this hardware. Windows Defender
repeatedly deleted the freshly-installed, **unsigned** exe as
`Trojan:Win32/Phonzy.A!ml` (an ML heuristic false positive - a well-known
unsigned-Electron problem), NSIS's own `--force-run` relaunch is unloggable
(`spawnLog()` uses `stdio:"ignore"`), and the custom `relauncher.ps1` built to
work around both was itself a recurring source of silent failures. If updates
ever come back, the real preconditions are (a) code-signing the build, which
removes the Defender false-positive class outright, and (b) a real
multi-laptop pilot - not another relauncher.

## Editor persistence, code template, and file save/open (client-web)

Three small localStorage-backed libs, all per-laptop and deliberately never synced:
- `lib/codeTemplate.ts` — a LeetCode-style **saved code template**. Every new
  problem and the `/compiler` page open with it instead of the old hardcoded
  stub. Edited in the gear-icon `ContestSettingsDialog` (a small Monaco editor
  plus "Use current code" / "Reset" / "Save template").
- `lib/codeDrafts.ts` — **per-problem draft autosave** (debounced 500ms), keyed
  `contestId:problemId:rollNumber` so two students sharing a lab laptop for the
  same contest never inherit each other's in-progress code. The compiler page
  has its own fixed key. Restore is guarded by a ref keyed on contest+problem,
  **not** a `!code` test — the old `!code` test refilled the editor the instant
  a student selected-all and deleted.
- `lib/editorSettings.ts` — Monaco theme/font/keybinding, now persisted (they
  used to reset on every page load).

`lib/fileIO.ts` does Save/Open with three feature-detected tiers: Electron IPC
native dialogs (`window.contestAPI.saveFile/openFile` → `main.js`'s
`save-file`/`open-file` handlers, which return a real absolute path so Ctrl+S
overwrites in place), then the File System Access API (Chromium, secure
contexts only — so **not** a student browsing to the LAN server over plain
http), then a download/`<input type=file>` fallback. `fileAccessMode()` reports
which tier is live so the UI can say "Download" instead of implying an
overwrite that isn't happening. Compiler shortcuts: Ctrl+B run, Ctrl+Q stop,
Ctrl+S save, Ctrl+Shift+S save-as, Ctrl+O open. Problem page: Ctrl+' run,
Ctrl+Enter submit. All are capture-phase on `window` and suspended while the
settings dialog is open.

Known bugs already found and fixed (don't reintroduce): **`execute.js` must
trim trailing whitespace only, never `.trim()`** — a full trim ate *leading*
whitespace from the program's actual output while the admin's expected output
was never leading-trimmed to match. That asymmetry failed every correct
pattern-printing solution (the `  *` / ` ***` / `*****` pyramid contests 6-9)
and, worse, *accepted* a wrong answer that omitted the leading spaces. All
output comparison now lives in exactly one place, `checkers.js` (extracted out
of `index.js` since), applied identically to both sides. That module is the
single source of truth for the six modes - `token` (default), `om`, `exact`,
`numeric`, `unordered`, `custom` - each a small object exposing
`normalize(raw, config) -> { key, display }` plus an optional
`equals(aKey, bKey, config)`. The verdict is made from `key` alone, through
`equals`; the server's `VALID_CHECKERS` (`contestRoutes.js`), the Mongoose
enum (`models/ContestProblem.js`) and the admin dropdown all read the id list
from that registry rather than repeating it.

Two rules there are load-bearing and shouldn't be undone. **Trailing noise is
stripped from both sides, for every mode, before its own rules run**
(`stripTrailingNoise` in `compareOutput`) - a final `endl`, trailing spaces,
trailing blank lines can never be why a correct answer failed, and no new mode
can forget to. Leading whitespace is deliberately *not* stripped: it is the
answer for `exact`, and the other modes handle it in their own rule.
**`custom` is options, not a script** (`problem.checkerConfig`, a small flat
object: `compareAs` lines|tokens, `ignoreWhitespace`, `ignoreBlankLines`,
`ignoreCase`, `ignoreChars`, `numberTolerance`). Deliberate: the comparison
rule has to be something an admin can read and audit, and neither the server
nor the Electron client (which judges offline on a student's laptop) should be
executing admin-authored code to decide a verdict. `normalizeCheckerConfig`
coerces anything stored into a valid config instead of throwing, so a bad or
old config degrades to a sane comparison rather than failing every submission,
and the routes sanitize through it on both create and edit. **The displayed output is the raw output** (`results[].userOutput`/`expectedOutput` come from `displayRaw` in
`compareOutput`, not from `display`): the "Your Output" vs "Expected" panels show
each side exactly as it came out of the programs - spaces, tabs, blank lines and
line breaks included - with CRLF→LF as the only change, since Windows stdio
silently rewrites every `\n`. Normalizing the panels too (the old behaviour)
hid the spacing that is the whole point of reading a Wrong Answer, i.e. it
disagreed with the student's own terminal. Forgiveness lives in `key` only.
Under `exact`, CRLF→LF, per-line
trailing whitespace, and leading/trailing blank lines are ignored, while
leading spaces and internal spacing stay significant. Also fixed earlier: a race between `tree-kill`'s
completion callback and a killed child process's own `close` event, which caused
TLE/MLE to be misreported as "Runtime Error" (fixed in both `execute.js` and
`interactive.js` by settling the verdict synchronously before killing, guarded by a
`settled`/`_settled` flag so the later `close` event is a no-op).

**The memory limit is enforced by `memoryProbe.js`, not `pidusage`.** This was the
cause of the "the whole laptop freezes and has to be rebooted" reports. Enforcement
used to be sampled by `pidusage`, whose Windows backend shells out to `wmic.exe` —
deprecated, and *absent* on the lab machine — so every sample failed, the failure
was swallowed, and **the memory limit was silently never enforced at all**: a
program that allocated in a loop ran until Windows ran out of RAM. (The packaged
Electron app's `pidusage@4` didn't fail, but fell back to spawning PowerShell + a
WMI query per sample — ~1s and tens of MB each — polled every 500ms from a
`setInterval(async …)` with no overlap guard, so a long console session kept several
alive at once.) `memoryProbe.js` measures the child directly (`tasklist` on Windows,
`/proc/<pid>/status` on Linux, `ps` elsewhere) and never overlaps its own samples.
It enforces two things: the problem's own `memoryLimit`, and a system backstop that
kills a run once free memory drops below 512MB having fallen 256MB+ since that run
started. The backstop matters because the per-process figure is a *working set*,
which Windows trims under pressure — so it can stop seeing a program at exactly the
moment that program is driving the machine into swap. `pidusage` is no longer a
dependency of `judge-cpp` or `client-electron`. Regression tests:
`npm test --workspace=judge-cpp` (checkers + `test-memory-probe.js`).
`memoryProbe.js` is now one of the files `scripts/check-judge-cpp-drift.js` mirrors
into `apps/client-electron/judge-cpp/` (7 files).

**Judge requests are rate-limited to one per 3 seconds per student**
(`apps/server/lib/submitRateLimit.js`, mirrored in `apps/client-electron/main.js`'s
`submit-code` handler). Every submit/run is a full g++ compile plus supervised
child runs - the most expensive thing this server does - and nothing previously
bounded how fast one student could ask for them. `submit` and `run` have
separate budgets so testing with Run can't lock a student out of submitting
(and vice versa); the direct-submit route is checked after the "already solved"
short-circuit so re-opening a solved problem is never throttled, and before the
compile so a rejected request costs nothing. `POST /submissions/sync` has the
same 3-second rule plus a 200-entry batch cap - a 429 there is treated by the
client exactly like any other failure, so queued submissions stay queued and are
retried (nothing is dropped). Admin decision: keep the `staticCheck` blocked-word
list exactly as shipped - `std::remove` and friends are not used by these
students, so the false-positive risk was accepted rather than loosened.

## Running it locally (dev)

```
cd TharkaContestPlatform
npm install                          # installs all workspaces
npm run seed --workspace=server      # wipes & reseeds one demo contest w/ 2 problems
node apps/server/server.js           # port 3001, needs local MongoDB running
cd apps/client-web && npx vite       # port 5173
cd apps/admin-web && npx vite        # port 5174
```

MongoDB must be running locally (`mongodb://localhost:27017/TharkaContest`,
configured in `apps/server/.env`, which is a clean minimal file — the **original**
repo's `.env` had live Clerk/Zoom/R2/PhonePe/SendGrid secrets; do not copy that file
into the new repo, ever, even by accident via a bulk copy).
