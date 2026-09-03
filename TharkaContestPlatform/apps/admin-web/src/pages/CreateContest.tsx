import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/apiClient";

const contestSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid start time"),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid end time"),
});

type ContestFormData = z.infer<typeof contestSchema>;

// yyyy-MM-ddThh:mm, the format <input type="datetime-local"> expects.
function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateContest() {
  const { contestId } = useParams<{ contestId: string }>();
  const isEditMode = !!contestId;
  const navigate = useNavigate();

  const form = useForm<ContestFormData>({ resolver: zodResolver(contestSchema) });

  const { data: existing } = useQuery({
    queryKey: ["contest", contestId],
    queryFn: () => apiClient.getContest(contestId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        name: existing.name,
        description: existing.description || "",
        startTime: toLocalInputValue(existing.startTime),
        endTime: toLocalInputValue(existing.endTime),
      });
    }
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (data: ContestFormData) =>
      isEditMode ? apiClient.updateContest(contestId!, data) : apiClient.createContest(data),
    onSuccess: (contest) => {
      toast.success(isEditMode ? "Contest updated" : "Contest created");
      navigate(`/contests/${contest._id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditMode ? "Edit Contest" : "Create New Contest"}</CardTitle>
        <CardDescription>Fill out the details for the contest.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Contest Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" type="datetime-local" {...form.register("startTime")} />
              {form.formState.errors.startTime && (
                <p className="text-red-500 text-sm">{form.formState.errors.startTime.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" type="datetime-local" {...form.register("endTime")} />
              {form.formState.errors.endTime && (
                <p className="text-red-500 text-sm">{form.formState.errors.endTime.message}</p>
              )}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : isEditMode ? "Save Changes" : "Create Contest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
