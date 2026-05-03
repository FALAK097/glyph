import { createPortal } from "react-dom";
import { memo, useCallback, useMemo, useState, type ComponentType } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileManagerLogo } from "@/components/file-manager-logo";
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
  CameraIcon,
  DiscountTagIcon,
  FileIcon,
  FolderPlusIcon,
  FolderIcon,
  GlobeIcon,
  HomeIcon,
  HonourStarIcon,
  LayersIcon,
  LeafIcon,
  NotebookIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "../icons";

const ACCENT_STYLES: Record<
  NoteCollectionAccentKey,
  {
    active: string;
    border: string;
    hover: string;
    iconColor: string;
    count: string;
    /** Border color for the circle swatch in the picker */
    dot: string;
  }
> = {
  violet: {
    active: "bg-violet-500/10 dark:bg-violet-400/15",
    border: "border-l-violet-500",
    hover: "hover:bg-violet-500/5 dark:hover:bg-violet-400/10",
    iconColor: "text-violet-600 dark:text-violet-300",
    count: "bg-violet-500 text-white dark:bg-violet-400 dark:text-violet-950",
    dot: "border-violet-500",
  },
  indigo: {
    active: "bg-indigo-500/10 dark:bg-indigo-400/15",
    border: "border-l-indigo-500",
    hover: "hover:bg-indigo-500/5 dark:hover:bg-indigo-400/10",
    iconColor: "text-indigo-600 dark:text-indigo-300",
    count: "bg-indigo-500 text-white dark:bg-indigo-400 dark:text-indigo-950",
    dot: "border-indigo-500",
  },
  blue: {
    active: "bg-blue-500/10 dark:bg-blue-400/15",
    border: "border-l-blue-500",
    hover: "hover:bg-blue-500/5 dark:hover:bg-blue-400/10",
    iconColor: "text-blue-600 dark:text-blue-300",
    count: "bg-blue-500 text-white dark:bg-blue-400 dark:text-blue-950",
    dot: "border-blue-500",
  },
  sky: {
    active: "bg-sky-500/10 dark:bg-sky-400/15",
    border: "border-l-sky-500",
    hover: "hover:bg-sky-500/5 dark:hover:bg-sky-400/10",
    iconColor: "text-sky-600 dark:text-sky-300",
    count: "bg-sky-500 text-white dark:bg-sky-400 dark:text-sky-950",
    dot: "border-sky-500",
  },
  cyan: {
    active: "bg-cyan-500/10 dark:bg-cyan-400/15",
    border: "border-l-cyan-500",
    hover: "hover:bg-cyan-500/5 dark:hover:bg-cyan-400/10",
    iconColor: "text-cyan-600 dark:text-cyan-300",
    count: "bg-cyan-500 text-white dark:bg-cyan-400 dark:text-cyan-950",
    dot: "border-cyan-500",
  },
  teal: {
    active: "bg-teal-500/10 dark:bg-teal-400/15",
    border: "border-l-teal-500",
    hover: "hover:bg-teal-500/5 dark:hover:bg-teal-400/10",
    iconColor: "text-teal-600 dark:text-teal-300",
    count: "bg-teal-500 text-white dark:bg-teal-400 dark:text-teal-950",
    dot: "border-teal-500",
  },
  emerald: {
    active: "bg-emerald-500/10 dark:bg-emerald-400/15",
    border: "border-l-emerald-500",
    hover: "hover:bg-emerald-500/5 dark:hover:bg-emerald-400/10",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    count: "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950",
    dot: "border-emerald-500",
  },
  lime: {
    active: "bg-lime-500/15 dark:bg-lime-400/15",
    border: "border-l-lime-500",
    hover: "hover:bg-lime-500/10 dark:hover:bg-lime-400/10",
    iconColor: "text-lime-700 dark:text-lime-300",
    count: "bg-lime-600 text-white dark:bg-lime-400 dark:text-lime-950",
    dot: "border-lime-500",
  },
  amber: {
    active: "bg-amber-500/15 dark:bg-amber-400/15",
    border: "border-l-amber-500",
    hover: "hover:bg-amber-500/10 dark:hover:bg-amber-400/10",
    iconColor: "text-amber-600 dark:text-amber-300",
    count: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
    dot: "border-amber-500",
  },
  orange: {
    active: "bg-orange-500/10 dark:bg-orange-400/15",
    border: "border-l-orange-500",
    hover: "hover:bg-orange-500/5 dark:hover:bg-orange-400/10",
    iconColor: "text-orange-600 dark:text-orange-300",
    count: "bg-orange-500 text-white dark:bg-orange-400 dark:text-orange-950",
    dot: "border-orange-500",
  },
  coral: {
    active: "bg-orange-500/10 dark:bg-orange-400/15",
    border: "border-l-orange-500",
    hover: "hover:bg-orange-500/5 dark:hover:bg-orange-400/10",
    iconColor: "text-orange-600 dark:text-orange-300",
    count: "bg-orange-500 text-white dark:bg-orange-400 dark:text-orange-950",
    dot: "border-red-400",
  },
  rose: {
    active: "bg-rose-500/10 dark:bg-rose-400/15",
    border: "border-l-rose-500",
    hover: "hover:bg-rose-500/5 dark:hover:bg-rose-400/10",
    iconColor: "text-rose-600 dark:text-rose-300",
    count: "bg-rose-500 text-white dark:bg-rose-400 dark:text-rose-950",
    dot: "border-rose-500",
  },
  pink: {
    active: "bg-pink-500/10 dark:bg-pink-400/15",
    border: "border-l-pink-500",
    hover: "hover:bg-pink-500/5 dark:hover:bg-pink-400/10",
    iconColor: "text-pink-600 dark:text-pink-300",
    count: "bg-pink-500 text-white dark:bg-pink-400 dark:text-pink-950",
    dot: "border-pink-500",
  },
  red: {
    active: "bg-red-500/10 dark:bg-red-400/15",
    border: "border-l-red-600 dark:border-l-red-400",
    hover: "hover:bg-red-500/5 dark:hover:bg-red-400/10",
    iconColor: "text-red-600 dark:text-red-300",
    count: "bg-red-600 text-white dark:bg-red-400 dark:text-red-950",
    dot: "border-red-600",
  },
  slate: {
    active: "bg-slate-500/10 dark:bg-slate-400/15",
    border: "border-l-slate-500 dark:border-l-slate-300",
    hover: "hover:bg-slate-500/5 dark:hover:bg-slate-400/10",
    iconColor: "text-slate-500 dark:text-slate-400",
    count: "bg-slate-500 text-white dark:bg-slate-400 dark:text-slate-950",
    dot: "border-slate-500",
  },
};

