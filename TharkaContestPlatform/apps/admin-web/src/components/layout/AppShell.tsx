import { Link, Outlet } from "react-router-dom";
import { Trophy, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="h-5 w-5 text-primary" />
            Tharka Codex Admin
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/judge-settings"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              title="Judge Settings"
            >
              <Settings className="h-4 w-4" />
              Judge Settings
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
