import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BarChart3, FileCode, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContestProblemEditorSheet } from "@/components/ContestProblemEditorSheet";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { apiClient } from "@/lib/apiClient";
import type { ContestProblem } from "@/lib/types";

export default function ContestDetail() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ContestProblem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data: contest, isLoading } = useQuery({
    queryKey: ["contest", contestId],
    queryFn: () => apiClient.getContest(contestId!),
    enabled: !!contestId,
  });

  const deleteProblemMutation = useMutation({
    mutationFn: (problemId: number) => apiClient.deleteProblem(contestId!, problemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contest", contestId] });
      toast.success("Problem removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteContestMutation = useMutation({
    mutationFn: () => apiClient.deleteContest(contestId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contests"] });
      toast.success("Contest deleted");
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDeleteProblem = (problem: ContestProblem) => {
    if (!window.confirm(`Delete "${problem.title}"? This removes it from this contest.`)) return;
    if (!window.confirm("Are you sure? This can't be undone.")) return;
    deleteProblemMutation.mutate(problem.id);
  };

  const handleDeleteContest = () => {
    if (!contest) return;
    if (!window.confirm(`Delete contest "${contest.name}"? This also deletes all its submissions.`)) return;
    if (!window.confirm("Are you sure? This can't be undone.")) return;
    deleteContestMutation.mutate();
  };

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!contest) return <p className="text-muted-foreground">Contest not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{contest.name}</h1>
          <p className="text-muted-foreground">{contest.description}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(contest.startTime).toLocaleString()} &rarr; {new Date(contest.endTime).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link to={`/contests/${contestId}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link to={`/contests/${contestId}/results`}>
              <BarChart3 className="h-4 w-4" /> Results
            </Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={handleDeleteContest}
            disabled={deleteContestMutation.isPending}
          >
            <Trash2 className="h-4 w-4" /> Delete Contest
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Problems</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4" /> Bulk Add
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditingProblem(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Problem
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {contest.problems.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No problems yet.</p>
          )}
          {contest.problems.map((problem) => (
            <div key={problem.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileCode className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{problem.title}</span>
                <Badge variant="secondary">{problem.difficulty}</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingProblem(problem);
                    setEditorOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleDeleteProblem(problem)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ContestProblemEditorSheet
        contestId={contestId!}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        editingProblem={editingProblem}
      />

      <BulkImportDialog mode="problems" contestId={contestId!} isOpen={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}
