const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const router = express.Router();
const AppUpdateState = require("../models/AppUpdateState");
const { requireAdmin } = require("../lib/adminAuth");
const { broadcastAppUpdate, getConnectedCount } = require("../sockets/syncSocket");

const UPDATES_DIR = path.join(__dirname, "..", "updates");
fs.mkdirSync(UPDATES_DIR, { recursive: true });

// A dedicated, plain-text history of every publish attempt (success or
// failure). Written to two places for the same reason client-electron logs
// to Downloads instead of only its buried AppData log: a log is only useful
// if it's somewhere a non-technical admin would actually think to look.
//   1. Next to the exe/latest.yml themselves (apps/server/updates/) - handy
//      when already poking around this folder.
//   2. This machine's own Downloads folder - the one place everyone already
//      checks first, matching TharkaCodexUpdate.log's own location on every
//      lab laptop.
const PUBLISH_LOG_PATH = path.join(UPDATES_DIR, "publish.log");
// NOT os.homedir() - this server runs as a Windows Service (see
// install-service.js), under a service account whose "home" is
// C:\WINDOWS\system32\config\systemprofile, not the admin's own profile.
// Hardcoded to the actual lab server's account, same reasoning as
// DEFAULT_SERVER_URL's hardcoded LAN IP elsewhere in this app: this is one
// specific, known machine, not a generic multi-user deployment.
const PUBLISH_LOG_DOWNLOADS_PATH = "C:\\Users\\Administrator\\Downloads\\TharkaUpdatePublish.log";
function logPublish(line, req) {
  const ip = req?.ip || req?.socket?.remoteAddress || "unknown";
  const entry = `[${new Date().toISOString()}] ${line} (from ${ip})\n`;
  try {
    fs.appendFileSync(PUBLISH_LOG_PATH, entry);
  } catch (err) {
    console.error("Failed to write publish.log:", err.message);
  }
  try {
    fs.appendFileSync(PUBLISH_LOG_DOWNLOADS_PATH, entry);
  } catch (err) {
    // Downloads folder missing/unwritable for whatever account runs this
    // service - the copy in updates/ above still has everything this would
    // have had.
    console.error("Failed to write publish log to Downloads:", err.message);
  }
}

// electron-builder's nsis config (client-electron/package.json) fixes the
// installer's own filename via `artifactName` - the generic update feed
// must serve it under that exact same name, since a packaged client's
// embedded app-update.yml (baked in at build time) is what electron-updater
// reads to know what file to ask for.
const INSTALLER_FILENAME = "Tharka Codex.exe";

const upload = multer({
  storage: multer.diskStorage({
    destination: UPDATES_DIR,
    filename: (req, file, cb) => cb(null, `upload-${Date.now()}.tmp`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // generous ceiling for an Electron+Chromium installer
  fileFilter: (req, file, cb) => cb(null, file.originalname.toLowerCase().endsWith(".exe")),
});

function sha512Base64(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("base64")));
  });
}

// The version electron-updater actually compares against - assigned HERE, at
// the moment of publish, not read from anything baked into the exe at build
// time (client-electron/scripts/stamp-version.js stamps its OWN version from
// the build's timestamp, but that's a different moment: an admin might build
// several times while testing and only publish one of them, or publish an
// earlier build after a later one turned out broken). "Is there an update"
// should mean "was something newer PUBLISHED", not "was something built with
// a later timestamp." Same year/day-of-year/seconds-of-day scheme as
// stamp-version.js, so it's valid semver and always comparable.
function publishTimeVersion() {
  const now = new Date();
  const major = now.getUTCFullYear();
  const startOfYear = Date.UTC(major, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear) / 86400000) + 1;
  const secondsOfDay = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return `${major}.${dayOfYear}.${secondsOfDay}`;
}

// Hand-built rather than pulling in a YAML library for one flat document -
// this mirrors exactly what electron-builder itself writes, which is what
// electron-updater's generic provider expects to read. Built entirely from
// values this route already has itself (the uploaded exe's own hash/size,
// plus the publish-time version above) - no need for the admin to also
// upload client-electron's own build-time latest.yml alongside the exe.
function buildLatestYaml({ version, sha512, size, releaseDate }) {
  const encodedUrl = encodeURIComponent(INSTALLER_FILENAME);
  return [
    `version: ${version}`,
    `files:`,
    `  - url: ${encodedUrl}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${encodedUrl}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    "",
  ].join("\n");
}

// @route GET /api/app-update/current
// @desc  What build is currently published, for admin-web to display.
router.get("/current", requireAdmin, async (req, res) => {
  try {
    const state = await AppUpdateState.findById("global");
    res.json(state || null);
  } catch (error) {
    console.error("Get app update state error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route POST /api/app-update/publish
// @desc  Admin uploads a freshly-built installer exe - just the one file.
// This computes its checksum itself and stamps the version from the current
// moment (publishTimeVersion() above), then writes both the exe and a
// latest.yml it builds itself into the statically-served updates/ folder.
// Client-electron no longer auto-checks (removed - updates are manual now,
// via the "Check for Updates" button in its own Settings), so nothing here
// notifies laptops anymore either - broadcastAppUpdate is kept only in case
// a future client re-adds a passive "update available" badge.
router.post("/publish", requireAdmin, upload.single("exe"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      logPublish("REJECTED - no exe file uploaded", req);
      return res.status(400).json({ msg: "exe file is required" });
    }

    const size = req.file.size;
    const sha512 = await sha512Base64(tempPath);
    const version = publishTimeVersion();
    const releaseDate = new Date().toISOString();

    // Overwrite any previously-published build - there is only ever one
    // "current" installer, matching electron-updater's generic-provider
    // model of "one latest.yml, one file it points at."
    await fs.promises.rename(tempPath, path.join(UPDATES_DIR, INSTALLER_FILENAME));
    await fs.promises.writeFile(
      path.join(UPDATES_DIR, "latest.yml"),
      buildLatestYaml({ version, sha512, size, releaseDate })
    );

    const state = await AppUpdateState.findOneAndUpdate(
      { _id: "global" },
      { version, fileName: INSTALLER_FILENAME, sha512, size, publishedAt: releaseDate },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    broadcastAppUpdate(version);

    const notifiedClients = getConnectedCount();
    logPublish(
      `PUBLISHED v${version} - ${size} bytes, sha512=${sha512.slice(0, 16)}..., notified ${notifiedClients} connected client(s)`,
      req
    );

    res.json({ version: state.version, publishedAt: state.publishedAt, notifiedClients });
  } catch (error) {
    console.error("Publish app update error:", error);
    logPublish(`FAILED - ${error.message}`, req);
    if (tempPath) fs.unlink(tempPath, () => {});
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
