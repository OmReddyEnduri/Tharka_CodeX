import { useEffect, useState } from "react";
import { RefreshCw, CloudOff, CheckCircle2 } from "lucide-react";
import { isElectron, getSyncState, onSyncStatus } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type SyncState = { status: string; version: number; lastSyncedAt: string | null };

function formatTime(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Electron-only - the plain browser build has no local mirror to be stale,
// it either has the server or it doesn't load at all. Surfaces the sync
// state main.js already tracks (see main.js's broadcastSyncStatus) so a
// student/admin can actually see "still pulling" vs "safe to go offline"
// instead of finding out the hard way that a sync hadn't landed yet.
export function SyncStatusIndicator() {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    if (!isElectron()) return;
    getSyncState().then((s) => s && setState({ status: s.online ? "synced" : "offline", ...s }));
    return onSyncStatus((s) => setState(s));
  }, []);

  if (!state) return null;

  const isSyncing = state.status === "syncing";
  const isOffline = state.status === "offline";

  return (
    <div
      title={`Local data last synced: ${formatTime(state.lastSyncedAt)}`}
      className={cn(
        "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border",
        isSyncing && "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40",
        isOffline && "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40",
        !isSyncing && !isOffline && "text-green-600 dark:text-green-400 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40",
      )}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" /> Syncing…
        </>
      ) : isOffline ? (
        <>
          <CloudOff className="h-3 w-3" /> Offline · cached from {formatTime(state.lastSyncedAt)}
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3 w-3" /> Synced {formatTime(state.lastSyncedAt)}
        </>
      )}
    </div>
  );
}
