import { useCallback, useEffect, useRef, useState } from "react";

import { getDisplayFileName } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type { NoteTab } from "@/shared/workspace";

import { PlusIcon, XIcon } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type NoteTabsBarProps = {
  activeTabId: string | null;
  closeTabShortcut?: string;
  newTabShortcut?: string;
  onCloseTab: (path: string) => void;
  onCreateTab: () => void;
  onSelectTab: (path: string) => void;
  tabs: NoteTab[];
};

export function NoteTabsBar({
  activeTabId,
  closeTabShortcut,
  newTabShortcut,
  onCloseTab,
  onCreateTab,
  onSelectTab,
  tabs,
}: NoteTabsBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
  }, [tabs.length, updateScrollState]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    tabRefs.current[activeTabId]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTabId]);

  return (
    <div className="relative flex h-11 items-center gap-2 bg-background px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCreateTab}
            aria-label="Create a new tab"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground shadow-sm outline-none transition-[border-color,background-color,color,transform] duration-100 ease-out hover:border-border hover:bg-muted/70 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.97]"
          >
            <PlusIcon size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {`New Tab${newTabShortcut ? ` (${newTabShortcut})` : ""}`}
        </TooltipContent>
      </Tooltip>

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
        >
          {tabs.length === 0 ? (
            <div className="inline-flex h-8 items-center rounded-lg border border-dashed border-border/70 px-3 text-xs text-muted-foreground">
              No open tabs
            </div>
          ) : (
            tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const label = getDisplayFileName(tab.file.name);

              return (
                <div key={tab.id} className="group relative shrink-0">
                  <button
                    ref={(element) => {
                      tabRefs.current[tab.id] = element;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    title={tab.file.path}
                    onClick={() => onSelectTab(tab.file.path)}
                    className={cn(
                      "flex h-8 min-w-[152px] max-w-[224px] items-center gap-2 rounded-lg border px-3 pr-9 text-left outline-none",
                      isActive
                        ? "border-border bg-card text-foreground shadow-sm"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        tab.isDirty ? "bg-primary/80" : "bg-border/60",
                      )}
                    />
                    <span className="truncate text-sm font-medium">{label}</span>
                  </button>

                  <button
                    type="button"
                    tabIndex={isActive ? 0 : -1}
                    aria-label={`Close ${label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseTab(tab.file.path);
                    }}
                    className={cn(
                      "absolute top-1/2 right-1.5 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none",
                      isActive
                        ? "opacity-100 hover:bg-muted hover:text-foreground"
                        : "opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100",
                    )}
                  >
                    <XIcon size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {tabs.length > 0 && closeTabShortcut ? (
        <div className="hidden shrink-0 rounded-full border border-border/60 px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-muted-foreground lg:inline-flex">
          {closeTabShortcut}
        </div>
      ) : null}
    </div>
  );
}
