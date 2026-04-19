import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";

import { isSamePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type { TabMovePosition } from "@/shared/workspace";

import { XIcon } from "./icons";

const NOTE_TAB_DRAG_MIME = "application/x-glyph-note-tab";
let globalDraggedTabPath: string | null = null;

const readDraggedTabPath = (event: DragEvent<HTMLElement | HTMLDivElement>): string | null => {
  if (globalDraggedTabPath) {
    return globalDraggedTabPath;
  }

  const dragPayload = event.dataTransfer.getData(NOTE_TAB_DRAG_MIME);
  if (dragPayload) {
    return dragPayload;
  }

  const plainTextPayload = event.dataTransfer.getData("text/plain");
  return plainTextPayload || null;
};

export type NoteTabRailItem = {
  id: string;
  label: string;
  path: string;
  shortcutLabel?: string;
};

type NoteTabsBarProps = {
  activeTabId: string | null;
  onCloseTab: (path: string) => void;
  onMoveTab: (sourcePath: string, targetPath: string, position: TabMovePosition) => void;
  onSelectTab: (path: string) => void;
  tabs: NoteTabRailItem[];
};

export function NoteTabsBar({
  activeTabId,
  onCloseTab,
  onMoveTab,
  onSelectTab,
  tabs,
}: NoteTabsBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const draggedTabPathRef = useRef<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [draggedTabPath, setDraggedTabPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    path: string;
    position: TabMovePosition;
  } | null>(null);
  const tabOrderKey = useMemo(() => tabs.map((tab) => tab.id).join("|"), [tabs]);

  const updateScrollState = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(scrollContainer.scrollLeft > 4);
    setCanScrollRight(
      scrollContainer.scrollLeft + scrollContainer.clientWidth < scrollContainer.scrollWidth - 4,
    );
  }, []);

  useEffect(() => {
    updateScrollState();

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    scrollContainer.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scrollContainer.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [tabOrderKey, updateScrollState]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    tabRefs.current[activeTabId]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTabId, tabOrderKey]);

  const clearDragState = useCallback(() => {
    globalDraggedTabPath = null;
    draggedTabPathRef.current = null;
    setDraggedTabPath(null);
    setDropTarget(null);
  }, []);

  const handleTabDragOver = useCallback((event: DragEvent<HTMLElement>, tabPath: string) => {
    const currentDraggedTabPath = draggedTabPathRef.current ?? readDraggedTabPath(event);
    if (!currentDraggedTabPath || isSamePath(currentDraggedTabPath, tabPath)) {
      return;
    }

    event.preventDefault();
    draggedTabPathRef.current = currentDraggedTabPath;
    setDraggedTabPath((current) => current ?? currentDraggedTabPath);
    const bounds = event.currentTarget.getBoundingClientRect();
    const position: TabMovePosition =
      event.clientX < bounds.left + bounds.width / 2 ? "before" : "after";
    setDropTarget((current) =>
      current?.path === tabPath && current.position === position
        ? current
        : { path: tabPath, position },
    );
  }, []);

  const handleContainerDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    const currentDraggedTabPath = draggedTabPathRef.current ?? readDraggedTabPath(event);
    if (!currentDraggedTabPath) {
      return;
    }

    event.preventDefault();
    draggedTabPathRef.current = currentDraggedTabPath;
    setDraggedTabPath((current) => current ?? currentDraggedTabPath);
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const bounds = scrollContainer.getBoundingClientRect();
    const edgeThreshold = 56;
    if (event.clientX <= bounds.left + edgeThreshold) {
      scrollContainer.scrollBy({ left: -18 });
    } else if (event.clientX >= bounds.right - edgeThreshold) {
      scrollContainer.scrollBy({ left: 18 });
    }
  }, []);

  const handleContainerDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const currentDraggedTabPath = draggedTabPathRef.current ?? readDraggedTabPath(event);
      if (!currentDraggedTabPath) {
        return;
      }

      const dropElement =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>("[data-note-tab-path]")
          : null;
      if (dropElement) {
        return;
      }

      const lastTab = tabs.at(-1);
      if (lastTab && !isSamePath(lastTab.path, currentDraggedTabPath)) {
        event.preventDefault();
        onMoveTab(currentDraggedTabPath, lastTab.path, "after");
      }

      clearDragState();
    },
    [clearDragState, onMoveTab, tabs],
  );

  return (
    <div className="relative flex h-11 items-center bg-background px-2">
      <div className="relative min-w-0 flex-1">
        {canScrollLeft ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
        ) : null}
        {canScrollRight ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        ) : null}

        <div
          ref={scrollContainerRef}
          role="tablist"
          aria-label="Open note tabs"
          className="scrollbar-hide flex min-w-0 items-center gap-1 overflow-x-auto py-1"
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const label = tab.label;
            const showDropIndicator = dropTarget?.path === tab.path;

            return (
              <div
                key={tab.id}
                data-note-tab-path={tab.path}
                className="group/tab relative shrink-0"
              >
                {showDropIndicator ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-y-1 z-20 w-0.5 rounded-full bg-primary/75",
                      dropTarget.position === "before" ? "-left-0.5" : "-right-0.5",
                    )}
                  />
                ) : null}

                <button
                  ref={(element) => {
                    tabRefs.current[tab.id] = element;
                  }}
                  type="button"
                  role="tab"
                  draggable
                  aria-selected={isActive}
                  title={tab.path}
                  onDragEnd={clearDragState}
                  onDragLeave={(event) => {
                    if (
                      event.currentTarget.contains(event.relatedTarget as Node | null) ||
                      !dropTarget ||
                      dropTarget.path !== tab.path
                    ) {
                      return;
                    }

                    setDropTarget(null);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", tab.path);
                    event.dataTransfer.setData(NOTE_TAB_DRAG_MIME, tab.path);
                    globalDraggedTabPath = tab.path;
                    draggedTabPathRef.current = tab.path;
                    setDraggedTabPath(tab.path);
                  }}
                  onDragOver={(event) => handleTabDragOver(event, tab.path)}
                  onDrop={(event) => {
                    const currentDraggedTabPath =
                      draggedTabPathRef.current ?? readDraggedTabPath(event);
                    if (!currentDraggedTabPath || isSamePath(currentDraggedTabPath, tab.path)) {
                      clearDragState();
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    const position = dropTarget?.path === tab.path ? dropTarget.position : "after";
                    onMoveTab(currentDraggedTabPath, tab.path, position);
                    clearDragState();
                  }}
                  onClick={() => onSelectTab(tab.path)}
                  className={cn(
                    "flex h-8 min-w-[152px] max-w-[224px] cursor-grab items-center gap-2 rounded-lg border px-3 pr-9 text-left outline-none transition-[border-color,background-color,color,box-shadow] duration-150 ease-out active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "border-border bg-card text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground",
                    draggedTabPath && isSamePath(draggedTabPath, tab.path) ? "opacity-70" : "",
                  )}
                >
                  {tab.shortcutLabel ? (
                    <span className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80">
                      {tab.shortcutLabel}
                    </span>
                  ) : null}
                  <span className="truncate text-sm font-medium">{label}</span>
                </button>

                <button
                  type="button"
                  tabIndex={isActive ? 0 : -1}
                  aria-label={`Close ${label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  className={cn(
                    "absolute top-1/2 right-1.5 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,opacity,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "pointer-events-auto opacity-100 hover:bg-muted hover:text-foreground"
                      : "pointer-events-none opacity-0 group-hover/tab:pointer-events-auto group-focus-within/tab:pointer-events-auto group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <XIcon size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
