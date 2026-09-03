import { useState } from "react";
import { Edit2, Trash2, FileCode, Video, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProblemEditorSheet } from "@/components/admin/ProblemEditorSheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface TopicItemProps {
  topic: any;
  moduleId: string;
}

export function TopicItem({ topic, moduleId }: TopicItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [renameTitle, setRenameTitle] = useState("");
    
    const { getToken } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const API_URL = `${import.meta.env.VITE_API_URL}/api/admin/content`;

    const deleteTopicMutation = useMutation({
        mutationFn: async () => {
             const token = await getToken();
             const res = await fetch(`${API_URL}/topics/${topic.id}`, {
                 method: "DELETE",
                 headers: { Authorization: `Bearer ${token}` }
             });
             if (!res.ok) throw new Error("Failed to delete topic");
             return res.json();
        },
        onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ["courseFull"] });
             toast({ title: "Deleted", description: "Topic removed." });
        }
    });

    const updateTopicMutation = useMutation({
        mutationFn: async () => {
             const token = await getToken();
             const res = await fetch(`${API_URL}/topics/${topic.id}`, {
                 method: "PUT",
                 headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                 body: JSON.stringify({ title: renameTitle })
             });
             if (!res.ok) throw new Error("Failed to update topic");
             return res.json();
        },
        onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ["courseFull"] });
             toast({ title: "Updated", description: "Topic renamed." });
             setIsRenameOpen(false);
        }
    });

    const deleteProblemMutation = useMutation({
        mutationFn: async (problemId: string) => {
            const token = await getToken();
            const res = await fetch(`${API_URL}/problems/${problemId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete problem");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courseFull"] });
            toast({ title: "Deleted", description: "Problem removed." });
        }
    });

    const handleAddProblem = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedProblemId(null); // New problem
        setIsEditorOpen(true);
    };

    const handleEditProblem = (e: React.MouseEvent, problemId: string) => {
        e.stopPropagation();
        setSelectedProblemId(problemId);
        setIsEditorOpen(true);
    };

    return (
        <div className="border-l-2 border-transparent hover:border-slate-300 transition-colors">
            {/* Topic Header Row */}
            <div 
                className="flex items-center justify-between p-2 pl-4 hover:bg-muted/50 cursor-pointer group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 select-none">
                    <button className="text-muted-foreground hover:text-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {topic.type === 'video' ? <Video className="h-4 w-4 text-blue-500" /> : <FileCode className="h-4 w-4 text-orange-500" />}
                    <span className="text-sm font-medium">{topic.title}</span>
                </div>

                <div className="flex items-center gap-2">
                    <Badge 
                        variant="outline" 
                        className="text-[10px] h-5 px-2 font-normal text-muted-foreground transition-all duration-200 group-hover:bg-background group-hover:border-slate-400"
                    >
                        {topic.problems?.length || 0} Problems
                    </Badge>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                         <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors" onClick={(e) => { e.stopPropagation(); setRenameTitle(topic.title); }}>
                                    <Edit2 className="h-3 w-3" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent onClick={(e) => e.stopPropagation()}>
                                <DialogHeader>
                                    <DialogTitle>Rename Topic</DialogTitle>
                                </DialogHeader>
                                <div className="py-2">
                                    <Label>Title</Label>
                                    <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                                    <Button onClick={() => updateTopicMutation.mutate()} disabled={!renameTitle || updateTopicMutation.isPending}>
                                        Save
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {topic.type === 'problem' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs hover:text-blue-600 hover:bg-blue-50 transition-colors" onClick={handleAddProblem}>
                                <Plus className="h-3 w-3 mr-1" /> Add Problem
                            </Button>
                        )}
                        
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={(e) => e.stopPropagation()}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Topic?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete "{topic.title}" and its {topic.problems?.length} problems.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteTopicMutation.mutate(); }} className="bg-red-600 hover:bg-red-700">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            {/* Expanded Content (List of Problems) */}
            {isExpanded && (
                <div className="pl-12 pr-4 py-3 space-y-1.5 bg-slate-50/50 border-t border-b transition-all duration-300">
                    {topic.problems && topic.problems.length > 0 ? (
                        <>
                            {topic.problems.map((problem: any) => (
                                <div key={problem.id} className="flex items-center justify-between p-2.5 rounded-md bg-white/50 hover:bg-white border border-transparent hover:border-slate-200 text-sm group/problem transition-all duration-200">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] text-muted-foreground bg-slate-100 px-1 rounded">#{String(problem.id || "").slice(-4)}</span>
                                        <span className="font-medium">{problem.title}</span>
                                        <Badge className={cn("text-[10px] h-4 px-1 shadow-none", 
                                            problem.difficulty === 'Easy' ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" : 
                                            problem.difficulty === 'Medium' ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200" : 
                                            "bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
                                        )}>
                                            {problem.difficulty}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover/problem:opacity-100 transition-all">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                            onClick={(e) => handleEditProblem(e, problem.id)}
                                        >
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Problem?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete "{problem.title}". This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            deleteProblemMutation.mutate(problem.id); 
                                                        }} 
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full mt-3 border-dashed border-slate-300 text-muted-foreground hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 h-10 text-xs transition-all duration-300"
                                onClick={handleAddProblem}
                            >
                                <Plus className="h-3.5 w-3.5 mr-2" /> Add Another Problem
                            </Button>
                        </>
                    ) : (
                        <div className="text-center py-6 text-xs text-muted-foreground border-2 border-dashed border-slate-200 rounded-lg bg-white/30">
                            No problems yet. 
                            <Button variant="link" className="h-auto p-0 ml-1 text-xs text-blue-500" onClick={handleAddProblem}>Add one?</Button>
                        </div>
                    )}
                </div>
            )}

            {/* Editor Sheet - Opens for Add (null ID) or Edit (specific ID) */}
            <ProblemEditorSheet 
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                topicId={topic.id}
                problemId={selectedProblemId}
            />
        </div>
    );
}
