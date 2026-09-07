// Submitted solutions are kept client-side only, in this browser's local
// storage - each laptop keeps its own submission history rather than
// round-tripping to the server to read it back. The server still records
// the same submission (via the existing /submit call) for the leaderboard,
// but this local copy is what the "Submissions" tab actually reads from, so
// it works even if the server is briefly unreachable.
export interface LocalSubmission {
  localId: string;
  contestId: string;
  problemId: string | number;
  studentName: string;
  studentRollNumber: string;
  language: string;
  code: string;
  verdict: string;
  testCasesPassed?: number;
  totalTestCases?: number;
  timeTaken?: number;
  submittedAt: string;
}

const STORAGE_KEY = "contest_local_submissions";
// Every submission from every contest this laptop has ever run lives under
// this one unbounded key, full source code included - cap it so a shared
// lab laptop used across a whole semester can't quietly run this key up to
// localStorage's quota. Oldest entries drop first (list is newest-first).
const MAX_STORED_SUBMISSIONS = 500;

function readAll(): LocalSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(subs: LocalSubmission[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
  } catch {
    // Quota exceeded or private mode. Unlike every other localStorage writer
    // in this app, this one used to have no guard - a quota error thrown
    // from here surfaces inside ContestProblem.tsx's submit try-block
    // *after* the server has already returned a real verdict, so a student
    // who was genuinely judged Accepted would see "Failed to submit code"
    // and might panic and resubmit. Losing this local history entry is
    // strictly better than that.
  }
}

export function addLocalSubmission(sub: LocalSubmission): void {
  const all = readAll();
  all.unshift(sub); // newest first
  writeAll(all.slice(0, MAX_STORED_SUBMISSIONS));
}

export function getLocalSubmissions(
  contestId: string,
  problemId: string | number,
  rollNumber: string
): LocalSubmission[] {
  return readAll().filter(
    (s) => s.contestId === contestId && String(s.problemId) === String(problemId) && s.studentRollNumber === rollNumber
  );
}
