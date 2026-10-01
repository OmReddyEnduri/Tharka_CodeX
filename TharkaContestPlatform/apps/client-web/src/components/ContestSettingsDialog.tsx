import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { RotateCcw, Save, ClipboardPaste, Plus, Trash2, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { registerCustomMonacoThemes } from "@/lib/monacoThemes";
import { registerSnippetProvider } from "@/lib/monacoSnippets";
import { DEFAULT_TEMPLATE, getTemplate, resetTemplate, saveTemplate } from "@/lib/codeTemplate";
import { addSnippet, deleteSnippet, getSnippets, updateSnippet, type Snippet } from "@/lib/snippets";
import type { EditorSettings } from "@/lib/editorSettings";

function registerTemplateEditorExtras(monaco: any): void {
  registerCustomMonacoThemes(monaco);
  registerSnippetProvider(monaco);
}

export interface ShortcutHint {
  keys: string;
  label: string;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onSettingsChange: (newSettings: EditorSettings) => void;
  /** Whatever is in the main editor right now, for "Use current code". */
  currentCode?: string;
  /** Optional keyboard-shortcut cheatsheet, rendered at the bottom. */
  shortcuts?: ShortcutHint[];
  /** Lets the page hand focus back to the code editor when this closes. */
  onCloseAutoFocus?: (e: Event) => void;
}

export const SettingsDialog = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  currentCode,
  shortcuts,
  onCloseAutoFocus,
}: SettingsDialogProps) => {
  // Draft copy, so editing the template in here stays discardable - it only
  // becomes the saved template when "Save template" is pressed. Re-read on
  // every open so a template saved from another page shows up here.
  const [templateDraft, setTemplateDraft] = useState(DEFAULT_TEMPLATE);

  // Snippets list, re-read on every open the same way the template draft is,
  // so edits made from another page's settings dialog show up here too.
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [newPrefix, setNewPrefix] = useState("");
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTemplateDraft(getTemplate());
      setSnippets(getSnippets());
    }
  }, [isOpen]);

  const handleAddSnippet = () => {
    if (!newPrefix.trim() || !newBody.trim()) {
      toast.error("A snippet needs at least a prefix and a body");
      return;
    }
    setSnippets(addSnippet({ prefix: newPrefix.trim(), name: newName.trim() || newPrefix.trim(), body: newBody }));
    setNewPrefix("");
    setNewName("");
    setNewBody("");
    toast.success("Snippet added");
  };

  const handleDeleteSnippet = (id: string) => {
    setSnippets(deleteSnippet(id));
  };

  const handleSaveTemplate = () => {
    saveTemplate(templateDraft);
    toast.success("Template saved", {
      description: "New problems and the compiler will start from this code.",
    });
  };

  const handleResetTemplate = () => {
    resetTemplate();
    setTemplateDraft(DEFAULT_TEMPLATE);
    toast.success("Template reset to the default C++ stub.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={onCloseAutoFocus}
        // Escape pressed to dismiss one of Monaco's own popups (suggest,
        // find, parameter hints) in the template editor must not also close
        // this dialog and throw away the unsaved template draft.
        onEscapeKeyDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest?.(".monaco-editor")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Editor Settings</DialogTitle>
          <DialogDescription>
            Customize your coding environment. Saved on this computer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 items-center">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(value) => onSettingsChange({ ...settings, theme: value })}
            >
              <SelectTrigger id="theme">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vs">VS Light</SelectItem>
                <SelectItem value="vs-dark">VS Dark</SelectItem>
                <SelectItem value="hc-black">High Contrast Dark</SelectItem>
                <SelectItem value="hc-light">High Contrast Light</SelectItem>
                <SelectItem value="dracula">Dracula</SelectItem>
                <SelectItem value="monokai">Monokai</SelectItem>
                <SelectItem value="nord">Nord</SelectItem>
                <SelectItem value="github-light">GitHub Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-center">
            <Label htmlFor="font-size">Font Size</Label>
            <Select
              value={String(settings.fontSize)}
              onValueChange={(value) => onSettingsChange({ ...settings, fontSize: Number(value) })}
            >
              <SelectTrigger id="font-size">
                <SelectValue placeholder="Font Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="14">14</SelectItem>
                <SelectItem value="16">16</SelectItem>
                <SelectItem value="18">18</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="24">24</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-center">
            <Label htmlFor="keybinding">Keybinding</Label>
            <Select
              value={settings.keybinding}
              onValueChange={(value) => onSettingsChange({ ...settings, keybinding: value })}
            >
              <SelectTrigger id="keybinding">
                <SelectValue placeholder="Keybinding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="vim">Vim</SelectItem>
                <SelectItem value="emacs">Emacs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="debug-panel">Debug panel</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Compiler page: a side panel next to the output, showing just stderr (cerr)</p>
            </div>
            <input
              id="debug-panel"
              type="checkbox"
              className="h-4 w-4 mt-0.5 accent-primary flex-shrink-0"
              checked={settings.debugPanelEnabled}
              onChange={(e) => onSettingsChange({ ...settings, debugPanelEnabled: e.target.checked })}
            />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="define-local">Define LOCAL when compiling</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compiler page only. Activates <code>#ifdef LOCAL</code> debug macros in your template. If your
                template also does <code>freopen(...)</code> under <code>#ifdef LOCAL</code>, turn this off or
                remove that block - it would redirect stdout/stderr to files instead of showing here.
              </p>
            </div>
            <input
              id="define-local"
              type="checkbox"
              className="h-4 w-4 mt-0.5 accent-primary flex-shrink-0"
              checked={settings.defineLocalMacro}
              onChange={(e) => onSettingsChange({ ...settings, defineLocalMacro: e.target.checked })}
            />
          </div>

          {/* --- Code template ------------------------------------------- */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <Label>Code Template</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every new problem and the compiler start from this code.
                </p>
              </div>
              <div className="flex items-center gap-1">
                {currentCode !== undefined && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTemplateDraft(currentCode)}
                    title="Replace the template below with what is in the editor right now"
                  >
                    <ClipboardPaste className="h-3 w-3" /> Use current code
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetTemplate}
                  title="Restore the built-in C++ stub"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Editor
                height="200px"
                defaultLanguage="cpp"
                theme={settings.theme}
                beforeMount={registerTemplateEditorExtras}
                value={templateDraft}
                onChange={(value) => setTemplateDraft(value ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8 },
                  // Monaco's default ('matchingDocuments') pulls word-based
                  // suggestions from every open cpp editor on the page - with
                  // this template editor and the main code editor both
                  // mounted at once, typing here suggested random words out
                  // of whatever the student had in their actual code.
                  wordBasedSuggestions: "currentDocument",
                }}
              />
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveTemplate}>
                <Save className="h-3 w-3" /> Save template
              </Button>
            </div>
          </div>

          {/* --- Snippets -------------------------------------------------- */}
          <div className="border-t pt-4 space-y-2">
            <div>
              <Label>Snippets</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Type a prefix in the editor to insert its body. Use $1, $2, $0 for tab stops.
              </p>
            </div>

            {snippets.length > 0 && (
              <div className="space-y-1">
                {snippets.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                    <div className="flex items-center gap-2 text-xs overflow-hidden">
                      <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px] font-semibold flex-shrink-0">{s.prefix}</kbd>
                      <span className="text-muted-foreground truncate">{s.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => handleDeleteSnippet(s.id)}
                      title="Delete snippet"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5 rounded border p-2">
              <div className="flex gap-2">
                <Input placeholder="Prefix (e.g. fori)" value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
              </div>
              <Textarea
                placeholder={"for (int i = 0; i < $1; i++) {\n\t$0\n}"}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                className="font-mono text-xs min-h-[70px] resize-none"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddSnippet}>
                  <Plus className="h-3 w-3" /> Add snippet
                </Button>
              </div>
            </div>
          </div>

          {/* --- Shortcuts cheatsheet ------------------------------------ */}
          {shortcuts && shortcuts.length > 0 && (
            <div className="border-t pt-4">
              <Label>Keyboard Shortcuts</Label>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
                {shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px] font-semibold whitespace-nowrap">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
