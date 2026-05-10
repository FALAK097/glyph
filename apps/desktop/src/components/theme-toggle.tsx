import { useCallback, useMemo } from "react";
import { SunIcon, MoonIcon, MonitorIcon } from "./icons";
import type { ThemeMode } from "@/core/workspace";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

type ThemeToggleProps = {
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
};

export function ThemeToggle({ themeMode, onChangeTheme }: ThemeToggleProps) {
  const handleToggle = useCallback(() => {
    if (themeMode === "light") {
      onChangeTheme("dark");
    } else if (themeMode === "dark") {
      onChangeTheme("system");
    } else {
      onChangeTheme("light");
    }
  }, [themeMode, onChangeTheme]);

  const { Icon, label } = useMemo(() => {
    switch (themeMode) {
      case "light":
        return { Icon: SunIcon, label: "Light" };
      case "dark":
        return { Icon: MoonIcon, label: "Dark" };
      case "system":
        return { Icon: MonitorIcon, label: "System" };
      default:
        return { Icon: MonitorIcon, label: "System" };
    }
  }, [themeMode]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleToggle}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          aria-label={`Change theme (currently ${label})`}
        >
          <Icon size={14} strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label} Theme
      </TooltipContent>
    </Tooltip>
  );
}
