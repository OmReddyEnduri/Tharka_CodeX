import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import screenfull from "screenfull";
import {
  Play,
  Square,
  Loader2,
  ChevronLeft,
  Settings,
  Maximize2,
  Minimize2,
  Code2,
  Save,
  FolderOpen,
  FilePlus2,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  FileCode,
  FolderClosed,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Bug,
  FolderPlus,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SettingsDialog, type ShortcutHint } from "@/components/ContestSettingsDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UpdateStatusIndicator } from "@/components/UpdateStatusIndicator";
import { runStandalone, getServerUrl } from "@/lib/apiClient";
import { registerCustomMonacoThemes } from "@/lib/monacoThemes";
import { registerSnippetProvider } from "@/lib/monacoSnippets";
import { registerCustomKeybindings } from "@/lib/monacoSetup";
import { getTemplate } from "@/lib/codeTemplate";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getCompilerDraft, saveCompilerDraft, clearCompilerDraft } from "@/lib/codeDrafts";
import { getEditorSettings, saveEditorSettings, type EditorSettings } from "@/lib/editorSettings";
import {
  openCodeFile,
  saveCodeFile,
  fileAccessMode,
  canSaveInPlace,
  hasWorkspace,
  listWorkspaceEntries,
  openWorkspaceFile,
  createWorkspaceFile,
  createWorkspaceFolder,
  moveWorkspaceEntry,
  getWorkspaceDir,
  type EditorFile,
  type WorkspaceEntry,
} from "@/lib/fileIO";

// A freeform "online compiler" page (no contest/problem context), modeled
// on OneCompiler's layout: editor on one side, a Console/I-O tabbed panel
// on the other, one Run button that drives whichever tab is active.
//   - Console: a live interactive terminal - the process's stdin stays open
//     while it runs, so you can type input as it's prompted for, like a
//     real terminal. Feature-detects window.contestAPI (Electron's IPC
//     bridge to a local judge-cpp InteractiveSession, no network involved)
//     and only falls back to a direct Socket.IO session against the server
//     when that's absent (plain browser build) - same seam as everywhere
//     else in apiClient.ts, just not routed through that file since this is
//     a stream of events rather than a single request/response.
//   - I/O: simpler batch mode - paste fixed input up front, run once, see
//     the full stdout/stderr at the end (reuses /api/compile/run via apiClient).
//
// The buffer itself behaves like a desktop editor: it autosaves as a draft
// (lib/codeDrafts.ts) so closing the app never loses work, and it can be
// opened from / saved to a real file on disk (lib/fileIO.ts, Ctrl+O/Ctrl+S).

const SHORTCUTS: ShortcutHint[] = [
  { keys: "Ctrl+B", label: "Run" },
  { keys: "Ctrl+Q", label: "Stop" },
  { keys: "Ctrl+S", label: "Save file" },
  { keys: "Ctrl+Shift+S", label: "Save as" },
  { keys: "Ctrl+O", label: "Open file" },
  { keys: "Ctrl+Shift+↓", label: "Move line down" },
  { keys: "Ctrl+Shift+↑", label: "Move line up" },
  { keys: "Ctrl+Click", label: "Add cursor" },
  { keys: "Ctrl+Alt+↓", label: "Add cursor below" },
  { keys: "Ctrl+D", label: "Select next occurrence" },
  { keys: "Ctrl+Shift+L", label: "Select all occurrences" },
];

function registerCompilerEditorExtras(monaco: any): void {
  registerCustomMonacoThemes(monaco);
  registerSnippetProvider(monaco);
}

const MAX_TERMINAL_LINES = 2000;

type TerminalLine = { type: "stdout" | "stderr" | "input" | "system"; text: string };

function exitLabel(info: any): string {
  if (info.status === "Exited") return `Program exited (code ${info.code})`;
  if (info.status === "Error" || info.status === "Compilation Error") return `${info.status}: ${info.message || ""}`;
  return info.status;
}

