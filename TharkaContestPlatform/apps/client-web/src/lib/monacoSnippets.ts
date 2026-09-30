// Registers user snippets (lib/snippets.ts) as Monaco completion items for
// the "cpp" language - type a snippet's `prefix`, it shows up in the normal
// autocomplete list, and accepting it expands `body` (which may use Monaco's
// $1/${1:placeholder}/$0 tab-stop syntax). Call registerSnippetProvider(monaco)
// once from an <Editor beforeMount={...}> callback, same pattern as
// registerCustomMonacoThemes in monacoThemes.ts.
//
// Reads getSnippets() fresh on every completion request rather than once at
// registration time, so editing snippets in the settings dialog takes effect
// immediately without needing to remount any editor.
import { getSnippets } from "./snippets";

let registered = false;

export function registerSnippetProvider(monaco: any): void {
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider("cpp", {
    provideCompletionItems(model: any, position: any) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: getSnippets().map((s) => ({
          label: s.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: s.name,
          range,
        })),
      };
    },
  });
}
