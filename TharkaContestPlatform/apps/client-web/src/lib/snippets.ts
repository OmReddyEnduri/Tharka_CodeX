// User-defined code snippets for the Monaco editor (VS Code style): type a
// `prefix`, pick the suggestion, and it expands into `body` - which can use
// Monaco's own snippet syntax ($1, ${1:placeholder}, $0 for the final cursor
// position). Global and per-laptop, not synced - same precedent as
// codeTemplate.ts/editorSettings.ts (see CLAUDE.md's Editor persistence
// section).

export interface Snippet {
  id: string;
  prefix: string;
  name: string;
  body: string;
}

const STORAGE_KEY = "contest_snippets";

export function getSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSnippets(snippets: Snippet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  } catch {
    /* private mode / storage full - snippets still apply for this session */
  }
}

export function addSnippet(snippet: Omit<Snippet, "id">): Snippet[] {
  const next = [...getSnippets(), { ...snippet, id: crypto.randomUUID() }];
  saveSnippets(next);
  return next;
}

export function deleteSnippet(id: string): Snippet[] {
  const next = getSnippets().filter((s) => s.id !== id);
  saveSnippets(next);
  return next;
}

export function updateSnippet(id: string, patch: Omit<Snippet, "id">): Snippet[] {
  const next = getSnippets().map((s) => (s.id === id ? { ...s, ...patch } : s));
  saveSnippets(next);
  return next;
}
