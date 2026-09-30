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
  StudentDeleteResult,
} from "./types";

const SERVER_URL_KEY = "contest_server_url";

export type ApiError = Error & {
  status?: number;
  body?: { msg?: string; attemptsRemaining?: number; retryAfterSeconds?: number; [k: string]: any };
};

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

// This app IS the admin, and the server always runs on the same machine that
// serves this page (see CLAUDE.md) - so default to whatever host the browser
// actually loaded the page from, on port 3001, rather than a hardcoded
// "localhost". A hardcoded localhost silently breaks every request when the
// dashboard is opened from a *different* machine on the LAN (e.g.
// http://192.168.1.101:5174 from another laptop instead of sitting at the
// server itself) - "localhost" in that browser means the laptop, which has
// nothing listening on :3001, so Add/Edit/Delete all fail.
export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || `${window.location.protocol}//${window.location.hostname}:3001`;
}

export function setServerUrl(url: string) {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/+$/, ""));
}

// Plain fetch() never times out on its own - if the server is mid-restart or
// unreachable, a request just hangs forever with no error, which left every
// mutation/query here (Sync, Push Update, contest CRUD) spinning
// indefinitely with nothing for the admin to act on. See client-web's
// apiClient.ts for the matching fix and fuller rationale.
const REQUEST_TIMEOUT_MS = 15000;

async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${getServerUrl()}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-contest-admin": ADMIN_BYPASS_TOKEN,
        ...(opts.headers || {}),
      },
    });
  } catch (err: any) {
    const message =
      err?.name === "AbortError"
        ? "Couldn't reach the server (timed out). Check the server is running and try again."
        : "Couldn't reach the server. Check the server is running and try again.";
    throw new Error(message) as ApiError;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as any);
    // Keep the status and the parsed body on the Error, not just its
    // message: the permanent-delete route returns structured detail the UI
    // needs to show (attemptsRemaining on a wrong password, retryAfterSeconds
    // on a lockout), and a bare Error(message) throws all of that away.
    const err = new Error(body.msg || body.message || `Request failed: ${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
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
  reorderProblems: (contestId: string, problemIds: number[]) =>
    apiFetch<Contest>(`/api/contests/${contestId}/reorder`, {
      method: "PUT",
      body: JSON.stringify({ problemIds }),
    }),

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

  // PERMANENT + IRREVERSIBLE, unlike setDisqualified above (a reversible
  // toggle that keeps submissions for audit). Erases the student's
  // participant row, disqualification row, and every submission they made -
  // from this contest, or from every contest when scope is "all".
  //
  // The password goes in the JSON body rather than the
  // x-student-delete-password header the server also accepts: header values
  // must be ISO-8859-1, so an admin who sets a password containing any
  // non-ASCII character would make fetch() throw before the request is even
  // sent. A JSON body is UTF-8 and has no such limit. It must never go in
  // the query string - that lands in server/proxy logs and browser history.
  deleteStudent: (
    contestId: string,
    studentRollNumber: string,
    password: string,
    scope: "contest" | "all" = "contest"
  ) =>
    apiFetch<StudentDeleteResult>(
      scope === "all"
        ? `/api/contests/participants/${encodeURIComponent(studentRollNumber)}`
        : `/api/contests/${contestId}/participants/${encodeURIComponent(studentRollNumber)}`,
      { method: "DELETE", body: JSON.stringify({ password }) }
    ),

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

  getCurrentAppUpdate: () =>
    apiFetch<{ version: string; fileName: string; size: number; publishedAt: string } | null>(
      "/api/app-update/current"
    ),
  // Not routed through apiFetch - that helper always sets
  // Content-Type: application/json, which would stop the browser from
  // picking a correct multipart boundary for this one binary upload. The
  // server computes the checksum itself and stamps the version from the
  // publish moment (appUpdateRoutes.js's publishTimeVersion()) - nothing
  // else needs to come along with the exe.
  publishAppUpdate: async (file: File) => {
    const form = new FormData();
    form.append("exe", file);
    const res = await fetch(`${getServerUrl()}/api/app-update/publish`, {
      method: "POST",
      headers: { "x-contest-admin": ADMIN_BYPASS_TOKEN },
      body: form,
    });
    const body = await res.json().catch(() => ({}) as any);
    if (!res.ok) {
      const err = new Error(body.msg || `Request failed: ${res.status}`) as ApiError;
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body as { version: string; publishedAt: string; notifiedClients: number };
  },
};
