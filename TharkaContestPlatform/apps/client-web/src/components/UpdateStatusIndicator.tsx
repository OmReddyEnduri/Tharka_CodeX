import { useEffect, useState } from "react";
import { DownloadCloud, RefreshCw } from "lucide-react";
import { isElectron, onUpdateStatus, type UpdateStatus } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

// Electron-only, same seam as SyncStatusIndicator - surfaces main.js's
// autoUpdater events (see broadcastUpdateStatus) so a check/download that
// used to happen invisibly in the background is now something a student or
// admin can actually see progress on, instead of "it restarted and I have
// no idea if anything happened." Renders nothing once idle/up-to-date -
// this is meant to be noticed only while something's actually going on.
export function UpdateStatusIndicator() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    if (!isElectron()) return;
    return onUpdateStatus(setStatus);
  }, []);

  if (!status) return null;
  if (status.status === "up-to-date" || status.status === "checking") return null;

  const isError = status.status === "error";

  return (
    <div
      title={status.message}
      className={cn(
        "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border",
        isError
          ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
          : "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
      )}
    >
      {status.status === "available" && (
        <>
          <DownloadCloud className="h-3 w-3" /> Update v{status.version} found - downloading...
        </>
      )}
      {status.status === "downloading" && (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" /> Updating... {status.percent ?? 0}%
        </>
      )}
      {(status.status === "downloaded" || status.status === "installing") && (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" /> Installing update v{status.version} - restarting shortly...
        </>
      )}
      {isError && <>Update check failed - see TharkaCodexUpdate.log in Downloads</>}
    </div>
  );
}
