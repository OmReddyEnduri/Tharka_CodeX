// @monaco-editor/react's default loader fetches Monaco's core AMD bundle
// from a live CDN (cdn.jsdelivr.net) the first time any <Editor> mounts -
// unless told otherwise. On a lab laptop with no internet, that request
// just hangs/fails, so the code editor (the actual compiler UI, on both
// /compiler and the in-contest problem page) never renders. This points the
// loader at the `monaco-editor` package bundled into our own build instead,
// so it never touches the network. Import this once, before any <Editor>
// mounts (done in main.tsx).
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

// Monaco needs a background worker for core editor features (find/replace,
// diff, etc). "cpp" is a "basic" language in Monaco (syntax highlighting via
// a regex tokenizer only, no language service), so the generic editor
// worker is the only one this app ever needs - no per-language workers
// (typescript/json/css/html) to wire up.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite's `?worker` import suffix has no bundled type declaration.
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

loader.config({ monaco });

// Monaco's built-in "cpp" language is a "basic" one - highlighting only, no
// language service - so out of the box its auto-indent on Enter is just a
// generic bracket heuristic with no idea about `case`/`default` labels or
// `/* ... */` block-comment continuation, which looks wrong for real C++
// (e.g. a `case` body not indenting, or every line after `/**` losing its
// leading ` * `). This replaces that with the same shape of language
// configuration VS Code itself ships for C/C++: brace/paren/bracket-based
// indent/outdet, a `case`/`default` label indents its body once, and typing
// Enter inside a block comment continues it with a leading " * ". Runs once
// at import time (before any <Editor> mounts), same as the loader config
// above - it's a language-level setting, not per-editor-instance, so every
// cpp editor in the app (Compiler, ContestProblem, the template editor) gets
// it automatically with no per-page wiring.
monaco.languages.setLanguageConfiguration("cpp", {
  comments: { lineComment: "//", blockComment: ["/*", "*/"] },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "'", close: "'", notIn: ["string", "comment"] },
    { open: '"', close: '"', notIn: ["string"] },
    { open: "/**", close: " */", notIn: ["string"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  indentationRules: {
    // A line ending in an unclosed `{`, `(` or `[` (ignoring `//` line
    // comments) indents the next line once.
    increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
    // A line starting with a closing bracket (after any leading whitespace,
    // and not inside a `/* ... */` that closes earlier on the same line)
    // outdents once.
    decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[}\)\]].*$/,
  },
  onEnterRules: [
    // `/** ...` followed by Enter, with nothing after the cursor: continue
    // the doc comment and auto-insert the closing ` */` on its own line.
    {
      beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/,
      afterText: /^\s*\*\/$/,
      action: { indentAction: monaco.languages.IndentAction.IndentOutdent, appendText: " * " },
    },
    // Same, but there's already text after the cursor - just continue with " * ".
    {
      beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/,
      action: { indentAction: monaco.languages.IndentAction.None, appendText: " * " },
    },
    // Already inside a " * ..." continuation line - keep continuing it.
    {
      beforeText: /^(\t|[ ])*[ ]\*([ ]([^*]|\*(?!\/))*)?$/,
      action: { indentAction: monaco.languages.IndentAction.None, appendText: "* " },
    },
    // The line is just " */" (closing the comment) - stop continuing it.
    {
      beforeText: /^(\t|[ ])*[ ]\*\/\s*$/,
      action: { indentAction: monaco.languages.IndentAction.None, removeText: 1 },
    },
    // A bare `case X:`/`default:` label with nothing after it on the same
    // line: indent its body once. (If another case/default label follows
    // immediately after the cursor, don't - that's a fallthrough stack of
    // labels, which should stay at the same indent as each other.)
    {
      beforeText: /^\s*(case\b.*:|default:)\s*$/,
      afterText: /^\s*(case\b.*:|default:)/,
      action: { indentAction: monaco.languages.IndentAction.None },
    },
    {
      beforeText: /^\s*(case\b.*:|default:)\s*$/,
      action: { indentAction: monaco.languages.IndentAction.Indent },
    },
  ],
});

// Custom editor-instance keybindings that need the focused editor's own
// action (not just a key combo), so they can't be done as a page-level
// `window.keydown` capture listener the way every other shortcut in this app
// is - see Compiler.tsx/ContestProblem.tsx for those. Pass as an <Editor
// onMount={registerCustomKeybindings}>.
//
// Ctrl+Shift+Down/Up - "move line down/up", Sublime Text's binding for this
// (Monaco's own default is Alt+Down/Up, which still works; this just adds a
// second, unclaimed combo on top of it).
export function registerCustomKeybindings(editor: monaco.editor.IStandaloneCodeEditor, monacoNs: typeof monaco): void {
  editor.addCommand(monacoNs.KeyMod.CtrlCmd | monacoNs.KeyMod.Shift | monacoNs.KeyCode.DownArrow, () => {
    editor.getAction("editor.action.moveLinesDownAction")?.run();
  });
  editor.addCommand(monacoNs.KeyMod.CtrlCmd | monacoNs.KeyMod.Shift | monacoNs.KeyCode.UpArrow, () => {
    editor.getAction("editor.action.moveLinesUpAction")?.run();
  });
}
