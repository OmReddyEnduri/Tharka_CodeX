import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/apiClient";
import { useSyncStatus } from "@/lib/useSyncStatus";

export function SyncButton() {
  const { connected, connectedClients } = useSyncStatus();
  const [syncing, setSyncing] = useState(false);

  const syncMutation = useMutation({
    mutationFn: () => apiClient.triggerSync(),
    onMutate: () => setSyncing(true),
    onSettled: () => setSyncing(false),
    onSuccess: (data) => {
      toast.success(`Synced v${data.version} — pushed to ${data.notifiedClients} device(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {connected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
        {connectedClients} device{connectedClients === 1 ? "" : "s"} connected
      </div>
      <Button size="sm" onClick={() => syncMutation.mutate()} disabled={syncing} className="ml-auto gap-2">
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync"}
      </Button>
    </div>
  );
}
