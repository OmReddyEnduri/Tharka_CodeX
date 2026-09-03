import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SettingsDialog } from "@/components/ContestSettingsDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { runStandalone, getServerUrl } from "@/lib/apiClient";
import { registerCustomMonacoThemes } from "@/lib/monacoThemes";

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
const defaultCode = `#include <iostream>
using namespace std;

int main() {
    // Write your code here
    return 0;
}`;

type TerminalLine = { type: "stdout" | "stderr" | "input" | "system"; text: string };

function exitLabel(info: any): string {
  if (info.status === "Exited") return `Program exited (code ${info.code})`;
  if (info.status === "Error" || info.status === "Compilation Error") return `${info.status}: ${info.message || ""}`;
  return info.status;
}

export default function Compiler() {
  const [code, setCode] = useState(defaultCode);
  const [activeTab, setActiveTab] = useState<"console" | "io">("console");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editorSettings, setEditorSettings] = useState({ theme: "vs-dark", fontSize: 14, keybinding: "default" });

  // --- Console tab: live interactive terminal ---
  const socketRef = useRef<Socket | null>(null);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [inputLine, setInputLine] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const contestAPI = (window as any).contestAPI;

    if (contestAPI?.onInteractiveStdout) {
      const offStdout = contestAPI.onInteractiveStdout((chunk: string) => setTerminal((t) => [...t, { type: "stdout", text: chunk }]));
      const offStderr = contestAPI.onInteractiveStderr((chunk: string) => setTerminal((t) => [...t, { type: "stderr", text: chunk }]));
      const offExit = contestAPI.onInteractiveExit((info: any) => {
        setTerminalRunning(false);
        setTerminal((t) => [...t, { type: "system", text: exitLabel(info) }]);
      });
      return () => {
        offStdout?.();
        offStderr?.();
        offExit?.();
      };
    }

    const socket = io(`${getServerUrl()}/compiler`, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("stdout", (chunk: string) => setTerminal((t) => [...t, { type: "stdout", text: chunk }]));
    socket.on("stderr", (chunk: string) => setTerminal((t) => [...t, { type: "stderr", text: chunk }]));
    socket.on("exit", (info: any) => {
      setTerminalRunning(false);
      setTerminal((t) => [...t, { type: "system", text: exitLabel(info) }]);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminal]);

  const runInteractive = () => {
    setTerminal([{ type: "system", text: "Running..." }]);
    setTerminalRunning(true);
    const contestAPI = (window as any).contestAPI;
    if (contestAPI?.startInteractive) {
      contestAPI.startInteractive(code);
    } else {
      socketRef.current?.emit("run", { code });
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
    setTerminal((t) => [...t, { type: "system", text: "Stopped." }]);
  };

  const sendInputLine = () => {
    if (!terminalRunning) return;
    const contestAPI = (window as any).contestAPI;
    if (contestAPI?.sendInteractiveInput) {
      contestAPI.sendInteractiveInput(inputLine + "\n");
    } else {
      socketRef.current?.emit("input", inputLine + "\n");
    }
    setTerminal((t) => [...t, { type: "input", text: inputLine }]);
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
      const data = await runStandalone({ code, input: ioInput });
      setIoResult(data);
    } catch (err: any) {
      setIoResult({ status: "Error", message: err.message || "Failed to connect to server" });
    } finally {
      setIoRunning(false);
    }
  };

  const running = activeTab === "console" ? terminalRunning : ioRunning;
  const handleRun = activeTab === "console" ? runInteractive : runBatch;

  const handleFullScreen = () => {
    if (screenfull.isEnabled) {
      screenfull.toggle();
      setIsFullScreen(!isFullScreen);
    } else {
      toast.error("Fullscreen is not supported in your browser");
    }
  };

  // Ctrl+B run / Ctrl+Q stop. Capture phase so this fires before Monaco's
  // own keydown handling swallows the event (Monaco stops propagation for a
  // lot of key combos otherwise). Stop only does anything on the Console
  // tab's live session - the I/O tab's single request/response has nothing
  // to cancel once sent.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (!running) handleRun();
      } else if (e.key.toLowerCase() === "q") {
        e.preventDefault();
        if (activeTab === "console" && terminalRunning) stopInteractive();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [running, handleRun, activeTab, terminalRunning]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            <ChevronLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="h-4 w-px bg-border"></div>
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
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="flex flex-col h-full bg-background relative">
              <div className="h-10 bg-muted/50 border-b flex items-center justify-between px-4">
                <span className="text-xs font-semibold text-muted-foreground">Main.cpp</span>
                <div className="flex items-center gap-3">
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
                  beforeMount={registerCustomMonacoThemes}
                  value={code}
                  onChange={(value) => setCode(value || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: editorSettings.fontSize,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 10 },
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  }}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={25}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "console" | "io")} className="flex flex-col h-full bg-card border-l">
              <div className="px-4 border-b flex-shrink-0">
                <TabsList className="h-10 bg-transparent gap-4">
                  <TabsTrigger value="console" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-0">
                    Console
                  </TabsTrigger>
                  <TabsTrigger value="io" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-0">
                    I/O
                  </TabsTrigger>
                </TabsList>
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
                  {terminal.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.type === "stderr"
                          ? "text-red-500 whitespace-pre-wrap"
                          : line.type === "input"
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
                            {ioResult.stderr && (
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={editorSettings} onSettingsChange={setEditorSettings} />
    </div>
  );
}
