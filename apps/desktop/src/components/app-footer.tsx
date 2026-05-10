import type { ThemeMode } from "@/core/workspace";
import { ThemeToggle } from "./theme-toggle";

type AppFooterProps = {
  content: React.ReactNode;
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
};

export function AppFooter({ content, themeMode, onChangeTheme }: AppFooterProps) {
  return (
    <div className="shrink-0 flex items-center justify-between border-t border-border/40 bg-footer px-4 py-1.5 h-8">
      <div>{/* Left side - reserved for future use */}</div>
      <div className="flex items-center gap-3">
        {content}
        <div className="w-px h-2.5 bg-border/50 shrink-0" />
        <ThemeToggle themeMode={themeMode} onChangeTheme={onChangeTheme} />
      </div>
    </div>
  );
}
