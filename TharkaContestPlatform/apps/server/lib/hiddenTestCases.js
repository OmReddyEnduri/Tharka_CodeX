const { isAdminRequest } = require("./adminAuth");

// Hidden test cases are the "answer key" - any response that could reach a
// non-admin device while a contest is still live must not carry the raw
// input/expectedOutput over the wire at all (a student can read the Network
// tab, or hit the URL directly), regardless of whether any UI renders it.
//
// This is the single copy of that rule - used by contestRoutes.js (the
// per-problem fetch and submit-result routes) AND syncRoutes.js (the full
// snapshot every Electron client pulls). It used to be duplicated per-file;
// that's exactly how /api/sync/full ended up shipping every hidden testcase
// unredacted, unconditionally - it was never wired up to a second copy of
// this function. One copy now, so there's nowhere left for a route to
// forget to call it.
function stripHiddenTestCaseIO(problem, contest, req) {
  if (isAdminRequest(req)) return problem;
  if (contest.settings?.hideHiddenTestCasesWhileLive === false) return problem;
  const contestEnded = contest.endTime && new Date(contest.endTime) <= new Date();
  if (contestEnded) return problem;

  const obj = typeof problem.toObject === "function" ? problem.toObject() : { ...problem };
  obj.hiddenTestCases = (obj.hiddenTestCases || []).map(() => ({}));
  return obj;
}

module.exports = { stripHiddenTestCaseIO };