const ICONS: Record<NoteCollectionIconKey, ComponentType<{ size?: number; className?: string }>> = {
  folder: FolderIcon,
  book: BookIcon,
  briefcase: BriefcaseIcon,
  calendar: CalendarIcon,
  sparkles: SparklesIcon,
  rocket: RocketIcon,
  tag: DiscountTagIcon,
  archive: ArchiveIcon,
  leaf: LeafIcon,
  layers: LayersIcon,
  globe: GlobeIcon,
  home: HomeIcon,
  camera: CameraIcon,
  notebook: NotebookIcon,
  star: HonourStarIcon,
};

/** Human-readable label for each accent color key */
const ACCENT_LABELS: Record<NoteCollectionAccentKey, string> = {
  violet: "Violet",
  indigo: "Indigo",
  blue: "Blue",
  sky: "Sky",
  cyan: "Cyan",
  teal: "Teal",
  emerald: "Emerald",
  lime: "Lime",
  amber: "Amber",
  orange: "Orange",
  coral: "Coral",
  rose: "Rose",
  pink: "Pink",
  red: "Red",
  slate: "Slate",
};

/** Human-readable label for each icon key */
const ICON_LABELS: Record<NoteCollectionIconKey, string> = {
  folder: "Folder",
  book: "Book",
  briefcase: "Briefcase",
  calendar: "Calendar",
  sparkles: "Sparkles",
  rocket: "Rocket",
  tag: "Tag",
  archive: "Archive",
  leaf: "Leaf",
  layers: "Layers",
  globe: "Globe",
  home: "Home",
  camera: "Camera",
  notebook: "Notebook",
  star: "Star",
};

