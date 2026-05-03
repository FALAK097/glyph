import { cn } from "@/core/utils";
import type { NoteBrowserEntry, NoteCollectionAccentKey } from "@/core/workspace";

import {
  FileDownIcon,
  LinkIcon,
  MoreVerticalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  TrashIcon,
  XIcon,
} from "../icons";
import { FileManagerLogo } from "../file-manager-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const ACCENT_BORDER_CLASSES: Record<NoteCollectionAccentKey, string> = {
  violet: "border-l-violet-500",
  indigo: "border-l-indigo-500",
  blue: "border-l-blue-500",
  sky: "border-l-sky-500",
  cyan: "border-l-cyan-500",
  teal: "border-l-teal-500",
  emerald: "border-l-emerald-500",
  lime: "border-l-lime-500",
  amber: "border-l-amber-500",
  orange: "border-l-orange-500",
  coral: "border-l-orange-500",
  rose: "border-l-rose-500",
  pink: "border-l-pink-500",
  red: "border-l-red-600",
  slate: "border-l-slate-400",
};

const ACCENT_ROW_CLASSES: Record<NoteCollectionAccentKey, { active: string; hover: string }> = {
  violet: {
    active: "bg-violet-500/10 dark:bg-violet-400/15",
    hover: "hover:bg-violet-500/5 dark:hover:bg-violet-400/10",
  },
  indigo: {
    active: "bg-indigo-500/10 dark:bg-indigo-400/15",
    hover: "hover:bg-indigo-500/5 dark:hover:bg-indigo-400/10",
  },
  blue: {
    active: "bg-blue-500/10 dark:bg-blue-400/15",
    hover: "hover:bg-blue-500/5 dark:hover:bg-blue-400/10",
  },
  sky: {
    active: "bg-sky-500/10 dark:bg-sky-400/15",
    hover: "hover:bg-sky-500/5 dark:hover:bg-sky-400/10",
  },
  cyan: {
    active: "bg-cyan-500/10 dark:bg-cyan-400/15",
    hover: "hover:bg-cyan-500/5 dark:hover:bg-cyan-400/10",
  },
  teal: {
    active: "bg-teal-500/10 dark:bg-teal-400/15",
    hover: "hover:bg-teal-500/5 dark:hover:bg-teal-400/10",
  },
  emerald: {
    active: "bg-emerald-500/10 dark:bg-emerald-400/15",
    hover: "hover:bg-emerald-500/5 dark:hover:bg-emerald-400/10",
  },
  lime: {
    active: "bg-lime-500/15 dark:bg-lime-400/15",
    hover: "hover:bg-lime-500/10 dark:hover:bg-lime-400/10",
  },
  amber: {
    active: "bg-amber-500/15 dark:bg-amber-400/15",
    hover: "hover:bg-amber-500/10 dark:hover:bg-amber-400/10",
  },
  orange: {
    active: "bg-orange-500/10 dark:bg-orange-400/15",
    hover: "hover:bg-orange-500/5 dark:hover:bg-orange-400/10",
  },
  coral: {
    active: "bg-orange-500/10 dark:bg-orange-400/15",
    hover: "hover:bg-orange-500/5 dark:hover:bg-orange-400/10",
  },
  rose: {
    active: "bg-rose-500/10 dark:bg-rose-400/15",
    hover: "hover:bg-rose-500/5 dark:hover:bg-rose-400/10",
  },
  pink: {
    active: "bg-pink-500/10 dark:bg-pink-400/15",
    hover: "hover:bg-pink-500/5 dark:hover:bg-pink-400/10",
  },
  red: {
    active: "bg-red-500/10 dark:bg-red-400/15",
    hover: "hover:bg-red-500/5 dark:hover:bg-red-400/10",
  },
  slate: {
    active: "bg-slate-500/10 dark:bg-slate-400/15",
    hover: "hover:bg-slate-500/5 dark:hover:bg-slate-400/10",
  },
};

type NotesBrowserPaneProps = {
  activePath: string | null;
  entries: NoteBrowserEntry[];
  isLoading?: boolean;
  accent?: NoteCollectionAccentKey;
  onOpenNote: (path: string) => void;
  onCopyNote?: (entry: NoteBrowserEntry) => void;
  onCopyNotePath?: (entry: NoteBrowserEntry) => void;
  onExportNote?: (entry: NoteBrowserEntry) => void;
  onTogglePinnedNote?: (entry: NoteBrowserEntry) => void;
  isNotePinned?: (entry: NoteBrowserEntry) => boolean;
  onRenameNote?: (entry: NoteBrowserEntry) => void;
  onRevealNote?: (entry: NoteBrowserEntry) => void;
  onRemoveNote?: (entry: NoteBrowserEntry) => void;
  onDeleteNote?: (entry: NoteBrowserEntry) => void;
};

