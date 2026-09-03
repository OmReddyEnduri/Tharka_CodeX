import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Loader2 } from "lucide-react";

// --- SCHEMA ---
const problemSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().min(10, "Description is required"),
  category: z.string().min(1, "Category is required"),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  timeLimit: z.coerce.number().min(100),
  memoryLimit: z.coerce.number().min(1),
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

type ProblemFormData = z.infer<typeof problemSchema>;

interface ProblemEditorSheetProps {
  topicId: string;
  problemId?: string | null; // If null, we are creating a new one
  isOpen: boolean;
  onClose: () => void;
}

export function ProblemEditorSheet({ topicId, problemId, isOpen, onClose }: ProblemEditorSheetProps) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const API_URL = `${import.meta.env.VITE_API_URL}/api/admin/content`;

  const [activeTab, setActiveTab] = useState("details");

  const form = useForm<ProblemFormData>({
    resolver: zodResolver(problemSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "General",
      inputFormat: "Standard Input",
      outputFormat: "Standard Output",
      difficulty: "Medium",
      timeLimit: 1000,
      memoryLimit: 256,
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

  // --- FETCH DATA ---
  const { data: problemData, isLoading } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: async () => {
      if (!problemId) return null;
      const token = await getToken();
      const res = await fetch(`${API_URL}/problems/${problemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch problem");
      return res.json();
    },
    enabled: !!problemId && isOpen,
  });

  // Populate form when data loads
  useEffect(() => {
    if (problemData) {
      form.reset({
        title: problemData.title,
        description: problemData.description,
        category: problemData.category || "General",
        inputFormat: problemData.inputFormat || "Standard Input",
        outputFormat: problemData.outputFormat || "Standard Output",
        difficulty: problemData.difficulty,
        timeLimit: problemData.timeLimit,
        memoryLimit: problemData.memoryLimit,
        constraints: problemData.constraints,
        sampleTestCases: problemData.sampleTestCases,
        hiddenTestCases: problemData.hiddenTestCases,
      });
    } else if (!problemId) {
       form.reset({
        title: "",
        description: "",
        category: "General",
        inputFormat: "Standard Input",
        outputFormat: "Standard Output",
        difficulty: "Medium",
        timeLimit: 1000,
        memoryLimit: 256,
        constraints: "",
        sampleTestCases: [{ input: "", output: "" }],
        hiddenTestCases: [{ input: "", output: "" }],
      });
    }
  }, [problemData, problemId, isOpen, form]);

  // --- MUTATION ---
  const saveMutation = useMutation({
    mutationFn: async (data: ProblemFormData) => {
      const token = await getToken();
      const url = problemId ? `${API_URL}/problems/${problemId}` : `${API_URL}/problems`;
      const method = problemId ? "PUT" : "POST";
      
      const payload = { ...data, topicId }; // topicId needed for creation

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save problem");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseFull"] }); // Refresh the course builder
      toast({ title: "Success", description: "Problem saved successfully" });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ProblemFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[90vw] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{problemId ? "Edit Problem" : "Add Problem"}</SheetTitle>
          <SheetDescription>
            Configure the problem statement, constraints, and test cases.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="testcases">Test Cases</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
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
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Save Problem
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
