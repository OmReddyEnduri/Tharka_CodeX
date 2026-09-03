import type {
  Contest,
  ContestProblem,
  ContestResults,
  BulkContestInput,
  BulkContestResult,
  BulkProblemInput,
  BulkProblemResult,
  Submission,
} from "./types";

const SERVER_URL_KEY = "contest_server_url";

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
      // Not real security - this is a no-auth, non-adversarial LAN app.
      // It's just a UX gate that lets the admin preview a contest early.
      "x-contest-admin": "1",
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
    data: { studentRollNumber: string; studentName: string; disqualified: boolean }
  ) =>
    apiFetch(`/api/contests/${contestId}/disqualify`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getSyncVersion: () =>
    apiFetch<{ version: number; lastSyncedAt: string | null; connectedClients: number }>("/api/sync/version"),
  triggerSync: () =>
    apiFetch<{ version: number; lastSyncedAt: string; notifiedClients: number }>("/api/sync/trigger", {
      method: "POST",
    }),
};
