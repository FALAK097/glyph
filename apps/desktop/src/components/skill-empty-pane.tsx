import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { GearIcon, PanelLeftIcon, PanelRightIcon, SearchIcon } from "./icons";

type SkillEmptyPaneProps = {
  commandPaletteShortcut?: string;
  description: string;
  isSidebarCollapsed?: boolean;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
  titleLabel?: string;
  title: string;
};

export function SkillEmptyPane({
  commandPaletteShortcut,
  description,
  isSidebarCollapsed = false,
  onOpenCommandPalette,
  onOpenSettings,
  onToggleSidebar,
  title,
  titleLabel = "Skills",
}: SkillEmptyPaneProps) {
  const isMacLike = navigator.platform.includes("Mac");
  const headerPaddingClass = isSidebarCollapsed && isMacLike ? "pl-20 pr-4" : "px-4";

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div
        className={`flex items-center gap-2 border-b border-border/40 py-2 ${headerPaddingClass}`}
      >
        <div className="flex min-w-0 flex-shrink-0 items-center gap-1">
          {onToggleSidebar ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="flex-shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={onToggleSidebar}
                  type="button"
                >
                  {isSidebarCollapsed ? <PanelRightIcon size={16} /> : <PanelLeftIcon size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <span className="max-w-[220px] truncate pl-1 text-sm font-medium text-foreground">
            {titleLabel}
          </span>
        </div>

        {onOpenCommandPalette ? (
          <div className="flex min-w-0 flex-1 justify-center px-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full max-w-sm justify-between px-3 py-1.5 text-sm text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={onOpenCommandPalette}
              type="button"
            >
              <div className="flex items-center gap-2">
                <SearchIcon size={13} className="flex-shrink-0 opacity-60" />
                <span>Search notes and skills</span>
              </div>
              <span className="ml-4 flex-shrink-0 font-mono text-xs opacity-50">
                {commandPaletteShortcut ?? "⌘P"}
              </span>
            </Button>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex flex-shrink-0 items-center gap-1">
          {onOpenSettings ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={onOpenSettings}
                  type="button"
                >
                  <GearIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-10">
        <div className="mx-auto max-w-md text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Skills
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
  );
}
