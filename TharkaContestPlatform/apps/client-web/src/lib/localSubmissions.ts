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

function readAll(): LocalSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(subs: LocalSubmission[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
}

export function addLocalSubmission(sub: LocalSubmission): void {
  const all = readAll();
  all.unshift(sub); // newest first
  writeAll(all);
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
