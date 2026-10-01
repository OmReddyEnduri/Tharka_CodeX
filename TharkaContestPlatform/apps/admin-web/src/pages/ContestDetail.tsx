import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BarChart3, FileCode, Upload, GripVertical, Lock } from "lucide-react";
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
  const [selectedProblems, setSelectedProblems] = useState<Set<number>>(new Set());
  const [orderedProblems, setOrderedProblems] = useState<ContestProblem[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const { data: contest, isLoading } = useQuery({
    queryKey: ["contest", contestId],
    queryFn: () => apiClient.getContest(contestId!),
    enabled: !!contestId,
  });

  // Local copy so a drag can reorder instantly, without waiting on a
  // round-trip - kept in sync whenever the server data changes (initial
  // load, or after our own reorder mutation invalidates the query).
  useEffect(() => {
    if (contest) setOrderedProblems(contest.problems);
  }, [contest]);

  const reorderMutation = useMutation({
    mutationFn: (problemIds: number[]) => apiClient.reorderProblems(contestId!, problemIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contest", contestId] }),
    onError: (err: Error) => {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ["contest", contestId] });
    },
  });

  const handleDrop = (targetId: number) => {
    if (draggingId === null || draggingId === targetId) return;
    const fromIndex = orderedProblems.findIndex((p) => p.id === draggingId);
    const toIndex = orderedProblems.findIndex((p) => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...orderedProblems];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedProblems(next);
    setDraggingId(null);
    reorderMutation.mutate(next.map((p) => p.id));
  };

  const deleteProblemMutation = useMutation({
    mutationFn: (problemId: number) => apiClient.deleteProblem(contestId!, problemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contest", contestId] });
      toast.success("Problem removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkDeleteProblemsMutation = useMutation({
    mutationFn: (problemIds: number[]) => apiClient.bulkDeleteProblems(contestId!, problemIds),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["contest", contestId] });
      setSelectedProblems(new Set());
      toast.success(`Removed ${res.results.filter((r) => r.status === "removed").length} problem(s)`);
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

  const toggleSelectedProblem = (id: number) => {
    setSelectedProblems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteProblems = () => {
    if (selectedProblems.size === 0) return;
    if (!window.confirm(`Remove ${selectedProblems.size} selected problem(s) from this contest?`)) return;
    if (!window.confirm("Are you sure? This can't be undone.")) return;
    bulkDeleteProblemsMutation.mutate(Array.from(selectedProblems));
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {contest.name}
            {contest.isPrivate && (
              <Badge variant="outline" className="gap-1 border-amber-500/60 text-amber-600" title="Students and lab laptops cannot see this contest">
                <Lock className="h-3 w-3" /> Private - admin only
              </Badge>
            )}
          </h1>
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
            {selectedProblems.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={handleBulkDeleteProblems}
                disabled={bulkDeleteProblemsMutation.isPending}
              >
                <Trash2 className="h-4 w-4" /> Delete Selected ({selectedProblems.size})
              </Button>
            )}
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
          {orderedProblems.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No problems yet.</p>
          )}
          {orderedProblems.map((problem) => (
            <div
              key={problem.id}
              draggable
              onDragStart={() => setDraggingId(problem.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(problem.id)}
              onDragEnd={() => setDraggingId(null)}
              className={`flex items-center justify-between p-3 border rounded-lg ${
                draggingId === problem.id ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedProblems.has(problem.id)}
                  onChange={() => toggleSelectedProblem(problem.id)}
                />
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
