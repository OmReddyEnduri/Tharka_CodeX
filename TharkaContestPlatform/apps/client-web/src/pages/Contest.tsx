import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrophyIcon, FileCode, ListOrdered } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContestTimer } from "@/components/ContestTimer";
import { cn } from "@/lib/utils";
import { getContest } from "@/lib/apiClient";
import { getIdentity } from "@/lib/identity";

export default function Contest() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (contestId && !getIdentity(contestId)) {
      navigate(`/contest/${contestId}/join`, { replace: true });
    }
  }, [contestId, navigate]);

  const { data: contest, isLoading, isError, error } = useQuery<any>({
    queryKey: ["contest", contestId],
    queryFn: () => getContest(contestId!),
    enabled: !!contestId,
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="container p-8">Loading contest...</div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell>
        <div className="container p-8">Error: {(error as Error).message}</div>
      </AppShell>
    );
  }

  // In Electron, getContest() reads the local mirror via IPC and resolves
  // with null instead of throwing when the contest isn't there (deleted or
  // recreated with a different id while this laptop was offline, then a
  // fresh sync lands) - unlike the plain-browser fallback, which throws on a
  // 404 and is already caught by isError above. Without this check the
  // render below crashes on `contest.name` with nothing mounted afterward -
  // a blank/black screen with no way back except restarting the app.
  if (!contest) {
    return (
      <AppShell>
        <div className="container p-8 text-center space-y-2">
          <p className="font-semibold">Contest not found.</p>
          <p className="text-muted-foreground text-sm">
            It may have been removed or replaced since this laptop last synced.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const notStarted = new Date(contest.startTime).getTime() > Date.now();

  return (
    <AppShell>
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-4">
            <TrophyIcon className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{contest.name}</h1>
              <p className="text-muted-foreground">{contest.description}</p>
            </div>
          </div>
          <ContestTimer startTime={contest.startTime} endTime={contest.endTime} />
        </div>

        {!notStarted && (
          <div className="mb-4">
            <Button asChild variant="outline" size="sm">
              <Link to={`/contest/${contestId}/leaderboard`}>
                <ListOrdered className="h-4 w-4 mr-2" /> Leaderboard
              </Link>
            </Button>
          </div>
        )}

        {notStarted ? (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <p className="font-semibold">This contest hasn't started yet.</p>
              <p className="text-muted-foreground text-sm">
                Problems will unlock at {new Date(contest.startTime).toLocaleString()}. Come back then.
              </p>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>Problems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contest.problems && contest.problems.length > 0 ? (
                contest.problems.map((problem: any) => (
                  <div
                    key={problem._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileCode className="h-5 w-5 text-blue-500" />
                      <span className="font-semibold">{problem.title}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge
                        className={cn(
                          "text-xs",
                          problem.difficulty === "Easy"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : problem.difficulty === "Medium"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                        )}
                      >
                        {problem.difficulty}
                      </Badge>
                      <Button asChild>
                        <Link to={`/contest/${contestId}/problem/${problem.id}`}>Solve Problem</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No problems have been added to this contest yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </AppShell>
  );
}
