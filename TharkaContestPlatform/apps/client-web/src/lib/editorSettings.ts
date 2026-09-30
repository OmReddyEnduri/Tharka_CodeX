// Monaco editor preferences (theme / font size / keybinding), persisted per
// laptop like LeetCode's editor settings - previously these reset to the
// defaults on every page load, which made the settings dialog feel broken
// once the code template next to it started persisting.
//
// Deliberately separate from the app-wide theme in lib/theme.ts: the editor
// theme is independent of the page chrome, the same way real IDEs keep them
// apart. See CLAUDE.md's Theming section.
export interface EditorSettings {
  theme: string;
  fontSize: number;
  keybinding: string;
  /** Compiler page only: an extra "Debug" tab that shows just stderr (cerr)
   *  output, separate from stdout. Off by default - most runs don't write
   *  to stderr, so the extra tab would just be visual noise for them. */
  debugPanelEnabled: boolean;
  /** Compiler page only: compiles with -DLOCAL, for templates that gate
   *  debug-print macros (e.g. `#ifdef LOCAL`) behind it. On by default per
   *  explicit user request - note this can collide with a template that
   *  also does `#ifdef LOCAL { freopen(...) }`, redirecting stdout/stderr
   *  to files instead of this app's live pipes; that's a property of the
   *  student's own code, not something this setting can detect or avoid. */
  defineLocalMacro: boolean;
}

const STORAGE_KEY = "contest_editor_settings";

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  theme: "vs-dark",
  fontSize: 14,
  keybinding: "default",
  debugPanelEnabled: false,
  defineLocalMacro: true,
};

export function getEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_SETTINGS;
    // Spread over the defaults so a settings blob written by an older build
    // (missing a key added later) still yields a complete object.
    return { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_EDITOR_SETTINGS;
  }
}

export function saveEditorSettings(settings: EditorSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode / storage full - settings still apply for this session */
  }
}
