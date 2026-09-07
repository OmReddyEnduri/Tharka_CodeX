const crypto = require("crypto");

// Shared by every route file that needs to tell an admin-web request apart
// from a plain student/LAN-device request. No student auth in this build
// (identification, not authentication - see the plan decision), but admin
// *write* access is a real security boundary: every route that creates,
// edits, or deletes a contest/problem/judge-setting requires this token via
// requireAdmin() below, not just a UX nicety.
//
// This is still just a shared secret compared with a constant-time equality
// check, not full auth (no per-admin accounts, no expiry, no revocation) -
// on a trusted LAN that's an accepted tradeoff, but it is the only thing
// standing between "anyone on the LAN" and rewriting a live contest, so
// treat ADMIN_BYPASS_TOKEN with real care: it's install-specific and read
// from .env (gitignored), NOT hardcoded here, because this repo is public -
// a value committed to source would be readable by anyone on GitHub, which
// defeats the whole point of it not being a guessable well-known string like
// the old "admin=1" was. Must match admin-web's VITE_ADMIN_BYPASS_TOKEN
// (apps/admin-web/.env).
const ADMIN_BYPASS_TOKEN = process.env.ADMIN_BYPASS_TOKEN;
if (!ADMIN_BYPASS_TOKEN) {
  console.warn("WARNING: ADMIN_BYPASS_TOKEN not set in .env - admin preview/early-access AND every admin write route will be unreachable.");
}

function isAdminRequest(req) {
  if (!ADMIN_BYPASS_TOKEN) return false;
  const supplied = req.query.admin || req.headers["x-contest-admin"] || "";
  // Constant-time compare so a timing side-channel can't help a LAN device
  // guess the token one byte at a time. Both buffers must be equal length
  // for timingSafeEqual, so a length mismatch is just treated as "wrong".
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(ADMIN_BYPASS_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Gate for every mutation route - creating/editing/deleting a contest,
// problem, its hidden test cases, or the judge engine's own settings must
// never be reachable by a plain LAN device with no token, even though reads
// (join, submit, browse) deliberately stay open for students.
function requireAdmin(req, res, next) {
  if (!isAdminRequest(req)) return res.status(403).json({ msg: "Admin access required" });
  next();
}

module.exports = { isAdminRequest, requireAdmin };
