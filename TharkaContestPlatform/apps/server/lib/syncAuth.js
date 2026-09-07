const crypto = require("crypto");

// GET /api/sync/full returns every hidden test case's real input/expected
// output, completely unredacted - Electron's local judge genuinely needs
// those real values to judge offline (see client-electron/main.js, which
// runs the same judge module against problem.hiddenTestCases straight out
// of its local synced copy). That means this route can't apply the same
// "hide while live" redaction the rest of the API uses (contestRoutes.js's
// stripHiddenTestCaseIO) without breaking local judging during exactly the
// live contest it exists for.
//
// So instead of redacting the data, this gates *who* can ask for it with a
// second, separate shared secret baked into the packaged Electron app - not
// the admin token (a student's laptop is not an admin), a distinct one whose
// only job is "you are the real Electron sync client, not a browser tab
// someone pointed at this URL." Like ADMIN_BYPASS_TOKEN, this raises the bar
// from "anyone who knows the URL" to "anyone who extracts this string from
// the packaged .exe" - real mitigation on a trusted LAN, not full auth.
// Must exactly match apps/client-electron/main.js's SYNC_DEVICE_TOKEN.
const SYNC_DEVICE_TOKEN = process.env.SYNC_DEVICE_TOKEN;
if (!SYNC_DEVICE_TOKEN) {
  console.warn("WARNING: SYNC_DEVICE_TOKEN not set in .env - GET /api/sync/full will be unreachable by Electron clients.");
}

function isSyncDevice(req) {
  if (!SYNC_DEVICE_TOKEN) return false;
  const supplied = req.headers["x-contest-sync-token"] || "";
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(SYNC_DEVICE_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireSyncDevice(req, res, next) {
  if (!isSyncDevice(req)) return res.status(403).json({ msg: "Sync device token required" });
  next();
}

module.exports = { isSyncDevice, requireSyncDevice };
