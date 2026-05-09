import { useState } from "react";
import type { DragEvent } from "react";
import { createPortal } from "react-dom";

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

const ACCENT_BORDER_CLASSES: Record<NoteCollectionAccentKey, string> = {
  violet: "border-l-[color:var(--note-accent-violet)]",
  indigo: "border-l-[color:var(--note-accent-indigo)]",
  blue: "border-l-[color:var(--note-accent-blue)]",
  sky: "border-l-[color:var(--note-accent-sky)]",
  cyan: "border-l-[color:var(--note-accent-cyan)]",
  teal: "border-l-[color:var(--note-accent-teal)]",
  emerald: "border-l-[color:var(--note-accent-emerald)]",
  lime: "border-l-[color:var(--note-accent-lime)]",
  amber: "border-l-[color:var(--note-accent-amber)]",
  orange: "border-l-[color:var(--note-accent-orange)]",
  coral: "border-l-[color:var(--note-accent-coral)]",
  rose: "border-l-[color:var(--note-accent-rose)]",
  pink: "border-l-[color:var(--note-accent-pink)]",
  red: "border-l-[color:var(--note-accent-red)]",
  slate: "border-l-[color:var(--note-accent-slate)]",
};

const ACCENT_ROW_CLASSES: Record<NoteCollectionAccentKey, { active: string; hover: string }> = {
  violet: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-violet)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-violet)_8%,transparent)]",
  },
  indigo: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-indigo)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-indigo)_8%,transparent)]",
  },
  blue: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-blue)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-blue)_8%,transparent)]",
  },
  sky: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-sky)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-sky)_8%,transparent)]",
  },
  cyan: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-cyan)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-cyan)_8%,transparent)]",
  },
  teal: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-teal)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-teal)_8%,transparent)]",
  },
  emerald: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-emerald)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-emerald)_8%,transparent)]",
  },
  lime: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-lime)_14%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-lime)_9%,transparent)]",
  },
  amber: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-amber)_14%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-amber)_9%,transparent)]",
  },
  orange: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-orange)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-orange)_8%,transparent)]",
  },
  coral: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-coral)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-coral)_8%,transparent)]",
  },
  rose: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-rose)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-rose)_8%,transparent)]",
  },
  pink: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-pink)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-pink)_8%,transparent)]",
  },
  red: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-red)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-red)_8%,transparent)]",
  },
  slate: {
    active: "bg-[color-mix(in_oklch,var(--note-accent-slate)_12%,transparent)]",
    hover: "hover:bg-[color-mix(in_oklch,var(--note-accent-slate)_8%,transparent)]",
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
  onReorderNote?: (sourcePath: string, targetPath: string, position: "before" | "after") => void;
};

const SKELETON_COUNT = 5;
const NOTE_BROWSER_DRAG_MIME = "application/x-glyph-note-browser-entry";
let globalDraggedNotePath: string | null = null;

