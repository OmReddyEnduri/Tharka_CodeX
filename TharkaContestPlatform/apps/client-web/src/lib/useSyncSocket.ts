import { useEffect } from "react";
import { io } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";
import { getServerUrl } from "./apiClient";

// In Electron, main.js owns the real sync connection (pulls the full
// snapshot into local SQLite on push) - the renderer just needs to know
// *when* that happened so it can refetch from the now-updated local mirror,
// via the contestAPI.onSyncPush bridge event. In the plain browser build
// (no local mirror yet) the renderer connects directly and a push simply
// triggers an immediate refetch of whatever's on screen.
export function useSyncSocket(queryClient: QueryClient) {
  useEffect(() => {
    const contestAPI = typeof window !== "undefined" ? (window as any).contestAPI : undefined;

    // refetchType: "all" - React Query's default invalidateQueries() only
    // force-refetches queries that are currently mounted/on-screen; anything
    // not actively being viewed (a problem you haven't opened yet, a
    // leaderboard tab that's not focused) is just marked stale and would
    // only actually refetch the next time you navigate to it. That's what
    // made a synced problem look "not updated" until you opened it - the
    // underlying local data was already fresh, the on-screen cache just
    // hadn't been told to go get it. Forcing every query (mounted or not) to
    // refetch immediately means a Sync always updates everything right away.
    if (contestAPI?.onSyncPush) {
      const unsubscribe = contestAPI.onSyncPush(() => queryClient.invalidateQueries({ refetchType: "all" }));
      return () => unsubscribe?.();
    }

    const socket = io(getServerUrl(), { transports: ["websocket", "polling"] });
    socket.on("sync:push", () => {
      queryClient.invalidateQueries({ refetchType: "all" });
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
