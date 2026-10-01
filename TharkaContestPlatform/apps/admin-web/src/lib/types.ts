export interface TestCase {
  input: string;
  output: string;
}

export interface ContestProblem {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  constraints?: string;
  inputFormat: string;
  outputFormat: string;
  timeLimit: number;
  memoryLimit: number;
  // How output is compared - "token" (whitespace-insensitive, right for
  // almost all problems), "exact" (line/spacing-sensitive, for
  // pattern-printing problems), or "om" (line-by-line, spacing-insensitive
  // within a line). See packages/judge-cpp/index.js.
  checker: "token" | "exact" | "om";
  // Leaderboard points an Accepted verdict on this problem is worth - not
  // every problem has to be worth the same amount. See lib/leaderboard.js.
  points: number;
  sampleTestCases: TestCase[];
  hiddenTestCases: TestCase[];
}

export interface ContestSettings {
  // Hides hidden-testcase input/expected/got (in both the submit-result
  // diff and the raw problem-fetch response) from students while the
  // contest is still live. Synced to Electron clients via /api/sync/full,
  // so toggling this here takes effect on every lab PC on the next sync -
  // see CLAUDE.md and stripHiddenTestCaseIO() in the server's contestRoutes.js.
  hideHiddenTestCasesWhileLive: boolean;
}

export interface Contest {
  _id: string;
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  problems: ContestProblem[];
  problemIds: number[];
  settings?: ContestSettings;
  // Private contests are visible only on this admin site: students and the
  // Electron lab clients can't see them, their leaderboard, or their answers.
  isPrivate?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  studentName: string;
  studentRollNumber: string;
  totalScore: number;
  scores: Record<string, { verdict: string; score: number; time: number; attempts: number }>;
  disqualified: boolean;
  disqualifiedReason?: string | null;
  // When they joined the contest (POST .../join, sent by the client's Join
  // screen) - null if this row only exists because of a submission from a
  // client that never called join (e.g. an older build).
  joinedAt: string | null;
}

export interface ContestResults {
  contestId: string;
  problems: { id: number; title: string; points: number }[];
  leaderboard: LeaderboardEntry[];
}

export interface Submission {
  _id: string;
  contestProblemId: number;
  studentName: string;
  studentRollNumber: string;
  language: string;
  code: string;
  verdict: string;
  testCasesPassed: number;
  totalTestCases: number;
  timeTaken: number;
  errorLog?: string;
  submittedAt: string;
  // "server-judged" = this server ran the judge itself (browser/dev submit
  // path). "client-synced" = an Electron laptop judged locally and pushed
  // the result unverified (see /submissions/sync in contestRoutes.js) - no
  // auth means that push could in principle be forged by anything on the
  // LAN, so this at least makes the two distinguishable in the admin view.
  source?: "server-judged" | "client-synced";
}

// Global judge-engine configuration, admin-editable via the Judge Settings
// page - see server's models/JudgeSettings.js for the authoritative shape.
export interface JudgeSettings {
  blockedKeywords: string[];
  compileTimeoutMs: number;
  maxOutputBytes: number;
  interactiveSessionMaxMs: number;
  defaultBlockedKeywords?: string[];
}

// Bulk-import JSON shapes (admin app). Every field beyond the ones marked
// required is optional - see HOWTOUSE.md for the full format and defaults.
export interface BulkTestCaseInput {
  input: string;
  output: string;
}

export interface BulkProblemInput {
  id?: number;
  title: string;
  description: string;
  category?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  constraints?: string;
  inputFormat?: string;
  outputFormat?: string;
  timeLimit?: number;
  memoryLimit?: number;
  // Omit for "token" (the default for a new problem). An unrecognized value
  // is rejected with a validation error, not silently guessed.
  checker?: "token" | "exact" | "om";
  // Omit for 100 (the default). Set higher for a harder problem that should
  // outweigh easier ones on the leaderboard.
  points?: number;
  sampleTestCases?: BulkTestCaseInput[];
  hiddenTestCases?: BulkTestCaseInput[];
}

export interface BulkContestInput {
  id?: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  problems?: BulkProblemInput[];
}

export interface BulkProblemResult {
  id: number;
  title?: string;
  status: "created" | "reused" | "skipped";
  reason: string | null;
}

export interface BulkContestResult {
  id: string;
  name?: string;
  status: "created" | "skipped";
  reason?: string | null;
  problems?: BulkProblemResult[];
}

// Response from the permanent student-delete routes (see
// apiClient.deleteStudent / apps/server/routes/contestRoutes.js). The
// per-contest route returns the single-contest shape flattened at the top
// level; the all-contests route returns the same shape once per affected
// contest in `results`, plus the roll-up counts.
export interface StudentDeleteResult {
  msg: string;
  studentRollNumber: string;
  scope: "this-contest" | "all-contests";
  // this-contest only
  contestName?: string;
  participantRemoved?: boolean;
  disqualificationRemoved?: boolean;
  submissionsDeleted?: number;
  // all-contests only
  contestsAffected?: number;
  results?: {
    contestId: string;
    contestName: string;
    participantRemoved: boolean;
    disqualificationRemoved: boolean;
    submissionsDeleted: number;
  }[];
}
