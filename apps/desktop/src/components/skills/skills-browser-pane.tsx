import type { SkillBrowserItem } from "@/core/skill-groups";
import { getSkillSourceAccent, type SkillCollectionIconKind } from "@/core/skill-source-accents";
import type { SkillSourceKind } from "@/core/skills";
import { cn } from "@/core/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FileDownIcon, LinkIcon, MoreVerticalIcon } from "../icons";
import { FileManagerLogo } from "../file-manager-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SkillSourceLogo, SkillSourceLogoStack } from "./skill-source-logo";

type SkillsBrowserPaneProps = {
  activeSkillId: string | null;
  items: SkillBrowserItem[];
  onSelectSkill: (skillId: string) => void;
  sourceKind?: SkillSourceKind;
  iconKind?: SkillCollectionIconKind;
  onCopySkill?: (item: SkillBrowserItem) => void;
  onCopySkillPath?: (item: SkillBrowserItem) => void;
  onRevealSkill?: (item: SkillBrowserItem) => void;
  onExportSkill?: (item: SkillBrowserItem) => void;
};

export function SkillsBrowserPane({
  activeSkillId,
  items,
  onSelectSkill,
  sourceKind,
  iconKind,
  onCopySkill,
  onCopySkillPath,
  onRevealSkill,
  onExportSkill,
}: SkillsBrowserPaneProps) {
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col border-r border-border bg-background">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto border-l border-border/60">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No skills are available in this source yet.
          </div>
        ) : (
          items.map((item) => {
            const isActive = item.memberSkillIds.includes(activeSkillId ?? "");
            const tooltipLabels = item.sourceNames;
            const accent = getSkillSourceAccent(sourceKind ?? item.sourceKinds[0], iconKind);

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectSkill(item.representativeSkillId)}
                className={cn(
                  "group flex w-full cursor-pointer items-start gap-2 border-b border-l-2 border-b-border/70 px-4 py-3 text-left transition-colors duration-100 ease-out",
                  isActive
                    ? cn(accent.active, accent.border)
                    : cn("border-l-transparent", accent.hover),
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p
                      className={cn(
                        "line-clamp-1 min-w-0 text-sm font-medium break-all",
                        isActive ? accent.text : "text-foreground",
                      )}
                    >
                      {item.name}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={`${item.name} options`}
                            onClick={(event) => event.stopPropagation()}
                          />
                        }
                      >
                        <MoreVerticalIcon size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        side="right"
                        sideOffset={8}
                        className="w-48"
                      >
                        <DropdownMenuItem onClick={() => onSelectSkill(item.representativeSkillId)}>
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopySkill?.(item)}>
                          <LinkIcon size={14} className="opacity-70" />
                          Copy as Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopySkillPath?.(item)}>
                          <LinkIcon size={14} className="opacity-70" />
                          Copy skill path
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRevealSkill?.(item)}>
                          <FileManagerLogo
                            label="Reveal in Finder"
                            size={14}
                            className="opacity-70"
                          />
                          Reveal in Finder
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExportSkill?.(item)}>
                          <FileDownIcon size={14} className="opacity-70" />
                          Export as PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {tooltipLabels.length > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mt-1.5 inline-flex w-fit items-center gap-1.5">
                          {item.sourceKinds.length > 1 ? (
                            <SkillSourceLogoStack
                              className={accent.icon}
                              sourceKinds={item.sourceKinds}
                              variant="compact"
                            />
                          ) : (
                            <SkillSourceLogo
                              className={accent.icon}
                              sourceKind={item.sourceKinds[0]}
                              variant="compact"
                            />
                          )}
                          {item.hasAgentsFile ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              AGENTS.md
                            </span>
                          ) : null}
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
