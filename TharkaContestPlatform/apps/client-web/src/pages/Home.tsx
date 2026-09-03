import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrophyIcon, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getContests } from "@/lib/apiClient";

type ContestStatus = "live" | "upcoming" | "ended";

function contestStatus(startTime: string, endTime: string): ContestStatus {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "live";
}

function ContestRow({ contest }: { contest: any }) {
  return (
    <Link
      to={`/contest/${contest._id}`}
      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
    >
      <TrophyIcon className="h-5 w-5 text-primary" />
      <div>
        <div className="font-medium">{contest.name}</div>
        <div className="text-xs text-muted-foreground">
          {new Date(contest.startTime).toLocaleString()} - {new Date(contest.endTime).toLocaleString()}
        </div>
      </div>
    </Link>
  );
}

function ContestSection({ title, contests }: { title: string; contests: any[] }) {
  if (contests.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contests.map((c) => (
          <ContestRow key={c._id} contest={c} />
        ))}
      </CardContent>
    </Card>
  );
}

// Server URL is fixed in code (apiClient.ts) with an override only on the
// dedicated Settings page - this landing page is purely about finding a
// contest: search + grouped by status (Live/Upcoming/Previous).
export default function Home() {
  const [search, setSearch] = useState("");

  const { data: contests, isLoading } = useQuery({
    queryKey: ["contests"],
    queryFn: getContests,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contests || []).filter((c: any) => !q || c.name.toLowerCase().includes(q));
  }, [contests, search]);

  const live = filtered.filter((c: any) => contestStatus(c.startTime, c.endTime) === "live");
  const upcoming = filtered.filter((c: any) => contestStatus(c.startTime, c.endTime) === "upcoming");
  const ended = filtered.filter((c: any) => contestStatus(c.startTime, c.endTime) === "ended");

  return (
    <AppShell>
      <div className="container mx-auto max-w-2xl py-8 px-4 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contests..."
            className="pl-9"
          />
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            {contests && contests.length > 0 ? "No contests match your search." : "No contests found. Check with your admin."}
          </p>
        )}

        <ContestSection title="Live" contests={live} />
        <ContestSection title="Upcoming" contests={upcoming} />
        <ContestSection title="Previous" contests={ended} />
      </div>
    </AppShell>
  );
}
