// Minimum spacing between one student's judge requests.
//
// Every submit/run request the server accepts costs a full g++ compile plus
// one or more supervised child runs - by far the most expensive thing this
// server does. Nothing stopped a student from holding down Ctrl+Enter, or a
// buggy client from looping, which under a whole lab's worth of laptops is
// enough to make everyone's submissions queue up behind the spam.
//
// One request every 3 seconds per student, per action. Submit and Run are
// tracked separately rather than sharing one budget: a student testing with
// Run must still be able to submit, and vice versa, so the cap can't wedge
// someone out of a live contest. It only bounds the rate.
//
// In-memory on purpose, same tradeoff as lib/deletePassword.js: a service
// restart clears it, which is harmless (the worst case is one extra request
// slipping through right after a restart).
//
// Before this, the only ceiling was the batch-size cap on
// /submissions/sync - that bounds one request, not the rate of them.
const MIN_INTERVAL_MS = 3000;

// Keyed by `${action}:${student}`. A student's roll number is the natural
// identity here (see the no-auth decision - it is what every submission is
// attributed to). A `run` request may arrive with no student attached at all
// (testing sample cases doesn't require joining), so those fall back to the
// caller's IP.
const lastRequestAt = new Map();

// Unbounded growth would be a slow leak on a box that stays up for a whole
// semester, so stale entries are swept once the map gets large - same pattern
// as lib/deletePassword.js.
function sweep(now) {
  if (lastRequestAt.size < 1000) return;
  for (const [key, at] of lastRequestAt) {
    if (now - at > MIN_INTERVAL_MS) lastRequestAt.delete(key);
  }
}

function keyFor(req, rollNumber, action) {
  const who = rollNumber ? `roll:${rollNumber}` : `ip:${req.ip || req.connection?.remoteAddress || "unknown"}`;
  return `${action}:${who}`;
}

// Records a request and says whether it is allowed. `action` is 'submit' or
// 'run' so the two budgets stay independent.
//
// Returns { ok: true } and consumes the window, or
// { ok: false, retryAfterSeconds } and consumes nothing - a rejected request
// must not extend the student's own wait.
function takeJudgeToken(req, rollNumber, action) {
  const now = Date.now();
  const key = keyFor(req, rollNumber, action);
  const last = lastRequestAt.get(key) || 0;
  const elapsed = now - last;

  if (last && elapsed < MIN_INTERVAL_MS) {
    return { ok: false, retryAfterSeconds: Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000) };
  }

  lastRequestAt.set(key, now);
  sweep(now);
  return { ok: true };
}

// Same rule for the client->server submission push. This route re-judges every
// entry it receives (see contestRoutes.js), so it is the single biggest source
// of compile work on the server, and it is reachable with no token at all.
//
// Keyed on the whole request rather than per entry: a laptop flushing its
// offline queue after a network drop is one legitimate burst, and it stays
// allowed - it simply can't be repeated more than once every 3 seconds.
function takeSyncToken(req, rollNumbers) {
  const now = Date.now();
  const rolls = Array.isArray(rollNumbers) ? [...new Set(rollNumbers.filter(Boolean))] : [];
  // A batch carrying several students (not how this client behaves, but the
  // route doesn't forbid it) is limited on each of them, so a mixed batch
  // can't be used to dodge the cap.
  const keys = (rolls.length ? rolls.map((r) => `sync:roll:${r}`) : [keyFor(req, null, "sync")]);

  let worstRetry = 0;
  for (const key of keys) {
    const elapsed = now - (lastRequestAt.get(key) || 0);
    if (lastRequestAt.has(key) && elapsed < MIN_INTERVAL_MS) {
      worstRetry = Math.max(worstRetry, Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000));
    }
  }
  if (worstRetry > 0) return { ok: false, retryAfterSeconds: worstRetry };

  for (const key of keys) lastRequestAt.set(key, now);
  sweep(now);
  return { ok: true };
}

module.exports = { takeJudgeToken, takeSyncToken, MIN_INTERVAL_MS };
