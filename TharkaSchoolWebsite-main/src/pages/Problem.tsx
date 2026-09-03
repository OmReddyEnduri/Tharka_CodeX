import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { 
  Play, 
  Loader2, 
  CheckCircle, 
  ChevronLeft, 
  List, 
  Settings, 
  Maximize2, 
  Code2, 
  FileText, 
  History,
  ChevronUp,
  ChevronDown,
  Copy,
  Check
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Course as CourseType, Problem as ProblemType } from "@/lib/courses";
import { toast } from "sonner";

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button 
      onClick={handleCopy} 
      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors ml-2"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

const DEFAULT_SETTINGS = {
  fontSize: 14,
  theme: "vs-dark",
  tabSize: 4,
  minimap: false,
  lineNumbers: "on" as const,
  wordWrap: "off" as const
};

const Problem = () => {
  const { courseId, problemId } = useParams<{ courseId: string; problemId: string }>();
  const navigate = useNavigate();
  const { getToken, userId } = useAuth();
  
  const editorRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      editorRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState("description");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState("testcase");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [viewCodeSub, setViewCodeSub] = useState<any>(null);

  // Initial code template
  const defaultCode = `#include <iostream>
using namespace std;

int main() {
    // Write your code here
    return 0;
}`;

  // Fetch FULL course data (Required to see problem)
  const { data: course, isLoading, error } = useQuery<CourseType>({
    queryKey: ["course-full", courseId],
    enabled: !!userId,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/courses/${courseId}/full`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 403) throw new Error("Access Denied");
      if (!res.ok) throw new Error("Failed to fetch course");
      return res.json();
    },
    retry: false
  });
  
  // Flatten all modules and topics to find the problem
  const problem = course?.modules?.flatMap(m => m.topics).flatMap(t => t.problems).find(p => p.id.toString() === problemId);
  
  // Find parent topic for context
  const topic = course?.modules?.flatMap(m => m.topics).find(t => t.problems?.some(p => p.id.toString() === problemId));

  useEffect(() => {
      if (problem && !code) {
          setCode(defaultCode);
      }
  }, [problem, code]);

  // Enterprise Pattern: Redirect unauthorized users to the sales page instead of showing a dead-end error screen.
  useEffect(() => {
    if (error) {
      toast.error("Access Denied. Please purchase the course to access this problem.");
      navigate(`/course/${courseId}`);
    }
  }, [error, navigate, courseId]);

  const fetchSubmissions = async () => {
    if (!userId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/my-submissions?problemId=${problemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error("Failed to fetch submissions", error);
    }
  };

  useEffect(() => {
    if (activeTab === "submissions") {
      fetchSubmissions();
    }
  }, [activeTab, problemId, userId]);

  const handleRun = async () => {
    if (!userId) {
      toast.error("Please login to run code");
      return;
    }
    setRunning(true);
    setConsoleOpen(true);
    setActiveConsoleTab("result");
    setResult(null);

    const payload = {
        problemId: problemId,
        code: code,
        mode: "run",
        courseId: course?._id,
        topicId: topic?._id
    };
    console.log("Run Payload:", payload);

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to run code");
      }
      setResult(data);
    } catch (error: any) {
      console.error("Run Error:", error);
      toast.error(error.message || "Failed to run code");
      setResult({ status: "Error", message: error.message || "Failed to connect to server" });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Please login to submit code");
      return;
    }
    setSubmitting(true);
    setConsoleOpen(true);
    setActiveConsoleTab("result");
    setResult(null);

    const payload = {
        problemId: problemId,
        code: code,
        mode: "submit",
        courseId: course?._id,
        topicId: topic?._id
    };
    console.log("Submit Payload:", payload);

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
         throw new Error(data.message || data.error || "Failed to submit code");
      }

      setResult(data);
      if (data.status === "Accepted") {
        toast.success("Problem Solved!");
        fetchSubmissions(); // Refresh history
      } else if (data.status === "Wrong Answer") {
        toast.error("Wrong Answer");
        fetchSubmissions(); // Refresh history
      } else {
        fetchSubmissions(); // Refresh history for errors too
      }
    } catch (error: any) {
      console.error("Submit Error:", error);
      toast.error(error.message || "Failed to submit code");
      setResult({ status: "Error", message: error.message || "Failed to connect to server" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  // Prevent "Problem not found" flash while redirecting on error
  if (error) return null;

  if (!problem) {
    return (
      <Layout>
        <div className="container px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">Problem not found</h1>
          <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </Layout>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 flex-shrink-0">
         <div className="flex items-center gap-4">
            <Link to={`/course/${courseId}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
               <ChevronLeft className="h-4 w-4" />
               Back to Course
            </Link>
            <div className="h-4 w-px bg-border"></div>
            <div className="flex items-center gap-2">
               <h1 className="font-semibold text-sm">{problem.title}</h1>
               <Badge className={`text-[10px] px-1.5 py-0 h-5 ${
                   problem.difficulty === "Easy" ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" : 
                   problem.difficulty === "Medium" ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200" : 
                   "bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
               }`}>
                   {problem.difficulty}
               </Badge>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRun}
                disabled={running || submitting}
                className="gap-2"
            >
                {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
            </Button>
            <Button 
                size="sm" 
                onClick={handleSubmit}
                disabled={submitting || running}
                className="gap-2"
            >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Code2 className="h-3 w-3" />}
                Submit
            </Button>
         </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel: Description */}
            <ResizablePanel defaultSize={40} minSize={20}>
                <div className="flex flex-col h-full bg-card border-r">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 border-b">
                            <TabsList className="h-10 bg-transparent gap-4">
                                <TabsTrigger value="description" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-0">
                                    <FileText className="h-4 w-4 mr-2" /> Description
                                </TabsTrigger>
                                <TabsTrigger value="submissions" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-0">
                                    <History className="h-4 w-4 mr-2" /> Submissions
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <TabsContent value="description" className="m-0 space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold mb-4">{problem.title}</h2>
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
                                        {problem.description}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Input Format</h3>
                                        <p className="text-sm">{problem.inputFormat}</p>
                                    </section>
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Output Format</h3>
                                        <p className="text-sm">{problem.outputFormat}</p>
                                    </section>
                                    {problem.constraints && (
                                        <section>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Constraints</h3>
                                            <p className="text-sm font-mono bg-muted p-2 rounded">{problem.constraints}</p>
                                        </section>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Examples</h3>
                                    {problem.sampleTestCases.map((ex, idx) => (
                                        <div key={idx} className="border rounded-md overflow-hidden">
                                            <div className="bg-muted px-3 py-1.5 flex justify-between items-center border-b">
                                                <span className="text-xs font-medium">Example {idx + 1}</span>
                                            </div>
                                            <div className="p-3 space-y-3">
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Input</span>
                                                        <CopyButton text={ex.input} />
                                                    </div>
                                                    <pre className="text-xs bg-muted/50 p-2 rounded">{ex.input || "No input"}</pre>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Output</span>
                                                        <CopyButton text={ex.output} />
                                                    </div>
                                                    <pre className="text-xs bg-muted/50 p-2 rounded">{ex.output}</pre>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="submissions" className="m-0 h-full overflow-y-auto p-4">
                                {submissions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                        <History className="h-12 w-12 mb-2 opacity-20" />
                                        <p className="text-sm">No submissions yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {submissions.map((sub) => (
                                            <div key={sub._id} className="flex items-center justify-between p-3 border rounded-md bg-card/50 hover:bg-muted/50 transition-colors">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-sm font-bold ${sub.verdict === 'Accepted' ? 'text-green-500' : sub.verdict === 'Wrong Answer' ? 'text-red-500' : 'text-yellow-500'}`}>
                                                        {sub.verdict}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(sub.submittedAt).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    {sub.timeTaken !== undefined && <span>{sub.timeTaken}ms</span>}
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewCodeSub(sub)}>
                                                        <Code2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Dialog open={!!viewCodeSub} onOpenChange={(open) => !open && setViewCodeSub(null)}>
                                    <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                                        <DialogHeader className="p-4 pr-12 border-b flex flex-row items-center justify-between space-y-0">
                                            <div>
                                                <DialogTitle>Submission Code</DialogTitle>
                                                {viewCodeSub && (
                                                    <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                                        <span className={viewCodeSub.verdict === 'Accepted' ? 'text-green-500' : viewCodeSub.verdict === 'Compilation Error' ? 'text-yellow-500' : 'text-red-500'}>
                                                            {viewCodeSub.verdict}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{new Date(viewCodeSub.submittedAt).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={async () => {
                                                        await navigator.clipboard.writeText(viewCodeSub?.code || "");
                                                        toast.success("Code copied to clipboard");
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3 mr-2"/> Copy
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => {
                                                        if (viewCodeSub?.code) {
                                                            setCode(viewCodeSub.code);
                                                            setViewCodeSub(null);
                                                            toast.success("Code moved to editor");
                                                        }
                                                    }}
                                                >
                                                    <Code2 className="h-3 w-3 mr-2"/> Move to Editor
                                                </Button>
                                            </div>
                                        </DialogHeader>
                                        <div className="flex-1 bg-[#1e1e1e] pt-4">
                                            <Editor
                                                height="100%"
                                                defaultLanguage="cpp"
                                                theme="vs-dark"
                                                value={viewCodeSub?.code || ""}
                                                options={{
                                                    readOnly: true,
                                                    minimap: { enabled: false },
                                                    fontSize: 14,
                                                    lineNumbers: "on",
                                                    scrollBeyondLastLine: false,
                                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                }}
                                            />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel: Editor & Console */}
            <ResizablePanel defaultSize={60} minSize={30}>
                <div className="flex flex-col h-full bg-background relative" ref={editorRef}>
                    {/* Editor Container */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="h-10 bg-muted/50 border-b flex items-center justify-between px-4">
                            <div className="flex items-center gap-2">
                                <Code2 className="h-4 w-4 text-primary" />
                                <span className="text-xs font-semibold">C++</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Settings 
                                    className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" 
                                    onClick={() => setSettingsOpen(true)}
                                />
                                <Maximize2 
                                    className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" 
                                    onClick={toggleFullScreen}
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <Editor
                                height="100%"
                                defaultLanguage="cpp"
                                theme={settings.theme}
                                value={code}
                                onChange={(value) => setCode(value || "")}
                                options={{
                                    minimap: { enabled: settings.minimap },
                                    fontSize: settings.fontSize,
                                    lineNumbers: settings.lineNumbers,
                                    wordWrap: settings.wordWrap,
                                    tabSize: settings.tabSize,
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    padding: { top: 10 },
                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                }}
                            />
                        </div>
                    </div>

                    {/* Console Panel */}
                    <div className={`border-t bg-card transition-all duration-200 flex flex-col ${consoleOpen ? 'h-1/2' : 'h-10'}`}>
                        <div className="h-10 border-b flex items-center justify-between px-4 cursor-pointer hover:bg-muted/30" onClick={() => setConsoleOpen(!consoleOpen)}>
                            <div className="flex items-center gap-4 h-full">
                                <span className={`text-xs font-bold uppercase tracking-wider ${!consoleOpen ? 'text-muted-foreground' : 'text-foreground'}`}>Console</span>
                                {consoleOpen && (
                                    <div className="flex h-full">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveConsoleTab("testcase"); }}
                                            className={`px-3 h-full text-[10px] font-bold uppercase tracking-tight flex items-center gap-1.5 transition-colors border-b-2 ${activeConsoleTab === "testcase" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                                        >
                                            <CheckCircle className="h-3 w-3" /> Testcase
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveConsoleTab("result"); }}
                                            className={`px-3 h-full text-[10px] font-bold uppercase tracking-tight flex items-center gap-1.5 transition-colors border-b-2 ${activeConsoleTab === "result" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                                        >
                                            <Play className="h-3 w-3" /> Result
                                        </button>
                                    </div>
                                )}
                            </div>
                            {consoleOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                        </div>

                        {consoleOpen && (
                            <div className="flex-1 p-4 overflow-y-auto">
                                {activeConsoleTab === "testcase" && (
                                    <div className="space-y-4">
                                        {problem.sampleTestCases.map((ex, idx) => (
                                            <div key={idx} className="space-y-2">
                                                <span className="text-xs font-bold text-muted-foreground">Case {idx + 1}</span>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">Input</span>
                                                        <div className="bg-muted p-2 rounded text-xs font-mono">{ex.input || "No input"}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeConsoleTab === "result" && (
                                    <div className="h-full">
                                        {!result && !submitting && !running && (
                                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                                                <p>Run your code to see results</p>
                                            </div>
                                        )}
                                        {(submitting || running) && (
                                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                                <span className="text-xs">{submitting ? "Submitting..." : "Running Code..."}</span>
                                            </div>
                                        )}
                                        {result && !submitting && !running && (
                                            <div className="space-y-4">
                                                <div className={`text-lg font-bold ${
                                                    result.status === "Accepted" ? "text-green-500" : 
                                                    result.status === "Compilation Error" ? "text-yellow-500" : "text-red-500"
                                                }`}>
                                                    {result.status}
                                                </div>
                                                
                                                {result.message && (
                                                    <pre className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap border-l-4 border-destructive/50 text-destructive">{result.message}</pre>
                                                )}

                                                {result.results && (
                                                    <div className="flex flex-col gap-3">
                                                        {result.results.map((res: any, i: number) => (
                                                            <div key={i} className={`p-3 rounded border flex flex-col gap-2 ${res.passed ? 'border-green-900/50 bg-green-900/10' : 'border-red-900/50 bg-red-900/10'}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Case {res.testCase || i + 1}</span>
                                                                    <span className={`text-sm font-bold ${res.passed ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {res.passed ? 'Passed' : res.error ? res.error : 'Failed'}
                                                                    </span>
                                                                </div>
                                                                {res.input && (
                                                                    <div className="grid grid-cols-1 gap-1 text-xs">
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[10px] uppercase text-muted-foreground">Input</span>
                                                                            <code className="bg-black/20 p-1.5 rounded font-mono break-all">{res.input}</code>
                                                                        </div>
                                                                        {res.userOutput !== undefined && (
                                                                            <div className="grid grid-cols-2 gap-2 mt-1">
                                                                                <div className="flex flex-col gap-1">
                                                                                    <span className="text-[10px] uppercase text-muted-foreground">Your Output</span>
                                                                                    <code className={`p-1.5 rounded font-mono break-all ${res.passed ? 'bg-black/20' : 'bg-red-500/10 text-red-500'}`}>
                                                                                        {res.userOutput || <span className="italic opacity-50">Empty</span>}
                                                                                    </code>
                                                                                </div>
                                                                                <div className="flex flex-col gap-1">
                                                                                    <span className="text-[10px] uppercase text-muted-foreground">Expected</span>
                                                                                    <code className="bg-black/20 p-1.5 rounded font-mono break-all">{res.expectedOutput}</code>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editor Settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="theme" className="text-right">Theme</Label>
              <Select 
                  value={settings.theme} 
                  onValueChange={(val) => setSettings(s => ({...s, theme: val}))}
              >
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="vs-dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Font Size</Label>
              <div className="col-span-3 flex items-center gap-2">
                  <Slider 
                      value={[settings.fontSize]} 
                      min={10} 
                      max={30} 
                      step={1} 
                      onValueChange={([val]) => setSettings(s => ({...s, fontSize: val}))}
                      className="flex-1"
                  />
                  <span className="w-8 text-sm text-right">{settings.fontSize}px</span>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tab Size</Label>
              <Select 
                  value={settings.tabSize.toString()} 
                  onValueChange={(val) => setSettings(s => ({...s, tabSize: parseInt(val)}))}
              >
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select tab size" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="2">2 spaces</SelectItem>
                      <SelectItem value="4">4 spaces</SelectItem>
                      <SelectItem value="8">8 spaces</SelectItem>
                  </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Line Num</Label>
              <div className="col-span-3 flex items-center space-x-2">
                  <Switch 
                      checked={settings.lineNumbers === "on"}
                      onCheckedChange={(checked) => setSettings(s => ({...s, lineNumbers: checked ? "on" : "off"}))}
                  />
                  <span className="text-sm text-muted-foreground">{settings.lineNumbers === "on" ? "Show" : "Hide"}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Minimap</Label>
              <div className="col-span-3 flex items-center space-x-2">
                  <Switch 
                      checked={settings.minimap}
                      onCheckedChange={(checked) => setSettings(s => ({...s, minimap: checked}))}
                  />
                  <span className="text-sm text-muted-foreground">{settings.minimap ? "Show" : "Hide"}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Word Wrap</Label>
              <div className="col-span-3 flex items-center space-x-2">
                  <Switch 
                      checked={settings.wordWrap === "on"}
                      onCheckedChange={(checked) => setSettings(s => ({...s, wordWrap: checked ? "on" : "off"}))}
                  />
                  <span className="text-sm text-muted-foreground">{settings.wordWrap === "on" ? "On" : "Off"}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSettings(DEFAULT_SETTINGS);
                toast.success("Settings reset to default");
              }}
            >
              Reset to Default
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Problem;
