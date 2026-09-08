const crypto = require("crypto");

// Second factor for the one genuinely irreversible admin action: permanently
// erasing a student from a contest (participant row + disqualification row +
// every submission they made). Everything else an admin can do is either
// recoverable or re-creatable; this is not, so it deliberately requires a
// password the admin types at the moment of deletion, ON TOP OF the normal
// ADMIN_BYPASS_TOKEN that admin-web already sends on every write.
//
// Why a separate secret rather than reusing ADMIN_BYPASS_TOKEN: that token
// lives in admin-web's .env and is baked into the built dashboard, so it is
// effectively "whoever has the admin page open". This one is never shipped
// to any client - it only ever travels as a header/body field on the delete
// request itself - so an unattended, already-open admin tab can't wipe a
// student's contest history on its own.
//
// Same storage/compare model as ADMIN_BYPASS_TOKEN (see lib/adminAuth.js):
// read from .env (gitignored - this repo is public, so it must never be
// hardcoded here) and compared in constant time.
const DELETE_PASSWORD = process.env.STUDENT_DELETE_PASSWORD;
if (!DELETE_PASSWORD) {
  console.warn(
    "WARNING: STUDENT_DELETE_PASSWORD not set in .env - permanent student-deletion routes will refuse every request. " +
    "Disqualify still works; only the irreversible delete is gated."
  );
}

// Brute-forcing a 5-character password over a LAN is seconds of work, and
// the thing on the other side is irreversible data loss, so failures are
// throttled per client IP. In-memory on purpose: this resets on a service
// restart, which is fine (an attacker can't trigger a restart, and the admin
// restarting to clear their own lockout is a feature, not a hole).
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failures = new Map(); // ip -> { count, lockedUntil }

// Unbounded growth would be a slow memory leak on a box that stays up for a
// whole semester, so expired entries are swept whenever the map gets large.
function sweep(now) {
  if (failures.size < 1000) return;
  for (const [ip, rec] of failures) {
    if (rec.lockedUntil && rec.lockedUntil <= now) failures.delete(ip);
  }
}

function equals(supplied, expected) {
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));
  // timingSafeEqual throws on a length mismatch, so length is checked first
  // and a differing length is simply "wrong" - the length of the configured
  // password is not itself a useful secret.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Read from a header or the JSON body, never req.query - a password in a
// query string ends up in proxy/access logs and browser history, and this
// one guards permanent deletion.
function suppliedPassword(req) {
  return req.headers["x-student-delete-password"] || (req.body && req.body.password) || "";
}

function requireDeletePassword(req, res, next) {
  // Fail closed: an unset password means "nobody may delete", never
  // "anybody may delete".
  if (!DELETE_PASSWORD) {
    return res.status(503).json({ msg: "Student deletion is disabled: STUDENT_DELETE_PASSWORD is not configured on the server" });
  }

  const now = Date.now();
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const rec = failures.get(ip);

  if (rec && rec.lockedUntil && rec.lockedUntil > now) {
    const retryAfter = Math.ceil((rec.lockedUntil - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      msg: `Too many incorrect delete passwords. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      retryAfterSeconds: retryAfter,
    });
  }

  if (!equals(suppliedPassword(req), DELETE_PASSWORD)) {
    // Only a lockout that has actually EXPIRED clears the streak. The
    // obvious `rec.lockedUntil <= now` test is wrong: an un-locked record
    // stores lockedUntil = 0, which is always <= now, so it would reset the
    // counter on every single failure and the lockout could never trigger.
    const expired = rec && rec.lockedUntil > 0 && rec.lockedUntil <= now;
    const count = (!rec || expired ? 0 : rec.count) + 1;
    const locked = count >= MAX_FAILURES;
    failures.set(ip, { count, lockedUntil: locked ? now + LOCKOUT_MS : 0 });
    sweep(now);
    console.warn(`Rejected student-delete: wrong password from ${ip} (failure ${count}/${MAX_FAILURES}${locked ? ", now locked out" : ""})`);
    return res.status(403).json({
      msg: "Incorrect delete password",
      attemptsRemaining: Math.max(0, MAX_FAILURES - count),
    });
  }

  failures.delete(ip); // a correct password clears the streak
  next();
}

module.exports = { requireDeletePassword };
