import type { SkillBrowserItem } from "@/lib/skill-groups";
import { cn } from "@/lib/utils";
import { getCatalogEntryForTool } from "@/shared/skill-agent-catalog";

import { Input } from "./ui/input";
import { SearchIcon } from "./icons";
import { SkillSourceLogo, SkillSourceLogoStack } from "./skill-source-logo";

type SkillsBrowserPaneProps = {
  activeSkillId: string | null;
  items: SkillBrowserItem[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectSkill: (skillId: string) => void;
  title: string;
};

export function SkillsBrowserPane({
  activeSkillId,
  items,
  searchQuery,
  onSearchQueryChange,
  onSelectSkill,
  title,
}: SkillsBrowserPaneProps) {
  const countLabel = title === "All Agents" ? "agent" : "skill";
  const isMacLike = navigator.platform.includes("Mac");
  const headerSpacingClass = isMacLike ? "pt-8" : "pt-4";
  const hasQuery = searchQuery.trim().length > 0;
  const isAggregateView =
    title === "All Skills" || title === "All Agents" || title === "Global" || title === "Project";

  const summarizeLabels = (labels: string[]) => {
    if (labels.length === 0) {
      return "";
    }

    if (labels.length <= 3) {
      return labels.join(", ");
    }

    return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
  };

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
            placeholder="Search skills..."
            aria-label="Search skills"
            className="h-8 border-border/70 bg-background pl-8 pr-2.5 text-sm shadow-none"
          />
        </div>
      </div>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <div className="rounded-xl px-3 py-3 text-sm text-muted-foreground">
            {hasQuery
              ? title === "All Agents"
                ? "No agents match your search yet."
                : "No skills match your search yet."
              : title === "All Agents"
                ? "No agents are available in your connected tool folders yet."
                : "No skills are available in this source yet."}
          </div>
        ) : (
          items.map((item) => {
            const isActive = item.memberSkillIds.includes(activeSkillId ?? "");
            const compatibilityLabels = item.sourceKinds
              .map((kind) => getCatalogEntryForTool(kind)?.label ?? null)
              .filter((label): label is string => Boolean(label));
            const scopeLabels = item.sourceNames.filter(
              (name) => name === "Global" || name === "Project",
            );
            const sourceSummary = isAggregateView
              ? scopeLabels.length > 0
                ? `${scopeLabels.join(", ")}${compatibilityLabels.length > 0 ? ` · ${summarizeLabels(compatibilityLabels)}` : ""}`
                : summarizeLabels(item.sourceNames)
              : compatibilityLabels.length > 0
                ? summarizeLabels(compatibilityLabels)
                : item.sourceNames.join(", ");

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
                  <div className="mt-1.5 flex items-center gap-2">
                    {item.sourceKinds.length > 1 ? (
                      <SkillSourceLogoStack sourceKinds={item.sourceKinds} variant="compact" />
                    ) : (
                      <SkillSourceLogo
                        fallbackLabel={item.sourceNames[0] ?? item.name}
                        sourceKind={item.sourceKinds[0]}
                        variant="compact"
                      />
                    )}
                    <p className="truncate text-[12px] text-muted-foreground">{sourceSummary}</p>
                  </div>
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
