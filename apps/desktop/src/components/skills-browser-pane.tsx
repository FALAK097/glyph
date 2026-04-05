import type { SkillBrowserItem } from "@/lib/skill-groups";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { SearchIcon } from "./icons";
import { SkillSourceLogo, SkillSourceLogoStack } from "./skill-source-logo";

type SkillsBrowserPaneProps = {
  activeSkillId: string | null;
  isLoading?: boolean;
  items: SkillBrowserItem[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectSkill: (skillId: string) => void;
  title: string;
};

export function SkillsBrowserPane({
  activeSkillId,
  isLoading = false,
  items,
  searchQuery,
  onSearchQueryChange,
  onSelectSkill,
  title,
}: SkillsBrowserPaneProps) {
  const countLabel = "skill";
  const searchLabel = "skills";
  const isMacLike = navigator.platform.includes("Mac");
  const headerSpacingClass = isMacLike ? "pt-8" : "pt-4";
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <aside className="flex h-full min-h-0 w-[292px] flex-col border-r border-border bg-background">
      <div className={`border-b border-border/70 px-4 py-3 ${headerSpacingClass}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <p className="text-xs text-muted-foreground">
            {items.length} {countLabel}
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="relative mt-3">
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80"
          />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={`Search ${searchLabel}...`}
            aria-label={`Search ${searchLabel}`}
            className="h-8 border-border/70 bg-background pl-8 pr-2.5 text-sm shadow-none"
          />
        </div>
      </div>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="space-y-2 px-1 pt-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-border/40 bg-background px-3 py-3"
              >
                <div className="h-4 w-24 rounded bg-muted/60 motion-safe:animate-pulse" />
                <div className="mt-2 h-3 w-16 rounded bg-muted/45 motion-safe:animate-pulse" />
                <div className="mt-3 h-3 w-full rounded bg-muted/35 motion-safe:animate-pulse" />
                <div className="mt-2 h-3 w-3/4 rounded bg-muted/30 motion-safe:animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl px-3 py-3 text-sm text-muted-foreground">
            {hasQuery
              ? "No skills match your search yet."
              : "No skills are available in this source yet."}
          </div>
        ) : (
          items.map((item) => {
            const isActive = item.memberSkillIds.includes(activeSkillId ?? "");
            const tooltipLabels = item.sourceNames;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectSkill(item.representativeSkillId)}
                className={cn(
                  "mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.99]",
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/70",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    {item.hasAgentsFile ? (
                      <span className="shrink-0 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Agent
                      </span>
                    ) : null}
                  </div>
                  {tooltipLabels.length > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mt-1.5 inline-flex w-fit items-center">
                          {item.sourceKinds.length > 1 ? (
                            <SkillSourceLogoStack
                              sourceKinds={item.sourceKinds}
                              variant="compact"
                            />
                          ) : (
                            <SkillSourceLogo
                              fallbackLabel={item.sourceNames[0] ?? item.name}
                              sourceKind={item.sourceKinds[0]}
                              variant="compact"
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="max-w-[240px] text-left leading-5"
                      >
                        {tooltipLabels.join(", ")}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  {item.description ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
