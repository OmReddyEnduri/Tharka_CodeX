import { useState } from "react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Folder, Check, X, Edit2 } from "lucide-react";
import { TopicItem } from "./TopicItem";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";

interface ModuleItemProps {
    module: any;
}

export function ModuleItem({ module }: ModuleItemProps) {
    const { getToken } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const API_URL = `${import.meta.env.VITE_API_URL}/api/admin/content`;

    const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
    const [newTopicTitle, setNewTopicTitle] = useState("");
    const [newTopicDescription, setNewTopicDescription] = useState("");
    const [newTopicType, setNewTopicType] = useState("problem");
    const [isEditModuleOpen, setIsEditModuleOpen] = useState(false);
    const [editModuleTitle, setEditModuleTitle] = useState("");
    
    // ... (existing code) ...

    const addTopicMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(`${API_URL}/topics`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    moduleId: module.id,
                    title: newTopicTitle,
                    description: newTopicDescription,
                    type: newTopicType
                })
            });
            if (!res.ok) throw new Error("Failed to add topic");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courseFull"] });
            toast({ title: "Success", description: "Topic added." });
            setIsAddTopicOpen(false);
            setNewTopicTitle("");
            setNewTopicDescription("");
        }
    });

    const updateModuleMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(`${API_URL}/modules/${module.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title: editModuleTitle })
            });
            if (!res.ok) throw new Error("Failed to update module");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courseFull"] });
            toast({ title: "Success", description: "Module updated." });
            setIsEditModuleOpen(false);
        }
    });

    const deleteModuleMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(`${API_URL}/modules/${module.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete module");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courseFull"] });
            toast({ title: "Success", description: "Module deleted." });
        }
    });

    return (
        <AccordionItem value={module.id} className="border rounded-md px-4 mb-2 bg-card">
            <div className="flex items-center justify-between py-2">
                <AccordionTrigger className="hover:no-underline py-2 flex-1">
                    <div className="flex items-center gap-3">
                        <Folder className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-sm">{module.title}</span>
                        <span className="text-xs text-muted-foreground font-normal">({module.topics?.length || 0} topics)</span>
                    </div>
                </AccordionTrigger>
                
                <div className="flex items-center gap-1">
                     <Dialog open={isEditModuleOpen} onOpenChange={setIsEditModuleOpen}>
                        <DialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500" onClick={(e) => { e.stopPropagation(); setEditModuleTitle(module.title); }}>
                                <Edit2 className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent onClick={(e) => e.stopPropagation()}>
                            <DialogHeader>
                                <DialogTitle>Rename Module</DialogTitle>
                            </DialogHeader>
                            <div className="py-2">
                                <Label>Title</Label>
                                <Input value={editModuleTitle} onChange={(e) => setEditModuleTitle(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsEditModuleOpen(false)}>Cancel</Button>
                                <Button onClick={() => updateModuleMutation.mutate()} disabled={!editModuleTitle || updateModuleMutation.isPending}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Module?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete "{module.title}" and all topics inside it. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteModuleMutation.mutate(); }} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
            
            <AccordionContent className="pb-4 pt-1 border-t">
                <div className="space-y-1 mt-2">
                    {module.topics?.map((topic: any) => (
                        <TopicItem key={topic.id} topic={topic} moduleId={module.id} />
                    ))}
                    {(!module.topics || module.topics.length === 0) && (
                        <p className="text-sm text-muted-foreground italic pl-8 py-2">No topics yet.</p>
                    )}
                </div>

                <div className="mt-4 pl-8">
                     <Dialog open={isAddTopicOpen} onOpenChange={setIsAddTopicOpen}>
                        <DialogTrigger asChild>
                             <Button variant="outline" size="sm" className="h-8 text-xs">
                                <Plus className="h-3 w-3 mr-1" /> Add Topic
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Topic</DialogTitle>
                                <DialogDescription>Add a problem or video to this module.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Title</Label>
                                    <Input value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} placeholder="e.g. Binary Search Logic" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input value={newTopicDescription} onChange={(e) => setNewTopicDescription(e.target.value)} placeholder="Short description of this topic" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <select 
                                        value={newTopicType}
                                        onChange={(e) => setNewTopicType(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="problem">Problem</option>
                                        <option value="video">Video</option>
                                    </select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddTopicOpen(false)}>Cancel</Button>
                                <Button onClick={() => addTopicMutation.mutate()} disabled={!newTopicTitle || addTopicMutation.isPending}>
                                    {addTopicMutation.isPending ? "Adding..." : "Add Topic"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}
