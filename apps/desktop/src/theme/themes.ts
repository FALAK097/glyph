import type { ThemeMode } from "../shared/workspace";

export type ThemeDefinition = {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
};

export const themes: ThemeDefinition[] = [
  {
    id: "aura",
    name: "Aura",
    light: {
      "--bg": "#f6f4ef",
      "--panel": "#fffdf7",
      "--sidebar": "#17161f",
      "--sidebar-text": "#f3efe6",
      "--text": "#1f1d25",
      "--muted": "#7f778f",
      "--accent": "#8f67ff",
      "--border": "rgba(34, 28, 45, 0.08)"
    },
    dark: {
      "--bg": "#17161f",
      "--panel": "#211f2c",
      "--sidebar": "#0f0d16",
      "--sidebar-text": "#f3eefc",
      "--text": "#f5f1ff",
      "--muted": "#aaa1c2",
      "--accent": "#b197fc",
      "--border": "rgba(255, 255, 255, 0.08)"
    }
  },
  {
    id: "night-owl",
    name: "Night Owl",
    light: {
      "--bg": "#f5f8fc",
      "--panel": "#ffffff",
      "--sidebar": "#0f2233",
      "--sidebar-text": "#eaf6ff",
      "--text": "#102134",
      "--muted": "#5f7488",
      "--accent": "#118ab2",
      "--border": "rgba(17, 33, 52, 0.08)"
    },
    dark: {
      "--bg": "#011627",
      "--panel": "#0b2035",
      "--sidebar": "#08111d",
      "--sidebar-text": "#e6f1ff",
      "--text": "#d6deeb",
      "--muted": "#7a90a7",
      "--accent": "#7fdbca",
      "--border": "rgba(255, 255, 255, 0.08)"
    }
  },
  {
    id: "ayu",
    name: "Ayu",
    light: {
      "--bg": "#fff7e6",
      "--panel": "#fffaf0",
      "--sidebar": "#4d3b2f",
      "--sidebar-text": "#fff6eb",
      "--text": "#302116",
      "--muted": "#8e7159",
      "--accent": "#ff8f40",
      "--border": "rgba(48, 33, 22, 0.09)"
    },
    dark: {
      "--bg": "#0f1419",
      "--panel": "#171f29",
      "--sidebar": "#0b1014",
      "--sidebar-text": "#f8ead8",
      "--text": "#e6e1cf",
      "--muted": "#a29a89",
      "--accent": "#ffb454",
      "--border": "rgba(255, 255, 255, 0.08)"
    }
  },
  {
    id: "everforest",
    name: "Everforest",
    light: {
      "--bg": "#f2efdf",
      "--panel": "#fffbed",
      "--sidebar": "#3a4a3f",
      "--sidebar-text": "#f5f1df",
      "--text": "#273126",
      "--muted": "#6f7d66",
      "--accent": "#7f9d68",
      "--border": "rgba(39, 49, 38, 0.09)"
    },
    dark: {
      "--bg": "#2b3339",
      "--panel": "#313b40",
      "--sidebar": "#232a2e",
      "--sidebar-text": "#edf1e4",
      "--text": "#d3c6aa",
      "--muted": "#9da88f",
      "--accent": "#a7c080",
      "--border": "rgba(255, 255, 255, 0.08)"
    }
  }
];

export function getThemeDefinition(themeId: string) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}

export function applyTheme(themeId: string, mode: ThemeMode) {
  const theme = getThemeDefinition(themeId);
  const values = mode === "dark" ? theme.dark : theme.light;

  Object.entries(values).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  document.documentElement.dataset.theme = `${mode}:${theme.id}`;
}
