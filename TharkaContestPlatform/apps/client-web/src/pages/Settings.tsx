import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getServerUrl, setServerUrl } from "@/lib/apiClient";

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
      </div>
    </AppShell>
  );
}
