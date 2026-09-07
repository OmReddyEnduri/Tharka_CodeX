import type {
  Contest,
  ContestProblem,
  ContestResults,
  BulkContestInput,
  BulkContestResult,
  BulkProblemInput,
  BulkProblemResult,
  Submission,
  JudgeSettings,
} from "./types";

const SERVER_URL_KEY = "contest_server_url";

// Not real security - this is a no-auth, non-adversarial LAN app. This is
// just a UX gate that lets the admin preview a contest before it starts and
// see hidden-testcase I/O while a contest is live, matching the server's own
// ADMIN_BYPASS_TOKEN in contestRoutes.js (must stay identical to that
// value - it's a shared constant, not a secret exchanged at runtime). Read
// from .env (VITE_ADMIN_BYPASS_TOKEN, gitignored) rather than hardcoded here
// because this repo is public - Vite inlines this into the built bundle
// either way (any admin-web value is inherently visible to whoever loads
// the page), but keeping it out of *source* means it isn't also sitting in
// the public git history for anyone to read without even running the app.
const ADMIN_BYPASS_TOKEN = import.meta.env.VITE_ADMIN_BYPASS_TOKEN || "";

// This app IS the admin, so the default assumes it's running on the server
// machine itself.
export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || "http://localhost:3001";
}

export function setServerUrl(url: string) {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/+$/, ""));
}

async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getServerUrl()}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-contest-admin": ADMIN_BYPASS_TOKEN,
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as any);
    throw new Error(body.msg || body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const apiClient = {
  listContests: () => apiFetch<Contest[]>("/api/contests"),
  getContest: (id: string) => apiFetch<Contest>(`/api/contests/${id}`),
  createContest: (data: Partial<Contest>) =>
    apiFetch<Contest>("/api/contests", { method: "POST", body: JSON.stringify(data) }),
  updateContest: (id: string, data: Partial<Contest>) =>
    apiFetch<Contest>(`/api/contests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContest: (id: string) => apiFetch(`/api/contests/${id}`, { method: "DELETE" }),
  bulkDeleteContests: (ids: string[]) =>
    apiFetch<{ results: { id: string; status: string; reason?: string }[] }>("/api/contests/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    }),

  addProblem: (contestId: string, data: Partial<ContestProblem>) =>
    apiFetch<ContestProblem>(`/api/contests/${contestId}/problems`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProblem: (contestId: string, problemId: number, data: Partial<ContestProblem>) =>
    apiFetch<ContestProblem>(`/api/contests/${contestId}/problems/${problemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteProblem: (contestId: string, problemId: number) =>
    apiFetch(`/api/contests/${contestId}/problems/${problemId}`, { method: "DELETE" }),
  bulkDeleteProblems: (contestId: string, problemIds: number[]) =>
    apiFetch<{ results: { problemId: number; status: string; reason?: string }[] }>(
      `/api/contests/${contestId}/problems/bulk`,
      { method: "DELETE", body: JSON.stringify({ problemIds }) }
    ),

  bulkCreateContests: (contests: BulkContestInput[]) =>
    apiFetch<{ results: BulkContestResult[] }>("/api/contests/bulk", {
      method: "POST",
      body: JSON.stringify({ contests }),
    }),
  bulkAddProblems: (contestId: string, problems: BulkProblemInput[]) =>
    apiFetch<{ results: BulkProblemResult[] }>(`/api/contests/${contestId}/problems/bulk`, {
      method: "POST",
      body: JSON.stringify({ problems }),
    }),

  getResults: (contestId: string) => apiFetch<ContestResults>(`/api/contests/${contestId}/results`),

  getProblemSubmissions: (contestId: string, problemId: number, rollNumber: string) =>
    apiFetch<Submission[]>(
      `/api/contests/${contestId}/problems/${problemId}/submissions?rollNumber=${encodeURIComponent(rollNumber)}`
    ),

  setDisqualified: (
    contestId: string,
    data: { studentRollNumber: string; studentName: string; disqualified: boolean; reason?: string }
  ) =>
    apiFetch(`/api/contests/${contestId}/disqualify`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getSyncVersion: () =>
    apiFetch<{ version: number; lastSyncedAt: string | null; connectedClients: number; serverTime: string }>(
      "/api/sync/version"
    ),
  triggerSync: () =>
    apiFetch<{ version: number; lastSyncedAt: string; notifiedClients: number }>("/api/sync/trigger", {
      method: "POST",
    }),

  getJudgeSettings: () => apiFetch<JudgeSettings>("/api/judge-settings"),
  updateJudgeSettings: (data: Partial<JudgeSettings>) =>
    apiFetch<JudgeSettings>("/api/judge-settings", { method: "PUT", body: JSON.stringify(data) }),
};