function getDropPosition(event: DragEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function getDraggedNotePath(event: DragEvent<HTMLElement>) {
  return event.dataTransfer.getData(NOTE_BROWSER_DRAG_MIME) || globalDraggedNotePath;
}

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
  onReorderNote,
}: NotesBrowserPaneProps) {
  const [actionMenu, setActionMenu] = useState<{
    entry: NoteBrowserEntry;
    left: number;
    top: number;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    path: string;
    position: "before" | "after";
  } | null>(null);
  const closeActionMenu = () => setActionMenu(null);

  return (
    <>
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

              return (
                <div
                  key={entry.path}
                  aria-current={isActive ? "true" : undefined}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(event) => {
                    globalDraggedNotePath = entry.path;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(NOTE_BROWSER_DRAG_MIME, entry.path);
                    event.dataTransfer.setData("text/plain", entry.path);
                  }}
                  onDragOver={(event) => {
                    const sourcePath = getDraggedNotePath(event);
                    if (!sourcePath || sourcePath === entry.path) {
                      return;
                    }

                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragTarget({ path: entry.path, position: getDropPosition(event) });
                  }}
                  onDragLeave={() => {
                    setDragTarget((current) => (current?.path === entry.path ? null : current));
                  }}
                  onDrop={(event) => {
                    const sourcePath = getDraggedNotePath(event);
                    if (!sourcePath || sourcePath === entry.path) {
                      return;
                    }

                    event.preventDefault();
                    const position = getDropPosition(event);
                    setDragTarget(null);
                    globalDraggedNotePath = null;
                    onReorderNote?.(sourcePath, entry.path, position);
                  }}
                  onDragEnd={() => {
                    globalDraggedNotePath = null;
                    setDragTarget(null);
                  }}
                  onClick={() => onOpenNote(entry.path)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenNote(entry.path);
                    }
                  }}
                  className={cn(
                    "group/note flex w-full cursor-pointer items-start gap-2 border-b border-l-2 border-b-border/70 px-4 py-3 text-left transition-colors duration-100 ease-out",
                    dragTarget?.path === entry.path && dragTarget.position === "before"
                      ? "border-t-2 border-t-primary/70"
                      : null,
                    dragTarget?.path === entry.path && dragTarget.position === "after"
                      ? "border-b-2 border-b-primary/70"
                      : null,
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
                        <button
                          type="button"
                          draggable={false}
                          className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Note actions"
                          onPointerDownCapture={(event) => {
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            setActionMenu({
                              entry,
                              left: rect.left,
                              top: rect.bottom + 6,
                            });
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            setActionMenu({
                              entry,
                              left: rect.left,
                              top: rect.bottom + 6,
                            });
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            setActionMenu({
                              entry,
                              left: rect.left,
                              top: rect.bottom + 6,
                            });
                          }}
                        >
                          <MoreVerticalIcon size={14} />
                        </button>
                      </span>
                    </span>
                    {entry.excerpt && isActive ? (
                      <span
                        aria-hidden="true"
                        data-excerpt={entry.excerpt}
                        className="mt-1.5 line-clamp-2 block text-xs leading-5 text-muted-foreground before:content-[attr(data-excerpt)]"
                      />
                    ) : entry.excerpt ? (
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
      {actionMenu
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close note actions"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                onClick={closeActionMenu}
              />
              <div
                className="fixed z-50 w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                style={{ left: actionMenu.left, top: actionMenu.top }}
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent"
                  onClick={() => {
                    onCopyNote?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  <LinkIcon size={14} className="opacity-70" />
                  Copy as Markdown
                </button>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent"
                  onClick={() => {
                    onCopyNotePath?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  <LinkIcon size={14} className="opacity-70" />
                  Copy note path
                </button>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent"
                  onClick={() => {
                    onRevealNote?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  <FileManagerLogo label="Reveal in Finder" size={14} className="opacity-70" />
                  Reveal in Finder
                </button>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent"
                  onClick={() => {
                    onExportNote?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  <FileDownIcon size={14} className="opacity-70" />
                  Export as PDF
                </button>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent"
                  onClick={() => {
                    onTogglePinnedNote?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  {isNotePinned?.(actionMenu.entry) ? (
                    <PinOffIcon size={14} className="opacity-70" />
                  ) : (
                    <PinIcon size={14} className="opacity-70" />
                  )}
                  {isNotePinned?.(actionMenu.entry) ? "Unpin note" : "Pin note"}
                </button>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent"
                  onClick={() => {
                    onRenameNote?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  <PencilIcon size={14} className="opacity-70" />
                  Rename
                </button>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent"
                  onClick={() => {
                    onRemoveNote?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  <XIcon size={14} className="opacity-70" />
                  Remove
                </button>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-hidden hover:bg-destructive/10 [&_svg]:text-destructive"
                  onClick={() => {
                    onDeleteNote?.(actionMenu.entry);
                    closeActionMenu();
                  }}
                >
                  <TrashIcon size={14} className="opacity-70" />
                  Delete
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
