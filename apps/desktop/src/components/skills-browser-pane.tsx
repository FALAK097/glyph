import type { SkillBrowserItem } from "@/lib/skill-groups";
import { cn } from "@/lib/utils";

import { SkillSourceLogo, SkillSourceLogoStack } from "./skill-source-logo";

type SkillsBrowserPaneProps = {
  activeSkillId: string | null;
  items: SkillBrowserItem[];
  onSelectSkill: (skillId: string) => void;
  title: string;
};

export function SkillsBrowserPane({
  activeSkillId,
  items,
  onSelectSkill,
  title,
}: SkillsBrowserPaneProps) {
  const countLabel = title === "All Agents" ? "agent" : "skill";
  const isMacLike = navigator.platform.includes("Mac");
  const isAggregateView = title === "All Skills" || title === "All Agents";
  const headerSpacingClass = isMacLike ? "pt-8" : "pt-4";

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
      </div>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <div className="rounded-xl px-3 py-3 text-sm text-muted-foreground">
            {title === "All Agents"
              ? "No agents are available in your connected tool folders yet."
              : "No skills are available in this source yet."}
          </div>
        ) : (
          items.map((item) => {
            const isActive = item.memberSkillIds.includes(activeSkillId ?? "");

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectSkill(item.representativeSkillId)}
                className={cn(
                  "mb-0.5 flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.99]",
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/70",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    {item.sourceKinds.length > 1 ? (
                      <SkillSourceLogoStack sourceKinds={item.sourceKinds} variant="compact" />
                    ) : (
                      <SkillSourceLogo
                        fallbackLabel={item.sourceNames[0] ?? item.name}
                        sourceKind={item.sourceKinds[0]}
                        variant="compact"
                      />
                    )}
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  </div>
                  {isAggregateView ? (
                    <p className="mt-1 truncate pl-7 text-xs text-muted-foreground">
                      {item.sourceNames.join(", ")}
                    </p>
                  ) : item.description ? (
                    <p className="mt-1 line-clamp-2 pl-7 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                {item.hasAgentsFile ? (
                  <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Agent
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
