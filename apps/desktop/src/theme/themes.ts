import type { ThemeMode } from "@/core/workspace";

export function applyTheme(mode: ThemeMode) {
  try {
    localStorage.setItem("glyph.theme", mode);
  } catch {
    // Ignore storage access errors (private mode / sandbox restrictions).
  }

  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } else if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
