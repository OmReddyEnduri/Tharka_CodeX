import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DownloadCloud, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getServerUrl, setServerUrl, isElectron, getAppVersion, checkForUpdate, openUpdateLog } from "@/lib/apiClient";

// The server URL has a sane baked-in default (apiClient.ts) and isn't
// exposed for editing on the main contest-finding flow - this is the one
// place it can still be overridden, for the rare laptop pointed at a
// different server.
export default function Settings() {
  const [serverUrlInput, setServerUrlInput] = useState(getServerUrl());

  const save = () => {
    setServerUrl(serverUrlInput);
    toast.success("Server URL saved. Reload any open pages to pick it up.");
  };

  // Electron only - the plain browser build has nothing to update.
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    if (isElectron()) {
      getAppVersion().then(setAppVersion);
    }
  }, []);

  const handleCheckForUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForUpdate();
      if (result && !result.ok) {
        toast.error(result.reason || "Could not check for updates.");
      } else {
        toast.success("Checking for updates...", {
          description: "Progress shows in the top bar. This may restart the app.",
        });
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleOpenUpdateLog = async () => {
    const result = await openUpdateLog();
    if (result && !result.ok) {
      toast.error(result.reason || "Could not open the update log.");
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-2xl py-8 px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Server</CardTitle>
            <CardDescription>
              Point this laptop at the contest server on your LAN. Only needed if it's different from the default.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="server-url">Server URL</Label>
              <Input
                id="server-url"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="http://192.168.1.101:3001"
              />
            </div>
            <Button className="self-end" onClick={save}>
              Save
            </Button>
          </CardContent>
        </Card>

        {isElectron() && (
          <Card>
            <CardHeader>
              <CardTitle>App Update</CardTitle>
              <CardDescription>
                {appVersion ? `Current version: ${appVersion}. ` : ""}
                Updates only happen when you click this - never automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="ghost" onClick={handleOpenUpdateLog} title="Every check/download/install step, in order">
                <FileText className="h-4 w-4" /> View Log
              </Button>
              <Button onClick={handleCheckForUpdate} disabled={checkingUpdate}>
                <DownloadCloud className="h-4 w-4" /> {checkingUpdate ? "Checking..." : "Check for Updates"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
