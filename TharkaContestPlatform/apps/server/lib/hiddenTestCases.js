const { isAdminRequest } = require("./adminAuth");

// Hidden test cases are the "answer key" - any response that could reach a
// non-admin device must not carry the raw input/expectedOutput over the wire
// at all (a student can read the Network tab, or hit the URL directly),
// regardless of whether any UI renders it.
//
// This is the single copy of that rule - used by contestRoutes.js (the
// per-problem fetch and submit-result routes) AND syncRoutes.js (the full
// snapshot every Electron client pulls). It used to be duplicated per-file;
// that's exactly how /api/sync/full ended up shipping every hidden testcase
// unredacted, unconditionally - it was never wired up to a second copy of
// this function. One copy now, so there's nowhere left for a route to
// forget to call it.
//
// `hideHiddenTestCasesWhileLive` is the only thing that decides this,
// independent of whether the contest is running or has ended - an admin who
// wants the answer key kept secret can leave it hidden indefinitely (e.g. to
// reuse the same problems in a later contest), and one who wants it visible
// can flip it off at any time, mid-contest or after. It used to also
// auto-reveal the moment `contest.endTime` passed, which meant a hidden
// testcase couldn't actually stay hidden if the admin wanted it to.
function stripHiddenTestCaseIO(problem, contest, req) {
  if (isAdminRequest(req)) return problem;
  if (contest.settings?.hideHiddenTestCasesWhileLive === false) return problem;

  const obj = typeof problem.toObject === "function" ? problem.toObject() : { ...problem };
  obj.hiddenTestCases = (obj.hiddenTestCases || []).map(() => ({}));
  return obj;
}

module.exports = { stripHiddenTestCaseIO };
