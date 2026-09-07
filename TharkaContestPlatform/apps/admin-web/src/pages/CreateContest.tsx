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
  hideHiddenTestCasesWhileLive: z.boolean(),
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

  const form = useForm<ContestFormData>({
    resolver: zodResolver(contestSchema),
    defaultValues: { hideHiddenTestCasesWhileLive: true },
  });

  const { data: existing } = useQuery({
    queryKey: ["contest", contestId],
    queryFn: () => apiClient.getContest(contestId!),
    enabled: isEditMode,
    // Without this, React Query's default refetchOnWindowFocus would
    // refetch (with a new object reference, even if nothing changed) the
    // moment the admin alt-tabs mid-edit, re-firing the reset effect below
    // and silently discarding whatever they'd already typed - e.g. edit the
    // end time, glance at another tab, come back, save, and the extension
    // is just gone with no error. This page navigates away on a successful
    // save, so there's nothing else that needs this to ever refetch.
    staleTime: Infinity,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        name: existing.name,
        description: existing.description || "",
        startTime: toLocalInputValue(existing.startTime),
        endTime: toLocalInputValue(existing.endTime),
        hideHiddenTestCasesWhileLive: existing.settings?.hideHiddenTestCasesWhileLive ?? true,
      });
    }
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: ({ hideHiddenTestCasesWhileLive, ...data }: ContestFormData) => {
      const payload = { ...data, settings: { hideHiddenTestCasesWhileLive } };
      return isEditMode ? apiClient.updateContest(contestId!, payload) : apiClient.createContest(payload);
    },
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
          <div className="flex items-start gap-2 rounded-md border p-3">
            <input
              id="hideHiddenTestCasesWhileLive"
              type="checkbox"
              className="mt-1"
              {...form.register("hideHiddenTestCasesWhileLive")}
            />
            <div className="space-y-1">
              <Label htmlFor="hideHiddenTestCasesWhileLive" className="cursor-pointer">
                Hide hidden test case I/O while contest is live
              </Label>
              <p className="text-xs text-muted-foreground">
                While ON, a Wrong Answer/TLE/etc. result only shows the verdict and test number - not the actual
                input/expected/got - until the contest ends. Applies on every laptop, browser or the Electron app,
                the next time it syncs. Turn OFF only for practice/open-book contests.
              </p>
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
