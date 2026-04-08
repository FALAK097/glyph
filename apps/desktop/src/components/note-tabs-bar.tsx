import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { XIcon } from "./icons";

export type NoteTabRailItem = {
  id: string;
  isDirty: boolean;
  label: string;
  path: string;
  shortcutLabel?: string;
};

type NoteTabsBarProps = {
  activeTabId: string | null;
  onCloseTab: (path: string) => void;
  onSelectTab: (path: string) => void;
  tabs: NoteTabRailItem[];
};

export function NoteTabsBar({ activeTabId, onCloseTab, onSelectTab, tabs }: NoteTabsBarProps) {
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
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const label = tab.label;

            return (
              <div key={tab.id} className="group relative shrink-0">
                <button
                  ref={(element) => {
                    tabRefs.current[tab.id] = element;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  title={tab.path}
                  onClick={() => onSelectTab(tab.path)}
                  className={cn(
                    "flex h-8 min-w-[152px] max-w-[224px] items-center gap-2 rounded-lg border px-3 pr-9 text-left outline-none",
                    isActive
                      ? "border-border bg-card text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {tab.shortcutLabel ? (
                    <span className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80">
                      {tab.shortcutLabel}
                    </span>
                  ) : null}
                  <span className="truncate text-sm font-medium">{label}</span>
                  {tab.isDirty ? (
                    <span
                      aria-label="Unsaved changes"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/75"
                    />
                  ) : null}
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
                    "absolute top-1/2 right-1.5 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none",
                    isActive
                      ? "pointer-events-auto opacity-100 hover:bg-muted hover:text-foreground"
                      : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-focus-within:pointer-events-auto group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-muted hover:text-foreground",
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
