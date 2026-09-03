import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getServerUrl, apiClient } from "./apiClient";

export function useSyncStatus() {
  const [connected, setConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(0);
  const [version, setVersion] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(getServerUrl(), { reconnection: true });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("sync:push", (payload: { version: number }) => setVersion(payload.version));

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const status = await apiClient.getSyncVersion();
        setConnectedClients(status.connectedClients);
        setVersion(status.version);
      } catch {
        // server unreachable - leave last-known values in place
      }
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  return { connected, connectedClients, version };
}
