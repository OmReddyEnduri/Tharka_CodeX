// Monaco only ships 4 built-in themes (vs, vs-dark, hc-black, hc-light).
// These are hand-defined popular editor themes registered via
// monaco.editor.defineTheme() - call registerCustomMonacoThemes(monaco) once
// from an <Editor beforeMount={...}> callback before using them by name.
export const CUSTOM_MONACO_THEMES = ["dracula", "monokai", "nord", "github-light"] as const;

let registered = false;

export function registerCustomMonacoThemes(monaco: any): void {
  if (registered) return;
  registered = true;

  monaco.editor.defineTheme("dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "string", foreground: "f1fa8c" },
      { token: "number", foreground: "bd93f9" },
      { token: "type", foreground: "8be9fd" },
      { token: "function", foreground: "50fa7b" },
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editorCursor.foreground": "#f8f8f2",
      "editor.lineHighlightBackground": "#44475a",
      "editorLineNumber.foreground": "#6272a4",
      "editor.selectionBackground": "#44475a",
    },
  });

  monaco.editor.defineTheme("monokai", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "75715e" },
      { token: "keyword", foreground: "f92672" },
      { token: "string", foreground: "e6db74" },
      { token: "number", foreground: "ae81ff" },
      { token: "type", foreground: "66d9ef" },
      { token: "function", foreground: "a6e22e" },
    ],
    colors: {
      "editor.background": "#272822",
      "editor.foreground": "#f8f8f2",
      "editorCursor.foreground": "#f8f8f0",
      "editor.lineHighlightBackground": "#3e3d32",
      "editorLineNumber.foreground": "#90908a",
      "editor.selectionBackground": "#49483e",
    },
  });

  monaco.editor.defineTheme("nord", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "616e88" },
      { token: "keyword", foreground: "81a1c1" },
      { token: "string", foreground: "a3be8c" },
      { token: "number", foreground: "b48ead" },
      { token: "type", foreground: "8fbcbb" },
      { token: "function", foreground: "88c0d0" },
    ],
    colors: {
      "editor.background": "#2e3440",
      "editor.foreground": "#d8dee9",
      "editorCursor.foreground": "#d8dee9",
      "editor.lineHighlightBackground": "#3b4252",
      "editorLineNumber.foreground": "#4c566a",
      "editor.selectionBackground": "#434c5e",
    },
  });

  monaco.editor.defineTheme("github-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a737d" },
      { token: "keyword", foreground: "d73a49" },
      { token: "string", foreground: "032f62" },
      { token: "number", foreground: "005cc5" },
      { token: "type", foreground: "6f42c1" },
      { token: "function", foreground: "6f42c1" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292e",
      "editorCursor.foreground": "#24292e",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editorLineNumber.foreground": "#1b1f234d",
      "editor.selectionBackground": "#0366d625",
    },
  });
}
