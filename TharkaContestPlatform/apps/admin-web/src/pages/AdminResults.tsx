import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldOff, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/apiClient";
import type { LeaderboardEntry } from "@/lib/types";

interface ViewingCell {
  problemId: number;
  problemTitle: string;
  studentRollNumber: string;
  studentName: string;
}

export default function AdminResults() {
  const { contestId } = useParams<{ contestId: string }>();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<ViewingCell | null>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ["results", contestId],
    queryFn: () => apiClient.getResults(contestId!),
    enabled: !!contestId,
    refetchInterval: 8000,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ["submissions", contestId, viewing?.problemId, viewing?.studentRollNumber],
    queryFn: () => apiClient.getProblemSubmissions(contestId!, viewing!.problemId, viewing!.studentRollNumber),
    enabled: !!contestId && !!viewing,
  });

  const disqualifyMutation = useMutation({
    mutationFn: (vars: { studentRollNumber: string; studentName: string; disqualified: boolean }) =>
      apiClient.setDisqualified(contestId!, vars),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["results", contestId] });
      toast.success(vars.disqualified ? `${vars.studentName} disqualified` : `${vars.studentName} re-qualified`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleToggleDisqualify = (entry: LeaderboardEntry) => {
    const next = !entry.disqualified;
    const verb = next ? "Disqualify" : "Re-qualify";
    if (!window.confirm(`${verb} ${entry.studentName} (${entry.studentRollNumber})?`)) return;
    if (!window.confirm("Are you sure?")) return;
    disqualifyMutation.mutate({
      studentRollNumber: entry.studentRollNumber,
      studentName: entry.studentName,
      disqualified: next,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Results</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Loading...</p>}
        {results && results.leaderboard.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No submissions yet.</p>
        )}
        {results && results.leaderboard.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Roll No.</TableHead>
                {results.problems.map((p) => (
                  <TableHead key={p.id} className="text-center">
                    {p.title}
                  </TableHead>
                ))}
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.leaderboard.map((entry) => (
                <TableRow key={entry.studentRollNumber} className={entry.disqualified ? "opacity-60" : ""}>
                  <TableCell>{entry.disqualified ? "-" : entry.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entry.studentName}
                      {entry.disqualified && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          Disqualified
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{entry.studentRollNumber}</TableCell>
                  {results.problems.map((p) => {
                    const score = entry.scores[p.id];
                    return (
                      <TableCell key={p.id} className="text-center text-xs">
                        {score ? (
                          <button
                            type="button"
                            className={
                              score.verdict === "Accepted"
                                ? "text-green-600 dark:text-green-400 font-medium underline decoration-dotted underline-offset-2"
                                : "text-muted-foreground underline decoration-dotted underline-offset-2"
                            }
                            onClick={() =>
                              setViewing({
                                problemId: p.id,
                                problemTitle: p.title,
                                studentRollNumber: entry.studentRollNumber,
                                studentName: entry.studentName,
                              })
                            }
                          >
                            {score.verdict === "Accepted" ? "AC" : score.verdict}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">{entry.totalScore}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className={entry.disqualified ? "gap-2" : "gap-2 text-destructive hover:text-destructive"}
                      onClick={() => handleToggleDisqualify(entry)}
                      disabled={disqualifyMutation.isPending}
                    >
                      {entry.disqualified ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                      {entry.disqualified ? "Re-qualify" : "Disqualify"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewing?.studentName} — {viewing?.problemTitle}
            </DialogTitle>
            <DialogDescription>
              Roll No. {viewing?.studentRollNumber}. Most recent attempt first.
            </DialogDescription>
          </DialogHeader>

          {submissionsLoading && <p className="text-muted-foreground text-sm">Loading...</p>}
          {submissions && submissions.length === 0 && (
            <p className="text-muted-foreground text-sm">No submissions found.</p>
          )}
          <div className="space-y-4">
            {submissions?.map((sub) => (
              <div key={sub._id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={
                      sub.verdict === "Accepted"
                        ? "font-medium text-green-600 dark:text-green-400"
                        : "font-medium text-muted-foreground"
                    }
                  >
                    {sub.verdict} ({sub.testCasesPassed}/{sub.totalTestCases} tests, {sub.timeTaken}ms)
                  </span>
                  <span className="text-muted-foreground">{new Date(sub.submittedAt).toLocaleString()}</span>
                </div>
                <pre className="text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre">{sub.code}</pre>
                {sub.errorLog && (
                  <pre className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">{sub.errorLog}</pre>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
