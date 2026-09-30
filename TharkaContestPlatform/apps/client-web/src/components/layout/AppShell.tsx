import { Link, useLocation, useParams } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import { getIdentity } from "@/lib/identity";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { UpdateStatusIndicator } from "@/components/UpdateStatusIndicator";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { contestId } = useParams<{ contestId: string }>();
  const location = useLocation();
  // On the join/switch page itself, the *old* identity is still what's in
  // localStorage (nothing's been submitted yet) - showing "You are: Alice
  // [switch]" while Alice is actively in the middle of switching away read
  // exactly like the switch hadn't done anything, even though it works
  // correctly the moment the form is submitted. Simplest fix: just don't
  // show it on this one page.
  const onJoinPage = location.pathname.endsWith("/join");
  const identity = contestId && !onJoinPage ? getIdentity(contestId) : null;

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
          <UpdateStatusIndicator />
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
