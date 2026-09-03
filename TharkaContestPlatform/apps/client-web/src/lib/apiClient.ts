// Feature-detects `window.contestAPI` (the Electron IPC bridge, exposed by
// apps/client-electron/preload.js) everywhere it matters: when present, data
// reads come from the local SQLite mirror and judging runs on-device - the
// server is only ever hit for LAN sync, matching the "server isn't always
// running" design. In the plain browser build (no Electron) contestAPI is
// undefined, so everything below falls through to a direct server call.
function getContestAPI(): any {
  return typeof window !== "undefined" ? (window as any).contestAPI : undefined;
}

const SERVER_URL_KEY = "contest_server_url";
// Baked-in default so lab laptops work with zero configuration - override
// only via the dedicated Settings page (not exposed on the main flow).
const DEFAULT_SERVER_URL = "http://192.168.1.101:3001";

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL;
}

export function setServerUrl(url: string): void {
  const clean = url.replace(/\/$/, "");
  localStorage.setItem(SERVER_URL_KEY, clean);
  // Electron's main process owns its own sync connection - keep it in sync
  // with whatever the renderer just saved (fire-and-forget; no UI depends on
  // the result here, syncNow()/reconnect handles picking it up).
  getContestAPI()?.setServerUrl?.(clean);
}

async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getServerUrl()}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.msg || body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Contests / problems ----------------------------------------------
// In Electron these read the local SQLite mirror (kept current by main.js's
// sync logic) instead of the network, so the app works between syncs.

export const getContests = () => getContestAPI()?.getContests?.() ?? apiFetch("/api/contests");
export const getContest = (contestId: string) => getContestAPI()?.getContest?.(contestId) ?? apiFetch(`/api/contests/${contestId}`);
export const getContestProblem = (contestId: string, problemId: string | number) =>
  getContestAPI()?.getContestProblem?.(contestId, problemId) ?? apiFetch(`/api/contests/${contestId}/problems/${problemId}`);

export const getSubmissions = (contestId: string, problemId: string | number, rollNumber: string) =>
  apiFetch(`/api/contests/${contestId}/problems/${problemId}/submissions?rollNumber=${encodeURIComponent(rollNumber)}`);

// Leaderboard is cross-student aggregation, computed server-side - but in
// Electron it's embedded in the sync snapshot (see server's syncRoutes.js
// /full) and read from the local mirror here, same as contests/problems, so
// it's viewable offline and only updates when the admin presses Sync (not a
// live poll). Plain-browser mode has no local mirror, so it stays a live call.
export const getResults = (contestId: string) =>
  getContestAPI()?.getResults?.(contestId) ?? apiFetch(`/api/contests/${contestId}/results`);

export const getSyncVersion = () => apiFetch("/api/sync/version");
export const getSyncFull = () => apiFetch("/api/sync/full");

// --- Sync status (Electron only) ---------------------------------------
// Lets the UI show whether the local mirror is current, mid-pull, or stale
// because the server's unreachable - without this the app synced silently,
// which made it easy to go offline mid-pull (or before the first sync ever
// landed) with no indication anything was wrong until a problem turned up
// missing. No-op in the plain browser build (no local mirror to report on).
export const isElectron = () => !!getContestAPI();

export const getSyncState = () =>
  getContestAPI()?.getSyncState?.() ?? Promise.resolve(null);

export function onSyncStatus(callback: (state: { status: string; version: number; lastSyncedAt: string | null }) => void) {
  const unsubscribe = getContestAPI()?.onSyncStatus?.(callback);
  return unsubscribe ?? (() => {});
}

// --- Run / submit -------------------------------------------------------

interface RunArgs {
  contestId: string;
  problemId: string | number;
  code: string;
}

interface SubmitArgs extends RunArgs {
  studentName: string;
  studentRollNumber: string;
}

export async function runCode({ contestId, problemId, code }: RunArgs) {
  const contestAPI = getContestAPI();
  if (contestAPI?.runCode) {
    return contestAPI.runCode({ contestId, problemId, code });
  }
  return apiFetch(`/api/contests/${contestId}/problems/${problemId}/submit`, {
    method: "POST",
    body: JSON.stringify({ code, mode: "run" }),
  });
}

// Returns the judge result plus the `localId` it was recorded under, so the
// caller can save a matching copy into this browser's local submission
// history (see lib/localSubmissions.ts) - submissions live client-side only,
// the server call here is just for judging + the leaderboard.
export async function submitCode({ contestId, problemId, code, studentName, studentRollNumber }: SubmitArgs) {
  const localId = crypto.randomUUID();
  const contestAPI = getContestAPI();
  const result = contestAPI?.submitCode
    ? await contestAPI.submitCode({ contestId, problemId, code, studentName, studentRollNumber, localId })
    : await apiFetch(`/api/contests/${contestId}/problems/${problemId}/submit`, {
        method: "POST",
        body: JSON.stringify({ code, mode: "submit", studentName, studentRollNumber, localId }),
      });
  return { ...result, localId };
}

// --- Standalone compiler (no contest/problem context) ---------------------

export async function runStandalone({ code, input }: { code: string; input: string }) {
  const contestAPI = getContestAPI();
  if (contestAPI?.runStandalone) {
    return contestAPI.runStandalone({ code, input });
  }
  return apiFetch("/api/compile/run", {
    method: "POST",
    body: JSON.stringify({ code, input }),
  });
}
