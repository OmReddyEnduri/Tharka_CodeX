import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trophy, Upload } from "lucide-react";
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
  const { data: contests, isLoading } = useQuery({
    queryKey: ["contests"],
    queryFn: apiClient.listContests,
  });

  return (
    <div className="space-y-6">
      <SyncButton />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contests</h1>
        <div className="flex gap-2">
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
                    <Trophy className="h-4 w-4 text-primary" />
                    {contest.name}
                  </CardTitle>
                  <Badge className={status.className}>{status.label}</Badge>
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
