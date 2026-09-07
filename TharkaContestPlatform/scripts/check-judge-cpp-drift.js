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
const FILES = ["compile.js", "execute.js", "index.js", "interactive.js", "staticCheck.js"];

let drifted = false;
for (const file of FILES) {
  const sourcePath = path.join(SOURCE_DIR, file);
  const mirrorPath = path.join(MIRROR_DIR, file);

  if (!fs.existsSync(mirrorPath)) {
    console.error(`✗ ${file}: missing from apps/client-electron/judge-cpp/`);
    drifted = true;
    continue;
  }

  const source = fs.readFileSync(sourcePath, "utf8");
  const mirror = fs.readFileSync(mirrorPath, "utf8");
  if (source !== mirror) {
    console.error(`✗ ${file}: apps/client-electron/judge-cpp/${file} differs from packages/judge-cpp/${file}`);
    drifted = true;
  }
}

if (drifted) {
  console.error(
    "\njudge-cpp drift detected. Copy the changed file(s) from packages/judge-cpp/ into " +
      "apps/client-electron/judge-cpp/ (or vice versa) so local and server judging stay identical."
  );
  process.exit(1);
}

console.log(`✓ judge-cpp: all ${FILES.length} files match between packages/judge-cpp and apps/client-electron/judge-cpp`);
