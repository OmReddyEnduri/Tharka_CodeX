#!/usr/bin/env node
// packages/judge-cpp is vendored into apps/client-electron/judge-cpp/ as a
// plain file copy (not a symlink/workspace dependency), because
// electron-builder needs to bundle it directly - see that directory's own
// note in package.json. Nothing enforces the two staying identical once
// they exist, so a fix applied to one and not the other would let Electron's
// local judging silently disagree with the server's judging for the exact
// same code, indefinitely. Run this before packaging (wired into
// client-electron's "prebuild" script) to catch that immediately instead.
const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(__dirname, "..", "packages", "judge-cpp");
const MIRROR_DIR = path.join(__dirname, "..", "apps", "client-electron", "judge-cpp");
const FILES = [
  "checkers.js",
  "codeChecker.js",
  "compile.js",
  "execute.js",
  "index.js",
  "interactive.js",
  // jobrun.exe is the Windows Job Object launcher that hard-caps a judged
  // program's memory (see memory.js); memory.js finds it and memoryProbe.js
  // is the sampling fallback + system free-memory backstop. All of them guard
  // the memory-limit enforcement path - a laptop running a stale copy is
  // exactly how local judging silently stops enforcing the memory limit while
  // the server's copy still does.
  "memory.js",
  "memoryProbe.js",
  "jobrun.c",
  "jobrun.exe",
  "staticCheck.js",
];
// In packages/judge-cpp but deliberately not shipped to Electron.
const NOT_MIRRORED = /^test-.*\.js$/;

let drifted = false;
for (const file of FILES) {
  const sourcePath = path.join(SOURCE_DIR, file);
  const mirrorPath = path.join(MIRROR_DIR, file);

  if (!fs.existsSync(sourcePath)) {
    console.error(`✗ ${file}: listed here but missing from packages/judge-cpp/`);
    drifted = true;
    continue;
  }
  if (!fs.existsSync(mirrorPath)) {
    console.error(`✗ ${file}: missing from apps/client-electron/judge-cpp/`);
    drifted = true;
    continue;
  }

  // Compared as raw bytes, not utf8 text: jobrun.exe is a binary, and a
  // lossy utf8 decode could make two different binaries compare equal.
  const source = fs.readFileSync(sourcePath);
  const mirror = fs.readFileSync(mirrorPath);
  if (!source.equals(mirror)) {
    console.error(`✗ ${file}: apps/client-electron/judge-cpp/${file} differs from packages/judge-cpp/${file}`);
    drifted = true;
  }
}

// A new module added to packages/judge-cpp but never added to FILES would
// otherwise never be compared - or never copied, and Electron's judge would
// crash on the missing require().
for (const file of fs.readdirSync(SOURCE_DIR)) {
  if (!/\.(js|c|exe)$/.test(file) || NOT_MIRRORED.test(file) || FILES.includes(file)) continue;
  console.error(`✗ ${file}: in packages/judge-cpp/ but not in this script's FILES list (add it, and mirror it)`);
  drifted = true;
}

if (drifted) {
  console.error(
    "\njudge-cpp drift detected. Copy the changed file(s) from packages/judge-cpp/ into " +
      "apps/client-electron/judge-cpp/ (or vice versa) so local and server judging stay identical."
  );
  process.exit(1);
}

console.log(`✓ judge-cpp: all ${FILES.length} files match between packages/judge-cpp and apps/client-electron/judge-cpp`);
