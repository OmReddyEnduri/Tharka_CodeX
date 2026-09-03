import { Link, useParams } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import { getIdentity } from "@/lib/identity";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { contestId } = useParams<{ contestId: string }>();
  const identity = contestId ? getIdentity(contestId) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-semibold text-sm">
            Tharka Codex
          </Link>
          <Link to="/compiler" className="text-sm text-muted-foreground hover:text-foreground">
            Compiler
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatusIndicator />
          {identity && contestId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {identity.name} ({identity.rollNumber})
              </span>
              <Link to={`/contest/${contestId}/join`} className="underline text-xs">
                switch
              </Link>
            </div>
          )}
          <ThemeToggle />
          <Link to="/settings" title="Settings" className="text-muted-foreground hover:text-foreground">
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
