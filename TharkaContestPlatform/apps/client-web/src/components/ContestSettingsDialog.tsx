import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { RotateCcw, Save, ClipboardPaste } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { registerCustomMonacoThemes } from "@/lib/monacoThemes";
import { DEFAULT_TEMPLATE, getTemplate, resetTemplate, saveTemplate } from "@/lib/codeTemplate";
import type { EditorSettings } from "@/lib/editorSettings";

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
}

export const SettingsDialog = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  currentCode,
  shortcuts,
}: SettingsDialogProps) => {
  // Draft copy, so editing the template in here stays discardable - it only
  // becomes the saved template when "Save template" is pressed. Re-read on
  // every open so a template saved from another page shows up here.
  const [templateDraft, setTemplateDraft] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    if (isOpen) setTemplateDraft(getTemplate());
  }, [isOpen]);

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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                beforeMount={registerCustomMonacoThemes}
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
