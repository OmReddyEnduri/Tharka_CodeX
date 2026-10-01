import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trophy, Upload, Trash2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "@/components/SyncButton";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { apiClient } from "@/lib/apiClient";

function contestStatus(startTime: string, endTime: string) {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now < start) return { label: "Upcoming", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" };
  if (now > end) return { label: "Ended", className: "bg-muted text-muted-foreground" };
  return { label: "Live", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
}

export default function AdminContestsList() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { data: contests, isLoading } = useQuery({
    queryKey: ["contests"],
    queryFn: apiClient.listContests,
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.bulkDeleteContests(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["contests"] });
      setSelected(new Set());
      toast.success(`Deleted ${res.results.filter((r) => r.status === "deleted").length} contest(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected contest(s)? This also deletes their submissions.`)) return;
    if (!window.confirm("Are you sure? This can't be undone.")) return;
    bulkDeleteMutation.mutate(Array.from(selected));
  };

  return (
    <div className="space-y-6">
      <SyncButton />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contests</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" /> Delete Selected ({selected.size})
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" /> Bulk Import
          </Button>
          <Button asChild className="gap-2">
            <Link to="/contests/new">
              <Plus className="h-4 w-4" /> New Contest
            </Link>
          </Button>
        </div>
      </div>

      <BulkImportDialog mode="contests" isOpen={bulkOpen} onClose={() => setBulkOpen(false)} />

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="grid gap-4">
        {contests?.map((contest) => {
          const status = contestStatus(contest.startTime, contest.endTime);
          return (
            <Link key={contest._id} to={`/contests/${contest._id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selected.has(contest._id)}
                        onChange={() => toggleSelected(contest._id)}
                        className="h-4 w-4"
                      />
                    </span>
                    <Trophy className="h-4 w-4 text-primary" />
                    {contest.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {contest.isPrivate && (
                      <Badge variant="outline" className="gap-1 border-amber-500/60 text-amber-600" title="Only visible on this admin site">
                        <Lock className="h-3 w-3" /> Private
                      </Badge>
                    )}
                    <Badge className={status.className}>{status.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {new Date(contest.startTime).toLocaleString()} &rarr; {new Date(contest.endTime).toLocaleString()}
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {contests?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No contests yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}
