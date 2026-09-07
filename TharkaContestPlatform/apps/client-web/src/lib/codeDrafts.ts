// Per-problem code drafts, the way LeetCode remembers whatever you last had
// in the editor for each question - close the tab, reopen the problem days
// later, your work in progress is still there.
//
// Kept in this laptop's local storage, alongside the submission history in
// lib/localSubmissions.ts and for the same reason: it must survive the server
// being briefly unreachable, and it is per-laptop data the server has no
// business storing. Nothing here is ever synced.
//
// Keyed by contest + problem + roll number so two students sharing a lab
// laptop for the same contest never inherit each other's in-progress code.
// The standalone /compiler page has no contest or identity, so it uses one
// fixed key of its own.
const PREFIX = "contest_code_draft_";
const COMPILER_KEY = `${PREFIX}compiler`;

function draftKey(contestId: string, problemId: string | number, rollNumber: string): string {
  return `${PREFIX}${contestId}:${problemId}:${rollNumber}`;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, code: string): void {
  try {
    localStorage.setItem(key, code);
  } catch {
    // Quota exceeded or private mode. The editor keeps working in memory;
    // silently losing the draft is strictly better than breaking typing.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to undo if the write never landed */
  }
}

export function getDraft(
  contestId: string,
  problemId: string | number,
  rollNumber: string
): string | null {
  return read(draftKey(contestId, problemId, rollNumber));
}

export function saveDraft(
  contestId: string,
  problemId: string | number,
  rollNumber: string,
  code: string
): void {
  write(draftKey(contestId, problemId, rollNumber), code);
}

export function clearDraft(
  contestId: string,
  problemId: string | number,
  rollNumber: string
): void {
  remove(draftKey(contestId, problemId, rollNumber));
}

export function getCompilerDraft(): string | null {
  return read(COMPILER_KEY);
}

export function saveCompilerDraft(code: string): void {
  write(COMPILER_KEY, code);
}

export function clearCompilerDraft(): void {
  remove(COMPILER_KEY);
}
