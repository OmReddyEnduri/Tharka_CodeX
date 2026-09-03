import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { applyTheme, initTheme, THEMES, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(initTheme());
  }, []);

  const onChange = (value: Theme) => {
    applyTheme(value);
    setTheme(value);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Palette className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={theme}
        onChange={(e) => onChange(e.target.value as Theme)}
        title="Theme"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {THEMES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
