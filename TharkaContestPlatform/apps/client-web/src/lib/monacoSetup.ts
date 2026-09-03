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
