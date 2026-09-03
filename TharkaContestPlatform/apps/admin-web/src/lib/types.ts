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
  sampleTestCases: TestCase[];
  hiddenTestCases: TestCase[];
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
}

export interface LeaderboardEntry {
  rank: number;
  studentName: string;
  studentRollNumber: string;
  totalScore: number;
  scores: Record<string, { verdict: string; score: number; time: number; attempts: number }>;
  disqualified: boolean;
}

export interface ContestResults {
  contestId: string;
  problems: { id: number; title: string }[];
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
