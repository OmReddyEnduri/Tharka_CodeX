import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function ContestTimer({ startTime, endTime }: { startTime: string; endTime: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (now < start) {
    return (
      <Badge variant="secondary" className="text-sm px-3 py-1">
        Starts in {formatDuration(start - now)}
      </Badge>
    );
  }
  if (now < end) {
    return (
      <Badge className="text-sm px-3 py-1">
        Ends in {formatDuration(end - now)}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-sm px-3 py-1">
      Contest ended
    </Badge>
  );
}