const SKELETON_COUNT = 5;

function formatModifiedAt(value: string | null) {
  if (!value) {
    return "Recently";
  }

  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return "now";
  }

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))}m ago`;
  }

  if (diffMs < dayMs) {
    return `${Math.max(1, Math.floor(diffMs / hourMs))}h ago`;
  }

  if (diffMs < 7 * dayMs) {
    return `${Math.max(1, Math.floor(diffMs / dayMs))}d ago`;
  }

  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatCreatedAt(value: string | null) {
  if (!value) {
    return "Created";
  }

  return `Created ${formatModifiedAt(value)}`;
}

export function NotesBrowserPane({
  activePath,
  entries,
  isLoading = false,
  accent = "slate",
  onOpenNote,
  onCopyNote,
  onCopyNotePath,
  onExportNote,
  onTogglePinnedNote,
  isNotePinned,
  onRenameNote,
  onRevealNote,
  onRemoveNote,
  onDeleteNote,
}: NotesBrowserPaneProps) {
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col border-r border-border bg-background">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto border-l border-border/60">
        {isLoading ? (
          <div>
            {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
              <div key={index} className="border-b border-border/70 px-4 py-3">
                <div className="h-4 w-28 rounded bg-muted/60 motion-safe:animate-pulse" />
                <div className="mt-2 h-3 w-20 rounded bg-muted/45 motion-safe:animate-pulse" />
                <div className="mt-2 h-3 w-full rounded bg-muted/35 motion-safe:animate-pulse" />
                <div className="mt-2 h-3 w-2/3 rounded bg-muted/30 motion-safe:animate-pulse" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            This collection doesn’t have any notes yet.
          </div>
        ) : (
          entries.map((entry) => {
            const isActive = activePath === entry.path;
            const isPinned = Boolean(isNotePinned?.(entry));

            return (
              <div
                key={entry.path}
                aria-current={isActive ? "true" : undefined}
                role="button"
                tabIndex={0}
                onClick={() => onOpenNote(entry.path)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenNote(entry.path);
                  }
                }}
                className={cn(
                  "group/note flex w-full cursor-pointer items-start gap-2 border-b border-l-2 border-b-border/70 px-4 py-3 text-left transition-colors duration-100 ease-out",
                  isActive
                    ? cn(ACCENT_BORDER_CLASSES[accent], ACCENT_ROW_CLASSES[accent].active)
                    : cn("border-l-transparent", ACCENT_ROW_CLASSES[accent].hover),
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 min-w-0 text-sm font-medium text-foreground break-all">
                      {entry.title}
                    </span>
                    <span className="flex h-5 shrink-0 items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={`${entry.title} options`}
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
                          className="w-52"
                        >
                          <DropdownMenuItem onClick={() => onCopyNote?.(entry)}>
                            <LinkIcon size={14} className="opacity-70" />
                            Copy as Markdown
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCopyNotePath?.(entry)}>
                            <LinkIcon size={14} className="opacity-70" />
                            Copy note path
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onRevealNote?.(entry)}>
                            <FileManagerLogo
                              label="Reveal in Finder"
                              size={14}
                              className="opacity-70"
                            />
                            Reveal in Finder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onExportNote?.(entry)}>
                            <FileDownIcon size={14} className="opacity-70" />
                            Export as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onTogglePinnedNote?.(entry)}>
                            {isPinned ? (
                              <PinOffIcon size={14} className="opacity-70" />
                            ) : (
                              <PinIcon size={14} className="opacity-70" />
                            )}
                            {isPinned ? "Unpin note" : "Pin note"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onRenameNote?.(entry)}>
                            <PencilIcon size={14} className="opacity-70" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onRemoveNote?.(entry)}>
                            <XIcon size={14} className="opacity-70" />
                            Remove
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDeleteNote?.(entry)}
                          >
                            <TrashIcon size={14} className="opacity-70" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </span>
                  {entry.excerpt ? (
                    <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                      {entry.excerpt}
                    </span>
                  ) : null}
                  <span className="mt-2 flex items-center justify-between gap-3 text-[11px] leading-none text-muted-foreground">
                    <span className="shrink-0 tabular-nums">
                      {formatModifiedAt(entry.modifiedAt)}
                    </span>
                    <span className="min-w-0 truncate text-right tabular-nums">
                      {formatCreatedAt(entry.createdAt)}
                    </span>
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
