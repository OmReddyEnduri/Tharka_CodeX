import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Box } from "lucide-react";
import { ModuleItem } from "./ModuleItem";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function CourseBuilder() {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const API_URL = `${import.meta.env.VITE_API_URL}/api`;

    const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
    const [newModuleTitle, setNewModuleTitle] = useState("");

    // Fetch Full Course Data
    const { data: course, isLoading, error } = useQuery({
        queryKey: ["courseFull", courseId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(`${API_URL}/courses/${courseId}/full`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch course");
            return res.json();
        }
    });

    const addModuleMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const res = await fetch(`${API_URL}/admin/content/modules`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    courseId: courseId, // Using the ID from URL (e.g., 'advanced-dsa')
                    title: newModuleTitle,
                    description: ""
                })
            });
            if (!res.ok) throw new Error("Failed to create module");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courseFull"] });
            toast({ title: "Success", description: "Module created." });
            setIsAddModuleOpen(false);
            setNewModuleTitle("");
        }
    });

    if (isLoading) return <Layout><div className="p-8">Loading builder...</div></Layout>;
    if (error) return <Layout><div className="p-8 text-red-500">Error: {(error as Error).message}</div></Layout>;

    return (
        <Layout>
            <div className="container mx-auto py-8 px-4 h-[calc(100vh-100px)] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">{course.name}</h1>
                            <p className="text-sm text-muted-foreground">Course Builder</p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* Main List */}
                    <div className="flex-1 flex flex-col bg-slate-50/50 rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold flex items-center gap-2">
                                <Box className="h-4 w-4" /> Modules
                            </h2>
                            <Dialog open={isAddModuleOpen} onOpenChange={setIsAddModuleOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 mr-2" /> Add Module
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create New Module</DialogTitle>
                                        <DialogDescription>Group your topics into a logical module.</DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Label>Module Title</Label>
                                        <Input 
                                            value={newModuleTitle} 
                                            onChange={(e) => setNewModuleTitle(e.target.value)} 
                                            placeholder="e.g. Graphs & Trees"
                                            className="mt-2"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsAddModuleOpen(false)}>Cancel</Button>
                                        <Button onClick={() => addModuleMutation.mutate()} disabled={!newModuleTitle || addModuleMutation.isPending}>
                                            Create
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2">
                            {course.modules && course.modules.length > 0 ? (
                                <Accordion type="multiple" className="w-full">
                                    {course.modules.map((module: any) => (
                                        <ModuleItem key={module.id} module={module} />
                                    ))}
                                </Accordion>
                            ) : (
                                <div className="text-center py-20 text-muted-foreground">
                                    <p>No modules yet. Start by adding one!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side - Info / Preview (Optional for now) */}
                    <div className="w-[300px] hidden lg:block bg-card border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Instructions</h3>
                        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
                            <li>Create <strong>Modules</strong> to organize content (e.g., "Week 1").</li>
                            <li>Add <strong>Topics</strong> inside modules.</li>
                            <li>Click the <strong>Edit Icon</strong> on a topic to add Problem details, Test cases, or Video links.</li>
                            <li>Changes are saved instantly.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
