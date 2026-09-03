import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getResults } from "@/lib/apiClient";

export default function Leaderboard() {
  const { contestId } = useParams<{ contestId: string }>();

  // In Electron this reads the local mirror (no network), which only ever
  // changes when the admin presses Sync - useSyncSocket (App.tsx) already
  // invalidates this query on that event, so no need to poll. In the plain
  // browser build (no local mirror) it's a live server call, so keep
  // polling for a near-real-time view during a live contest.
  const isElectron = !!(window as any).contestAPI;
  const { data, isLoading } = useQuery({
    queryKey: ["results", contestId],
    queryFn: () => getResults(contestId!),
    enabled: !!contestId,
    refetchInterval: isElectron ? false : 12000,
  });

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}
            {!isLoading && (!data?.leaderboard || data.leaderboard.length === 0) && (
              <p className="text-muted-foreground text-sm">No submissions yet.</p>
            )}
            {data?.leaderboard?.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leaderboard.map((entry: any) => (
                    <TableRow key={entry.studentRollNumber}>
                      <TableCell>{entry.rank}</TableCell>
                      <TableCell>{entry.studentName}</TableCell>
                      <TableCell>{entry.studentRollNumber}</TableCell>
                      <TableCell className="text-right font-semibold">{entry.totalScore}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