export default function Compiler() {
  // Restore whatever was last in the editor on this laptop; fall back to the
  // saved template (settings dialog) and finally the built-in stub.
  const [code, setCode] = useState<string>(() => getCompilerDraft() ?? getTemplate());
  // The live Monaco editor instance, so Save can run a real editor action
  // (reindent) on it - see handleSave below.
  const editorRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState<"console" | "io">("console");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(getEditorSettings);
  const [copied, setCopied] = useState(false);

  // --- File on disk ---
  const [currentFile, setCurrentFile] = useState<EditorFile | null>(null);
  // Snapshot of the code as it was last written to / read from disk, so the
  // tab can show an unsaved-changes dot. Null when there is no file yet.
  const [lastSavedCode, setLastSavedCode] = useState<string | null>(null);
  const isDirty = currentFile !== null && code !== lastSavedCode;

  const handleEditorSettingsChange = (next: EditorSettings) => {
    setEditorSettings(next);
    saveEditorSettings(next);
  };

  // Debounced draft autosave - localStorage writes are synchronous, so doing
  // one per keystroke would stutter the editor on a slow lab laptop.
  useEffect(() => {
    const id = setTimeout(() => saveCompilerDraft(code), 500);
    return () => clearTimeout(id);
  }, [code]);

  // The debounce above cancels its pending save on every keystroke's own
  // cleanup, by design - but that also cancelled it on navigation, so typing
  // a final line and immediately clicking Home within 500ms could drop that
  // last edit. Separate effect with empty deps so its cleanup fires exactly
  // once, on actual unmount, reading the latest code from a ref instead of
  // depending on it directly (which would just re-create the same bug the
  // debounce effect above already has by design).
  const latestCodeRef = useRef(code);
  latestCodeRef.current = code;
  useEffect(() => {
    return () => saveCompilerDraft(latestCodeRef.current);
  }, []);

  // --- Console tab: live interactive terminal ---
  const socketRef = useRef<Socket | null>(null);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [inputLine, setInputLine] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // A program that prints in a tight loop can emit tens of thousands of
  // chunks a second. One setState per chunk re-rendered this whole page (and
  // copied the ever-growing line array) each time, freezing the UI. Chunks
  // are buffered and flushed at most once per animation frame, and only the
  // newest MAX_TERMINAL_LINES lines are kept.
  const pendingLinesRef = useRef<TerminalLine[]>([]);
  const flushRafRef = useRef<number | null>(null);
  const appendTerminal = useCallback((line: TerminalLine) => {
    pendingLinesRef.current.push(line);
    if (flushRafRef.current !== null) return;
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null;
      const batch = pendingLinesRef.current;
      pendingLinesRef.current = [];
      setTerminal((t) => {
        const next = t.concat(batch);
        return next.length > MAX_TERMINAL_LINES ? next.slice(next.length - MAX_TERMINAL_LINES) : next;
      });
    });
  }, []);
  const resetTerminal = (lines: TerminalLine[]) => {
    pendingLinesRef.current = [];
    setTerminal(lines);
  };
  useEffect(() => () => {
    if (flushRafRef.current !== null) cancelAnimationFrame(flushRafRef.current);
  }, []);

  useEffect(() => {
    const contestAPI = (window as any).contestAPI;

    if (contestAPI?.onInteractiveStdout) {
      const offStdout = contestAPI.onInteractiveStdout((chunk: string) => appendTerminal({ type: "stdout", text: chunk }));
      const offStderr = contestAPI.onInteractiveStderr((chunk: string) => appendTerminal({ type: "stderr", text: chunk }));
      const offExit = contestAPI.onInteractiveExit((info: any) => {
        setTerminalRunning(false);
        appendTerminal({ type: "system", text: exitLabel(info) });
      });
      return () => {
        offStdout?.();
        offStderr?.();
        offExit?.();
      };
    }

    const socket = io(`${getServerUrl()}/compiler`, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("stdout", (chunk: string) => appendTerminal({ type: "stdout", text: chunk }));
    socket.on("stderr", (chunk: string) => appendTerminal({ type: "stderr", text: chunk }));
    socket.on("exit", (info: any) => {
      setTerminalRunning(false);
      appendTerminal({ type: "system", text: exitLabel(info) });
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [terminal]);

  const runInteractive = () => {
    resetTerminal([{ type: "system", text: "Running..." }]);
    setTerminalRunning(true);
    const contestAPI = (window as any).contestAPI;
    if (contestAPI?.startInteractive) {
      contestAPI.startInteractive(code, editorSettings.defineLocalMacro);
    } else {
      socketRef.current?.emit("run", { code, defineLocal: editorSettings.defineLocalMacro });
    }
  };

  const stopInteractive = () => {
    const contestAPI = (window as any).contestAPI;
    if (contestAPI?.stopInteractive) {
      contestAPI.stopInteractive();
    } else {
      socketRef.current?.emit("stop");
    }
    setTerminalRunning(false);
    appendTerminal({ type: "system", text: "Stopped." });
  };

  const sendInputLine = () => {
    if (!terminalRunning) return;
    const contestAPI = (window as any).contestAPI;
    if (contestAPI?.sendInteractiveInput) {
      contestAPI.sendInteractiveInput(inputLine + "\n");
    } else {
      socketRef.current?.emit("input", inputLine + "\n");
    }
    appendTerminal({ type: "input", text: inputLine });
    setInputLine("");
  };

  // --- I/O tab: batch mode ---
  const [ioInput, setIoInput] = useState("");
  const [ioResult, setIoResult] = useState<any>(null);
  const [ioRunning, setIoRunning] = useState(false);

  const runBatch = async () => {
    setIoRunning(true);
    setIoResult(null);
    try {
      const data = await runStandalone({ code, input: ioInput, defineLocal: editorSettings.defineLocalMacro });
      setIoResult(data);
    } catch (err: any) {
      setIoResult({ status: "Error", message: err.message || "Failed to connect to server" });
    } finally {
      setIoRunning(false);
    }
  };

  const running = activeTab === "console" ? terminalRunning : ioRunning;
  const handleRun = activeTab === "console" ? runInteractive : runBatch;

  // --- File actions ---
  // In the download-fallback tier (a plain browser over http on a LAN IP,
  // where the File System Access API is unavailable) there is no handle to
  // reuse, so every save is really "download a copy" - say so on the button
  // rather than implying an in-place overwrite that isn't happening.
  const savesByDownload = fileAccessMode() === "download";

  // --- Workspace folder (left sidebar) ---
  // Electron-only "Tharka Codex" folder on the Desktop - see fileIO.ts. Not
  // a replacement for Save/Open (still one-off native dialogs that can point
  // anywhere), just a standing, navigable tree of what's already there -
  // Sublime-style: folders expand/collapse, and New File/New Folder create
  // inside whichever folder was last clicked (the workspace root by default).
  const hasWorkspaceFeature = hasWorkspace();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const showWorkspaceSidebar = hasWorkspaceFeature && sidebarVisible;
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  // Keyed by relative path ("" is the workspace root itself) - only loaded
  // lazily, on first expand, so opening the sidebar never has to walk the
  // whole tree up front.
  const [treeCache, setTreeCache] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState(""); // where New File/Folder land
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [creating, setCreating] = useState<{ parent: string; type: "file" | "folder" } | null>(null);
  const [newEntryName, setNewEntryName] = useState("");

  const loadFolder = useCallback(
    async (relDir: string) => {
      if (!hasWorkspaceFeature) return;
      setLoadingWorkspace(true);
      try {
        const entries = await listWorkspaceEntries(relDir);
        setTreeCache((prev) => ({ ...prev, [relDir]: entries }));
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [hasWorkspaceFeature]
  );

  useEffect(() => {
    loadFolder("");
    getWorkspaceDir().then(setWorkspaceDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFolder = (relPath: string) => {
    setSelectedFolder(relPath);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) {
        next.delete(relPath);
      } else {
        next.add(relPath);
        if (!treeCache[relPath]) loadFolder(relPath);
      }
      return next;
    });
  };

  const startCreating = (type: "file" | "folder") => {
    const parent = selectedFolder;
    setExpandedFolders((prev) => new Set(prev).add(parent));
    if (!treeCache[parent]) loadFolder(parent);
    setNewEntryName("");
    setCreating({ parent, type });
  };

  const commitCreating = async () => {
    if (!creating) return;
    const name = newEntryName.trim();
    setCreating(null);
    if (!name) return;
    const relPath = creating.parent ? `${creating.parent}/${name}` : name;
    try {
      if (creating.type === "file") {
        await createWorkspaceFile(relPath);
        await loadFolder(creating.parent);
        const opened = await openWorkspaceFile(relPath);
        if (opened) {
          setCode(opened.code);
          setCurrentFile(opened.file);
          setLastSavedCode(opened.code);
        }
        toast.success(`Created ${name}`);
      } else {
        await createWorkspaceFolder(relPath);
        await loadFolder(creating.parent);
        toast.success(`Created folder ${name}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not create it");
    }
  };

  // --- Drag-and-drop moves in the sidebar (Sublime-style) ---
  const draggedPathRef = useRef<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const toAbsoluteWorkspacePath = (relPath: string) =>
    workspaceDir ? `${workspaceDir}\\${relPath.split("/").join("\\")}` : null;

  const handleDropEntry = async (toDir: string) => {
    const from = draggedPathRef.current;
    draggedPathRef.current = null;
    setDragOverFolder(null);
    if (!from) return;
    const fromParent = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    if (fromParent === toDir) return; // already there
    const movedName = from.split("/").pop()!;
    try {
      await moveWorkspaceEntry(from, toDir);
      await loadFolder(fromParent);
      await loadFolder(toDir);
      // Keep Ctrl+S pointed at the right place if the moved file is the one open.
      const oldAbs = toAbsoluteWorkspacePath(from);
      if (currentFile?.path && oldAbs && currentFile.path.toLowerCase() === oldAbs.toLowerCase()) {
        const newRelPath = toDir ? `${toDir}/${movedName}` : movedName;
        const newAbs = toAbsoluteWorkspacePath(newRelPath);
        if (newAbs) setCurrentFile((f) => (f ? { ...f, path: newAbs } : f));
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not move it");
    }
  };

  const handleSave = useCallback(
    async (saveAs = false, silent = false) => {
      try {
        // On an explicit save, clean up indentation across the whole file
        // first (using the cpp indentation rules from monacoSetup.ts) - not
        // on the silent 5-second autosave, since reformatting the buffer out
        // from under someone who's mid-keystroke would be jarring.
        let codeToSave = code;
        if (!silent && editorRef.current) {
          editorRef.current.getAction("editor.action.reindentlines")?.run();
          codeToSave = editorRef.current.getValue();
          if (codeToSave !== code) setCode(codeToSave);
        }
        const saved = await saveCodeFile(codeToSave, currentFile, { saveAs, suggestedName: "Main.cpp" });
        if (!saved) return; // dialog cancelled
        setCurrentFile(saved);
        setLastSavedCode(codeToSave);
        if (!silent) {
          toast.success(savesByDownload ? `Downloaded ${saved.name}` : `Saved ${saved.name}`);
          loadFolder(""); // a fresh save with no path yet always lands in the workspace root - keep it in sync
        }
      } catch (err: any) {
        if (!silent) toast.error(err?.message || "Could not save the file");
      }
    },
    [code, currentFile, savesByDownload, loadFolder]
  );

  // Silent autosave to disk every 5s, on top of the 500ms draft-to-
  // localStorage autosave above - that one only protects against the app
  // closing, this one keeps the actual file on disk current too. Only fires
  // when there's something to save (isDirty) and only on a tier that can
  // truly save with zero prompt: Electron always can (even for a brand new
  // file - see fileIO.ts/main.js), the File System Access API only once a
  // handle already exists (its first-ever save still needs one picker,
  // which a silent background timer must never trigger), and the plain
  // download fallback never can (every "save" there is a fresh browser
  // download, not an overwrite) so it's excluded entirely.
  const autoSaveStateRef = useRef({ isDirty, handleSave, currentFile });
  autoSaveStateRef.current = { isDirty, handleSave, currentFile };

  useEffect(() => {
    const id = setInterval(() => {
      const { isDirty, handleSave, currentFile } = autoSaveStateRef.current;
      const mode = fileAccessMode();
      const eligible = mode === "native" || (mode === "picker" && canSaveInPlace(currentFile));
      if (isDirty && eligible) handleSave(false, true);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const opened = await openCodeFile();
      if (!opened) return; // dialog cancelled
      setCode(opened.code);
      setCurrentFile(opened.file);
      setLastSavedCode(opened.code);
      toast.success(`Opened ${opened.file.name}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not open the file");
    }
  }, []);

  const handleOpenWorkspaceFile = async (relPath: string) => {
    try {
      const opened = await openWorkspaceFile(relPath);
      if (!opened) return;
      setCode(opened.code);
      setCurrentFile(opened.file);
      setLastSavedCode(opened.code);
    } catch (err: any) {
      toast.error(err?.message || "Could not open the file");
    }
  };

  const handleNewFile = () => {
    setCode(getTemplate());
    setCurrentFile(null);
    setLastSavedCode(null);
    toast.success("New file started from your template.");
  };

  // Distinct from "New" above: this keeps the current file association (if
  // any) and just discards the in-editor code, so it reads as "start this
  // file over" rather than "open a different, unsaved file." Also clears the
  // draft autosave - otherwise the 500ms debounce would silently re-persist
  // the discarded code and the reset would appear to "undo itself" on reload.
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const handleResetToTemplate = () => {
    setConfirmResetOpen(false);
    clearCompilerDraft();
    // Detach from the file on disk: otherwise the code now differs from it,
    // isDirty flips on, and the 5s autosave silently overwrites the
    // student's real file with the template.
    setCurrentFile(null);
    setLastSavedCode(null);
    setCode(getTemplate());
    toast.success("Editor reset to your template.");
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const copyTerminal = async () => {
    const text = terminal
      .filter((l) => l.type !== "stderr")
      .map((l) => (l.type === "input" ? `> ${l.text}` : l.text))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Output copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleFullScreen = () => {
    if (screenfull.isEnabled) {
      screenfull.toggle();
      setIsFullScreen(!isFullScreen);
    } else {
      toast.error("Fullscreen is not supported in your browser");
    }
  };

  // Ctrl+B run / Ctrl+Q stop / Ctrl+S save / Ctrl+Shift+S save-as / Ctrl+O
  // open. Capture phase so this fires before Monaco's own keydown handling
  // swallows the event (Monaco stops propagation for a lot of key combos
  // otherwise), and before the browser's own Save Page / Open File defaults.
  // Stop only does anything on the Console tab's live session - the I/O
  // tab's single request/response has nothing to cancel once sent.
  //
  // Suspended while the settings dialog is open, so Ctrl+S in the template
  // editor in there doesn't save the main buffer to disk behind your back.
  //
  // Latest running/handleRun/activeTab/terminalRunning/handleSave/handleOpen
  // are read from a ref instead of being effect dependencies - handleRun and
  // handleSave get a new identity on every render (handleRun is a fresh
  // ternary every render; handleSave is a useCallback keyed on `code`, which
  // changes every keystroke), so depending on them directly here meant this
  // global window listener was torn down and re-added on every render,
  // including every character typed in the editor - same bug already fixed
  // in ContestProblem.tsx.
  const shortcutStateRef = useRef({ running, handleRun, activeTab, terminalRunning, handleSave, handleOpen, stopInteractive });
  shortcutStateRef.current = { running, handleRun, activeTab, terminalRunning, handleSave, handleOpen, stopInteractive };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || isSettingsOpen || confirmResetOpen) return;
      const { running, handleRun, activeTab, terminalRunning, handleSave, handleOpen, stopInteractive } = shortcutStateRef.current;
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        if (!running) handleRun();
      } else if (key === "q") {
        e.preventDefault();
        if (activeTab === "console" && terminalRunning) stopInteractive();
      } else if (key === "s") {
        e.preventDefault();
        handleSave(e.shiftKey);
      } else if (key === "o") {
        e.preventDefault();
        handleOpen();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isSettingsOpen, confirmResetOpen]);

  // Renders one folder's children (files + subfolders), recursing into any
  // subfolder that's expanded, plus the inline "new file/folder" name input
  // when one is being created directly inside `relDir`. Depth only controls
  // indentation - the tree itself is however deep the cached data goes.
  const renderTree = (relDir: string, depth: number): ReactNode => {
    const entries = treeCache[relDir] ?? [];
    const pad = 12 + depth * 14;
    const isCreatingHere = creating?.parent === relDir;

    return (
      <>
        {entries.map((entry) => {
          const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
          if (entry.isDirectory) {
            const isExpanded = expandedFolders.has(relPath);
            return (
              <div key={relPath}>
                <button
                  draggable
                  onDragStart={(e) => {
                    draggedPathRef.current = relPath;
                    e.dataTransfer.setData("text/plain", relPath);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolder(relPath);
                  }}
                  onDragLeave={() => setDragOverFolder((f) => (f === relPath ? null : f))}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropEntry(relPath);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(relPath);
                  }}
                  title={entry.name}
                  style={{ paddingLeft: pad }}
                  className={`w-full flex items-center gap-1 pr-3 py-1.5 text-xs text-left truncate hover:bg-muted/60 transition-colors ${
                    dragOverFolder === relPath
                      ? "bg-primary/20 outline outline-1 outline-primary"
                      : selectedFolder === relPath
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="h-3 w-3 flex-shrink-0 opacity-70" />
                  ) : (
                    <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-70" />
                  )}
                  <FolderClosed className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                  <span className="truncate">{entry.name}</span>
                </button>
                {isExpanded && renderTree(relPath, depth + 1)}
              </div>
            );
          }
          const isActive = currentFile?.name === entry.name;
          return (
            <button
              key={relPath}
              draggable
              onDragStart={(e) => {
                draggedPathRef.current = relPath;
                e.dataTransfer.setData("text/plain", relPath);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenWorkspaceFile(relPath);
              }}
              title={entry.name}
              style={{ paddingLeft: pad + 14 }}
              className={`w-full flex items-center gap-2 pr-3 py-1.5 text-xs text-left truncate hover:bg-muted/60 transition-colors ${
                isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : "border-l-2 border-transparent"
              }`}
            >
              <FileCode className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
              <span className="truncate">{entry.name}</span>
            </button>
          );
        })}
        {isCreatingHere && (
          <div style={{ paddingLeft: pad + 14 }} className="pr-3 py-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={newEntryName}
              onChange={(e) => setNewEntryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCreating();
                else if (e.key === "Escape") setCreating(null);
              }}
              onBlur={() => setCreating(null)}
              placeholder={creating?.type === "file" ? "file name" : "folder name"}
              className="w-full text-xs bg-background border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </>
    );
  };

  // The Console/I-O tabs, factored out so they can render either on their
  // own or alongside a Debug side panel (see the "console" ResizablePanel
  // below) without duplicating this markup.
  const consoleTabs = (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "console" | "io")} className="flex flex-col h-full bg-card border-l">
      <div className="px-4 border-b flex-shrink-0 flex items-center justify-between">
        <TabsList className="h-10 bg-transparent gap-4">
          <TabsTrigger value="console" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-0">
            Console
          </TabsTrigger>
          <TabsTrigger value="io" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-0">
            I/O
          </TabsTrigger>
        </TabsList>
        {activeTab === "console" && terminal.length > 0 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyTerminal} title="Copy output">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setTerminal([])}
              disabled={terminalRunning}
              title={terminalRunning ? "Stop the program first" : "Clear the terminal"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* No `flex`/`block` display utility directly on TabsContent:
          Radix marks the inactive tab with the `hidden` attribute,
          and a plain Tailwind `.flex{display:flex}` utility has the
          same specificity as the browser's `[hidden]{display:none}`
          default, so it wins by source order and the "hidden" panel
          stays laid out (that's what was pushing the I/O panel down
          before this fix). `flex-1` alone is safe - it doesn't touch
          `display`. The actual flex layout goes on an inner wrapper. */}
      <TabsContent value="console" className="flex-1 m-0 overflow-hidden">
        <div className="h-full flex flex-col">
        {/* One continuous scrolling transcript - the "prompt" is just
            the next line in the same flow, not a separate boxed
            input, so it reads like a real terminal (output, input,
            output, input, ...) rather than a chat-style input bar. */}
        <div
          className="flex-1 overflow-y-auto p-3 font-mono text-xs cursor-text"
          onClick={() => terminalInputRef.current?.focus()}
        >
          {terminal.length === 0 && (
            <p className="text-muted-foreground">Click Run to start a live terminal session.</p>
          )}
          {/* stderr (cerr) is deliberately not shown here - it goes to the
              Debug side panel instead, so Console stays just the program's
              real stdin/stdout conversation with no error noise mixed in. */}
          {terminal
            .filter((line) => line.type !== "stderr")
            .map((line, i) => (
              <div
                key={i}
                className={
                  line.type === "input"
                    ? "text-primary whitespace-pre-wrap"
                    : line.type === "system"
                    ? "text-muted-foreground italic whitespace-pre-wrap"
                    : "whitespace-pre-wrap"
                }
              >
                {line.type === "input" ? `> ${line.text}` : line.text}
              </div>
            ))}
          {terminalRunning && (
            <div className="flex items-center text-primary">
              <span className="mr-1">&gt;</span>
              <input
                ref={terminalInputRef}
                value={inputLine}
                onChange={(e) => setInputLine(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInputLine()}
                autoFocus
                className="flex-1 bg-transparent border-none outline-none p-0 font-mono text-xs text-foreground"
              />
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
        </div>
      </TabsContent>

      <TabsContent value="io" className="flex-1 m-0 overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel defaultSize={40} minSize={15}>
            <div className="flex flex-col h-full">
              <div className="h-8 px-3 flex items-center border-b bg-muted/30 flex-shrink-0">
                <Label className="text-xs font-semibold text-muted-foreground">Input (stdin)</Label>
              </div>
              <Textarea
                value={ioInput}
                onChange={(e) => setIoInput(e.target.value)}
                placeholder="Type the input your program should read from stdin..."
                className="flex-1 font-mono text-xs resize-none rounded-none border-none focus-visible:ring-0"
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={60} minSize={15}>
            <div className="flex flex-col h-full">
              <div className="h-8 px-3 flex items-center border-b bg-muted/30 flex-shrink-0">
                <Label className="text-xs font-semibold text-muted-foreground">Output</Label>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {!ioResult && !ioRunning && <p className="text-muted-foreground text-xs">Run to see output here.</p>}
                {ioRunning && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" /> Running...
                  </div>
                )}
                {ioResult && !ioRunning && (
                  <div className="space-y-2">
                    <div
                      className={`text-xs font-bold ${
                        ioResult.status === "Ran" ? "text-green-500" : ioResult.status === "Compilation Error" ? "text-yellow-500" : "text-red-500"
                      }`}
                    >
                      {ioResult.status === "Ran" ? "Program exited normally" : ioResult.status}
                      {ioResult.timeTaken !== undefined && <span className="text-muted-foreground font-normal ml-2">{ioResult.timeTaken}ms</span>}
                    </div>
                    {ioResult.message && (
                      <pre className="bg-muted p-2 rounded text-xs font-mono whitespace-pre-wrap border-l-4 border-destructive/50 text-destructive">
                        {ioResult.message}
                      </pre>
                    )}
                    {ioResult.stdout !== undefined && (
                      <pre className="font-mono text-xs whitespace-pre-wrap">
                        {ioResult.stdout || <span className="italic opacity-50 text-muted-foreground">Empty</span>}
                      </pre>
                    )}
                    {/* When the Debug side panel is on, stderr shows there instead -
                        keeps this box from being dominated by a wall of red on a
                        run that only wrote to cerr for debugging. */}
                    {ioResult.stderr && !editorSettings.debugPanelEnabled && (
                      <pre className="bg-red-500/10 text-red-500 p-2 rounded text-xs font-mono whitespace-pre-wrap">{ioResult.stderr}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            <ChevronLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="h-4 w-px bg-border"></div>
          {hasWorkspaceFeature && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarVisible((v) => !v)}
              title={sidebarVisible ? "Hide files sidebar" : "Show files sidebar"}
            >
              {sidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          )}
          <div className="flex items-center gap-2 rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
            <Code2 className="h-3 w-3" /> C++
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "console" && terminalRunning && (
            <Button variant="outline" size="sm" onClick={stopInteractive} className="gap-2" title="Ctrl+Q">
              <Square className="h-3 w-3" /> Stop
            </Button>
          )}
          <Button size="sm" onClick={handleRun} disabled={running} className="gap-2 rounded-full px-4" title="Ctrl+B">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
          </Button>
          <div className="h-4 w-px bg-border mx-1"></div>
          <Button
            variant={editorSettings.debugPanelEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => handleEditorSettingsChange({ ...editorSettings, debugPanelEnabled: !editorSettings.debugPanelEnabled })}
            title={editorSettings.debugPanelEnabled ? "Hide Debug tab (stderr)" : "Show Debug tab (stderr)"}
          >
            <Bug className="h-4 w-4" />
          </Button>
          <UpdateStatusIndicator />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {showWorkspaceSidebar && (
            <>
              <ResizablePanel id="files" order={1} defaultSize={15} minSize={8} maxSize={35}>
                <div className="flex flex-col h-full bg-card/50" onClick={() => setSelectedFolder("")}>
                  <div className="h-10 flex items-center justify-between px-3 border-b flex-shrink-0">
                    <span
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate"
                      title={workspaceDir ?? undefined}
                    >
                      <FolderClosed className="h-3 w-3" />
                      Files
                    </span>
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startCreating("file")} title="New file">
                        <FilePlus2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startCreating("folder")} title="New folder">
                        <FolderPlus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => loadFolder(selectedFolder)}
                        title="Refresh"
                        disabled={loadingWorkspace}
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingWorkspace ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                  <div
                    className={`flex-1 overflow-y-auto py-1 ${dragOverFolder === "" ? "bg-primary/5" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverFolder("");
                    }}
                    onDragLeave={() => setDragOverFolder((f) => (f === "" ? null : f))}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropEntry("");
                    }}
                  >
                    {(treeCache[""] ?? []).length === 0 && !creating ? (
                      <p className="text-xs text-muted-foreground px-3 py-4 leading-relaxed">
                        {loadingWorkspace ? "Loading..." : "No files yet. Create one, or Save one here. Drag files here to move them to the top level."}
                      </p>
                    ) : (
                      renderTree("", 0)
                    )}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          <ResizablePanel id="editor" order={2} defaultSize={showWorkspaceSidebar ? 50 : 60} minSize={25}>
            <div className="flex flex-col h-full bg-background relative">
              <div className="h-10 bg-muted/50 border-b flex items-center justify-between px-4 gap-2">
                <span className="text-xs font-semibold text-muted-foreground truncate" title={currentFile?.path || currentFile?.name}>
                  {currentFile?.name ?? "Main.cpp"}
                  {isDirty && <span className="ml-1 text-primary" title="Unsaved changes">●</span>}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleNewFile} title="Start a new file from your template">
                    <FilePlus2 className="h-3.5 w-3.5" /> New
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setConfirmResetOpen(true)} title="Reset current code to your template">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleOpen} title="Open a file (Ctrl+O)">
                    <FolderOpen className="h-3.5 w-3.5" /> Open
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => handleSave(false)}
                    title={savesByDownload ? "Download this code as a file (Ctrl+S)" : "Save to file (Ctrl+S) - Ctrl+Shift+S to save as"}
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyCode} title="Copy all code">
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <div className="h-4 w-px bg-border mx-1"></div>
                  <Settings className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setIsSettingsOpen(true)} />
                  {isFullScreen ? (
                    <Minimize2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" onClick={handleFullScreen} />
                  ) : (
                    <Maximize2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" onClick={handleFullScreen} />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <Editor
                  height="100%"
                  defaultLanguage="cpp"
                  theme={editorSettings.theme}
                  beforeMount={registerCompilerEditorExtras}
                  onMount={(editor, monacoNs) => {
                    editorRef.current = editor;
                    registerCustomKeybindings(editor, monacoNs);
                  }}
                  value={code}
                  onChange={(value) => setCode(value || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: editorSettings.fontSize,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 10 },
                    wordBasedSuggestions: "currentDocument",
                    // Ctrl+Click adds a cursor (Sublime/VSCode-style) rather
                    // than Monaco's own default of Alt+Click.
                    multiCursorModifier: "ctrlCmd",
                  }}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id="console" order={3} defaultSize={showWorkspaceSidebar ? 35 : 40} minSize={20}>
            {editorSettings.debugPanelEnabled ? (
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel id="console-main" order={1} defaultSize={65} minSize={30}>
                  {consoleTabs}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel id="console-debug" order={2} defaultSize={35} minSize={15}>
                  <div className="flex flex-col h-full bg-card border-l">
                    <div className="h-10 border-b flex items-center gap-2 px-3 flex-shrink-0">
                      <Bug className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Debug (stderr)</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {(() => {
                        const consoleStderr = terminal
                          .filter((l) => l.type === "stderr")
                          .map((l) => l.text)
                          .join("");
                        const ioStderr = ioResult?.stderr || "";
                        if (!consoleStderr && !ioStderr) {
                          return <p className="text-muted-foreground text-xs">Nothing written to stderr (cerr) yet - Run from either tab.</p>;
                        }
                        return (
                          <>
                            {consoleStderr && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">From Console</span>
                                <pre className="bg-red-500/10 text-red-500 p-2 rounded text-xs font-mono whitespace-pre-wrap break-words">
                                  {consoleStderr}
                                </pre>
                              </div>
                            )}
                            {ioStderr && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">From I/O</span>
                                <pre className="bg-red-500/10 text-red-500 p-2 rounded text-xs font-mono whitespace-pre-wrap break-words">
                                  {ioStderr}
                                </pre>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              consoleTabs
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset to template?"
        description="Discard the current code and start again from your template."
        confirmLabel="Reset"
        onConfirm={handleResetToTemplate}
        onCancel={() => setConfirmResetOpen(false)}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editorRef.current?.focus();
        }}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={editorSettings}
        onSettingsChange={handleEditorSettingsChange}
        currentCode={code}
        shortcuts={SHORTCUTS}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editorRef.current?.focus();
        }}
      />
    </div>
  );
}
