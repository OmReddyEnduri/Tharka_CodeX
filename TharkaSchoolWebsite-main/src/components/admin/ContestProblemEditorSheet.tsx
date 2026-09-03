import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

// --- SCHEMA ---
const contestProblemSchema = z.object({
  id: z.coerce.number().min(1, "ID is required"),
  title: z.string().min(2, "Title is required"),
  description: z.string().min(10, "Description is required"),
  category: z.string().min(1, "Category is required"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  timeLimit: z.coerce.number().min(100),
  memoryLimit: z.coerce.number().min(1),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  constraints: z.string().optional(),
  sampleTestCases: z.array(z.object({
    input: z.string(),
    output: z.string(),
  })),
  hiddenTestCases: z.array(z.object({
    input: z.string(),
    output: z.string(),
  })),
});

type ContestProblemFormData = z.infer<typeof contestProblemSchema>;

interface ContestProblemEditorSheetProps {
  contestId: string | null;
  isOpen: boolean;
  onClose: () => void;
  editingProblem?: any;
}

export function ContestProblemEditorSheet({ contestId, isOpen, onClose, editingProblem }: ContestProblemEditorSheetProps) {
  const isEditMode = !!editingProblem;
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const API_URL = `${import.meta.env.VITE_API_URL}`;

  const [activeTab, setActiveTab] = useState("details");

  const form = useForm<ContestProblemFormData>({
    resolver: zodResolver(contestProblemSchema),
    defaultValues: {
      id: Math.floor(Math.random() * 1000) + 100, // temporary
      title: "",
      description: "",
      category: "General",
      difficulty: "Medium",
      timeLimit: 1000,
      memoryLimit: 256,
      inputFormat: "Standard Input",
      outputFormat: "Standard Output",
      constraints: "",
      sampleTestCases: [{ input: "", output: "" }],
      hiddenTestCases: [{ input: "", output: "" }],
    },
  });

  const { fields: sampleFields, append: appendSample, remove: removeSample } = useFieldArray({
    control: form.control,
    name: "sampleTestCases",
  });

  const { fields: hiddenFields, append: appendHidden, remove: removeHidden } = useFieldArray({
    control: form.control,
    name: "hiddenTestCases",
  });


  // --- MUTATION ---
  const addProblemMutation = useMutation({
    mutationFn: async (data: ContestProblemFormData) => {
        if (!contestId) throw new Error("Contest ID is missing");
      const token = await getToken();
      const url = `${API_URL}/api/contests/${contestId}/problems`;
      console.log("Adding problem to:", url);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.msg || "Failed to add problem");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseContestsFull"] });
      toast({ title: "Success", description: "Problem added successfully" });
      onClose();
      form.reset();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateProblemMutation = useMutation({
    mutationFn: async (data: ContestProblemFormData) => {
        if (!contestId || !editingProblem) throw new Error("Contest or Problem ID is missing");
      const token = await getToken();
      const url = `${API_URL}/api/contests/${contestId}/problems/${editingProblem.id}`;
      console.log("Updating problem at:", url);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.msg || "Failed to update problem");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseContestsFull"] });
      toast({ title: "Success", description: "Problem updated successfully" });
      onClose();
      form.reset();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ContestProblemFormData) => {
    if (isEditMode) {
        updateProblemMutation.mutate(data);
    } else {
        addProblemMutation.mutate(data);
    }
  };
  
  // Reset form when the sheet is opened.
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editingProblem) {
        form.reset(editingProblem);
      } else {
        form.reset({
          id: Math.floor(Math.random() * 10000),
          title: "",
          description: "",
          category: "General",
          difficulty: "Medium",
          timeLimit: 1000,
          memoryLimit: 256,
          inputFormat: "Standard Input",
          outputFormat: "Standard Output",
          constraints: "",
          sampleTestCases: [{ input: "", output: "" }],
          hiddenTestCases: [{ input: "", output: "" }],
        });
      }
    }
  }, [isOpen, isEditMode, editingProblem, form]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[90vw] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Contest Problem" : "Add New Contest Problem"}</SheetTitle>
          <SheetDescription>
            Configure the problem statement and constraints.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="testcases">Test Cases</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Problem ID</Label>
                      <Input type="number" {...form.register("id")} placeholder="e.g. 101" disabled={isEditMode}/>
                      {form.formState.errors.id && <p className="text-red-500 text-xs">{form.formState.errors.id.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input {...form.register("title")} placeholder="Two Sum" />
                      {form.formState.errors.title && <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Description (Markdown supported)</Label>
                      <Textarea {...form.register("description")} className="h-40" placeholder="Given an array of integers..." />
                      {form.formState.errors.description && <p className="text-red-500 text-xs">{form.formState.errors.description.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input {...form.register("category")} placeholder="e.g. Arrays, DP, Graphs" />
                       {form.formState.errors.category && <p className="text-red-500 text-xs">{form.formState.errors.category.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Input Format</Label>
                          <Textarea {...form.register("inputFormat")} rows={2} placeholder="The first line contains..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Output Format</Label>
                          <Textarea {...form.register("outputFormat")} rows={2} placeholder="Print a single integer..." />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <select 
                          {...form.register("difficulty")}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Time Limit (ms)</Label>
                        <Input type="number" {...form.register("timeLimit")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Memory Limit (MB)</Label>
                        <Input type="number" {...form.register("memoryLimit")} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Constraints</Label>
                      <Textarea {...form.register("constraints")} placeholder="- 10^9 <= target <= 10^9" />
                    </div>
                </TabsContent>
                <TabsContent value="testcases" className="space-y-6">
                    {/* Sample Cases */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-base font-semibold">Sample Test Cases</Label>
                        <Button type="button" size="sm" variant="outline" onClick={() => appendSample({ input: "", output: "" })}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {sampleFields.map((field, index) => (
                          <div key={field.id} className="p-3 border rounded-md relative group">
                             <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-red-500"
                                onClick={() => removeSample(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            <div className="grid gap-2">
                              <Label className="text-xs">Input</Label>
                              <Textarea {...form.register(`sampleTestCases.${index}.input`)} rows={2} className="font-mono text-xs" />
                              <Label className="text-xs">Output</Label>
                              <Textarea {...form.register(`sampleTestCases.${index}.output`)} rows={1} className="font-mono text-xs" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hidden Cases */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-base font-semibold">Hidden Test Cases (For Evaluation)</Label>
                        <Button type="button" size="sm" variant="outline" onClick={() => appendHidden({ input: "", output: "" })}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                       <div className="space-y-4">
                        {hiddenFields.map((field, index) => (
                          <div key={field.id} className="p-3 border rounded-md relative group bg-muted/20">
                             <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-red-500"
                                onClick={() => removeHidden(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            <div className="grid gap-2">
                              <Label className="text-xs">Input</Label>
                              <Textarea {...form.register(`hiddenTestCases.${index}.input`)} rows={2} className="font-mono text-xs" />
                              <Label className="text-xs">Output</Label>
                              <Textarea {...form.register(`hiddenTestCases.${index}.output`)} rows={1} className="font-mono text-xs" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                </TabsContent>
            </Tabs>
            <div className="flex gap-2 pt-4">
              <Button type="submit" className="w-full" disabled={addProblemMutation.isPending || updateProblemMutation.isPending}>
                {addProblemMutation.isPending || updateProblemMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                {isEditMode ? "Update Problem" : "Add Problem"}
              </Button>
            </div>
          </form>
      </SheetContent>
    </Sheet>
  );
}