import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/core/utils";
import {
  NOTE_COLLECTION_ACCENT_KEYS,
  NOTE_COLLECTION_ICON_KEYS,
  type NoteCollectionItem,
} from "@/core/note-collections";
import type { NoteCollectionAccentKey, NoteCollectionIconKey } from "@/core/workspace";

import {
  ArchiveIcon,
  BookIcon,
  BriefcaseIcon,
  CalendarIcon,
  FolderIcon,
  LayersIcon,
  LeafIcon,
  MoreVerticalIcon,
  RocketIcon,
  SparklesIcon,
  TagIcon,
} from "../icons";

const ACCENT_STYLES: Record<
  NoteCollectionAccentKey,
  {
    dot: string;
    pill: string;
    active: string;
    activeRing: string;
  }
> = {
  violet: {
    dot: "bg-violet-500/80 dark:bg-violet-400/80",
    pill: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200",
    active:
      "from-violet-500/18 via-violet-500/10 to-transparent dark:from-violet-400/24 dark:via-violet-400/12",
    activeRing: "ring-violet-500/20 dark:ring-violet-400/30",
  },
  indigo: {
    dot: "bg-indigo-500/80 dark:bg-indigo-400/80",
    pill: "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200",
    active:
      "from-indigo-500/18 via-indigo-500/10 to-transparent dark:from-indigo-400/24 dark:via-indigo-400/12",
    activeRing: "ring-indigo-500/20 dark:ring-indigo-400/30",
  },
  sky: {
    dot: "bg-sky-500/80 dark:bg-sky-400/80",
    pill: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200",
    active:
      "from-sky-500/18 via-sky-500/10 to-transparent dark:from-sky-400/24 dark:via-sky-400/12",
    activeRing: "ring-sky-500/20 dark:ring-sky-400/30",
  },
  teal: {
    dot: "bg-teal-500/80 dark:bg-teal-400/80",
    pill: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-200",
    active:
      "from-teal-500/18 via-teal-500/10 to-transparent dark:from-teal-400/24 dark:via-teal-400/12",
    activeRing: "ring-teal-500/20 dark:ring-teal-400/30",
  },
  emerald: {
    dot: "bg-emerald-500/80 dark:bg-emerald-400/80",
    pill: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200",
    active:
      "from-emerald-500/18 via-emerald-500/10 to-transparent dark:from-emerald-400/24 dark:via-emerald-400/12",
    activeRing: "ring-emerald-500/20 dark:ring-emerald-400/30",
  },
  amber: {
    dot: "bg-amber-500/80 dark:bg-amber-400/80",
    pill: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200",
    active:
      "from-amber-500/18 via-amber-500/10 to-transparent dark:from-amber-400/24 dark:via-amber-400/12",
    activeRing: "ring-amber-500/20 dark:ring-amber-400/30",
  },
  coral: {
    dot: "bg-orange-500/80 dark:bg-orange-400/80",
    pill: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-200",
    active:
      "from-orange-500/18 via-orange-500/10 to-transparent dark:from-orange-400/24 dark:via-orange-400/12",
    activeRing: "ring-orange-500/20 dark:ring-orange-400/30",
  },
  rose: {
    dot: "bg-rose-500/80 dark:bg-rose-400/80",
    pill: "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200",
    active:
      "from-rose-500/18 via-rose-500/10 to-transparent dark:from-rose-400/24 dark:via-rose-400/12",
    activeRing: "ring-rose-500/20 dark:ring-rose-400/30",
  },
  slate: {
    dot: "bg-slate-500/80 dark:bg-slate-400/80",
    pill: "bg-slate-500/10 text-slate-700 dark:bg-slate-400/10 dark:text-slate-200",
    active:
      "from-slate-500/16 via-slate-500/8 to-transparent dark:from-slate-400/22 dark:via-slate-400/10",
    activeRing: "ring-slate-500/20 dark:ring-slate-400/30",
  },
};

const ICONS: Record<
  NoteCollectionIconKey,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  folder: FolderIcon,
  book: BookIcon,
  briefcase: BriefcaseIcon,
  calendar: CalendarIcon,
  sparkles: SparklesIcon,
  rocket: RocketIcon,
  tag: TagIcon,
  archive: ArchiveIcon,
  leaf: LeafIcon,
  layers: LayersIcon,
};

type NoteCollectionRowProps = {
  item: NoteCollectionItem;
  onSelect: (path: string) => void;
  onCreateNote?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onChangeAccent?: (path: string, accent: NoteCollectionAccentKey) => void;
  onChangeIcon?: (path: string, icon: NoteCollectionIconKey) => void;
};

export function NoteCollectionRow({
  item,
  onSelect,
  onCreateNote,
  onCreateFolder,
  onChangeAccent,
  onChangeIcon,
}: NoteCollectionRowProps) {
  const Icon = ICONS[item.icon];
  const accent = ACCENT_STYLES[item.accent];

  const stopPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(item.path)}
      className={cn(
        "group relative flex min-h-11 w-full items-center justify-between overflow-hidden rounded-2xl border border-transparent px-3 py-2.5 text-left transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
        item.isActive
          ? cn(
              "bg-sidebar-accent/85 text-sidebar-accent-foreground shadow-sm ring-1",
              accent.activeRing,
            )
          : "text-sidebar-foreground hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
      )}
    >
      {item.isActive ? (
        <span
          className={cn("pointer-events-none absolute inset-0 bg-gradient-to-r", accent.active)}
        />
      ) : null}
      <span className="relative flex min-w-0 items-center gap-3">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/75 shadow-sm">
          <span className={cn("absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full", accent.dot)} />
          <Icon size={15} className="text-foreground/80" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.label}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {item.isRootCollection ? "Workspace" : "Collection"}
          </span>
        </span>
      </span>
      <span className="relative ml-3 flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            accent.pill,
          )}
        >
          {item.count}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                size="icon-xs"
                className="rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
                onClick={(event) => {
                  stopPropagation(event);
                  props.onClick?.(event);
                }}
              >
                <MoreVerticalIcon size={14} />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" side="bottom" className="w-48">
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onCreateNote?.(item.path)} disabled={!onCreateNote}>
              New note here
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onCreateFolder?.(item.path)}
              disabled={!onCreateFolder}
            >
              New folder here
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Accent</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {NOTE_COLLECTION_ACCENT_KEYS.map((accentKey) => (
                  <DropdownMenuItem
                    key={accentKey}
                    onClick={() => onChangeAccent?.(item.path, accentKey)}
                    disabled={!onChangeAccent}
                  >
                    {accentKey}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Icon</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {NOTE_COLLECTION_ICON_KEYS.map((iconKey) => (
                  <DropdownMenuItem
                    key={iconKey}
                    onClick={() => onChangeIcon?.(item.path, iconKey)}
                    disabled={!onChangeIcon}
                  >
                    {iconKey}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </button>
  );
}
