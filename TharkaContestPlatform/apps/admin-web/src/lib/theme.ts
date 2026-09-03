// Six app-wide themes (not just a light/dark binary), each a `data-theme`
// attribute on <html> with its own CSS variable palette in index.css. The
// `.dark` class is also toggled alongside it (for Tailwind's `dark:`
// utility variants already used in a few components) for every theme in the
// dark family. Persisted to localStorage, falling back to OS preference.
export type Theme = "light" | "dark" | "dim" | "midnight" | "solarized" | "highContrast";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "dim", label: "Dim" },
  { value: "midnight", label: "Midnight" },
  { value: "solarized", label: "Solarized" },
  { value: "highContrast", label: "High Contrast" },
];

const DARK_FAMILY: Theme[] = ["dark", "dim", "midnight"];
const THEME_KEY = "contest_theme";

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", DARK_FAMILY.includes(theme));
  localStorage.setItem(THEME_KEY, theme);
}

export function initTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  const theme: Theme =
    stored && THEMES.some((t) => t.value === stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  applyTheme(theme);
  return theme;
}