type NoteCollectionRowProps = {
  item: NoteCollectionItem;
  onSelect: (path: string) => void;
  onCreateNote?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onChangeAccent?: (path: string, accent: NoteCollectionAccentKey) => void;
  onChangeIcon?: (path: string, icon: NoteCollectionIconKey) => void;
  onRevealInFinder?: (path: string) => void;
  onRenameFolder?: (path: string, name: string) => void;
  onRemoveFolder?: (path: string) => void;
  onDeleteFolder?: (path: string) => void;
  revealLabel?: string;
};

export const NoteCollectionRow = memo(function NoteCollectionRow({
  item,
  onSelect,
  onCreateNote,
  onCreateFolder,
  onChangeAccent,
  onChangeIcon,
  onRevealInFinder,
  onRenameFolder,
  onRemoveFolder,
  onDeleteFolder,
  revealLabel = "Reveal in Finder",
}: NoteCollectionRowProps) {
  const Icon = ICONS[item.icon];
  const accent = ACCENT_STYLES[item.accent];
  const [menuCoords, setMenuCoords] = useState<{ left: number; top: number } | null>(null);
  const closeMenu = useCallback(() => setMenuCoords(null), []);

  const handleRename = useCallback(() => {
    const nextName = window.prompt("Rename folder", item.label);
    if (!nextName?.trim()) {
      return;
    }

    onRenameFolder?.(item.sourcePath, nextName.trim());
  }, [item.label, item.sourcePath, onRenameFolder]);
  const menuItems = useMemo(
    () => [
      {
        label: "New note here",
        icon: <PlusIcon size={14} className="opacity-70" />,
        action: () => onCreateNote?.(item.sourcePath),
        enabled: Boolean(onCreateNote),
      },
      {
        label: "New folder here",
        icon: <FolderPlusIcon size={14} className="opacity-70" />,
        action: () => onCreateFolder?.(item.sourcePath),
        enabled: Boolean(onCreateFolder),
      },
      {
        label: "Rename",
        icon: <PencilIcon size={14} className="opacity-70" />,
        action: handleRename,
        enabled: Boolean(onRenameFolder),
      },
      {
        label: revealLabel,
        icon: <FileManagerLogo label={revealLabel} size={14} className="opacity-70" />,
        action: () => onRevealInFinder?.(item.sourcePath),
        enabled: Boolean(onRevealInFinder),
      },
      {
        label: "Remove",
        icon: <XIcon size={14} className="opacity-70" />,
        action: () => onRemoveFolder?.(item.sourcePath),
        enabled: Boolean(onRemoveFolder),
      },
      {
        label: "Delete",
        icon: <TrashIcon size={14} className="opacity-70" />,
        action: () => onDeleteFolder?.(item.sourcePath),
        enabled: Boolean(onDeleteFolder),
        destructive: true,
      },
    ],
    [
      handleRename,
      item.sourcePath,
      onCreateFolder,
      onCreateNote,
      onDeleteFolder,
      onRemoveFolder,
      onRenameFolder,
      onRevealInFinder,
      revealLabel,
    ],
  );

  return (
    <div
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuCoords({ left: event.clientX, top: event.clientY });
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-1.5 rounded-md border-l-2 px-2 py-1.5 transition-colors duration-100 ease-out",
        item.isActive ? cn(accent.active, accent.border) : cn("border-l-transparent", accent.hover),
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(item.path)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Icon
          size={14}
          className={cn("shrink-0", accent.iconColor, item.isActive ? "" : "opacity-80")}
        />
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            item.isActive ? accent.iconColor : "text-sidebar-foreground",
          )}
        >
          {item.label}
        </span>
      </button>
      <span
        className={cn(
          "min-w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums",
          item.isActive ? accent.iconColor : "text-muted-foreground",
        )}
      >
        {item.count}
      </span>
      {menuCoords
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close folder actions"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                onClick={closeMenu}
              />
              <div
                className="fixed z-50 w-56 rounded-md border border-border bg-popover p-1.5 text-sm text-popover-foreground shadow-lg"
                style={menuCoords}
              >
                {menuItems.map((menuItem) => (
                  <button
                    key={menuItem.label}
                    type="button"
                    disabled={!menuItem.enabled}
                    onClick={() => {
                      menuItem.action();
                      if (menuItem.label !== "Rename") {
                        closeMenu();
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40",
                      menuItem.destructive ? "text-destructive hover:bg-destructive/10" : "",
                      menuItem.destructive ? "[&_svg]:text-destructive" : "",
                    )}
                  >
                    {menuItem.icon}
                    {menuItem.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-border" />
                <div className="group/menu-item relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded-full border-2 bg-background",
                        ACCENT_STYLES[item.accent].dot,
                      )}
                    />
                    Color
                    <span className="ml-auto text-muted-foreground">›</span>
                  </button>
                  <div className="invisible absolute left-full top-0 z-10 ml-1 grid w-[168px] grid-cols-5 gap-1.5 rounded-md border border-border bg-popover p-2 opacity-0 shadow-lg transition-opacity group-hover/menu-item:visible group-hover/menu-item:opacity-100 group-focus-within/menu-item:visible group-focus-within/menu-item:opacity-100">
                    {NOTE_COLLECTION_ACCENT_KEYS.map((accentKey) => (
                      <Tooltip key={accentKey}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              onChangeAccent?.(item.appearancePath, accentKey);
                              closeMenu();
                            }}
                            className={cn(
                              "grid h-7 w-7 place-items-center rounded-md border border-transparent hover:border-border",
                              item.accent === accentKey ? "bg-muted" : "",
                            )}
                            aria-label={`Use ${ACCENT_LABELS[accentKey]}`}
                          >
                            <span
                              className={cn(
                                "h-3.5 w-3.5 rounded-full border-2 bg-background",
                                ACCENT_STYLES[accentKey].dot,
                              )}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{ACCENT_LABELS[accentKey]}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <div className="group/menu-item relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <FileIcon size={14} className={cn("opacity-70", accent.iconColor)} />
                    Icon
                    <span className="ml-auto text-muted-foreground">›</span>
                  </button>
                  <div className="invisible absolute left-full top-0 z-10 ml-1 grid w-[168px] grid-cols-5 gap-1.5 rounded-md border border-border bg-popover p-2 opacity-0 shadow-lg transition-opacity group-hover/menu-item:visible group-hover/menu-item:opacity-100 group-focus-within/menu-item:visible group-focus-within/menu-item:opacity-100">
                    {NOTE_COLLECTION_ICON_KEYS.map((iconKey) => {
                      const OptionIcon = ICONS[iconKey];
                      return (
                        <Tooltip key={iconKey}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                onChangeIcon?.(item.appearancePath, iconKey);
                                closeMenu();
                              }}
                              className={cn(
                                "grid h-7 w-7 place-items-center rounded-md border border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                                item.icon === iconKey ? cn("bg-muted", accent.iconColor) : "",
                              )}
                              aria-label={`Use ${ICON_LABELS[iconKey]} icon`}
                            >
                              <OptionIcon size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{ICON_LABELS[iconKey]}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
});

NoteCollectionRow.displayName = "NoteCollectionRow";
