import type { Editor } from "@tiptap/core";

import { ArrowDownIcon, ArrowUpIcon, SearchIcon, XIcon } from "./icons";
import { Button } from "@/components/ui/button";

type FindPanelProps = {
  isOpen: boolean;
  query: string;
  panelState: {
    activeIndex: number;
    matchCount: number;
  };
  inputRef: React.RefObject<HTMLInputElement | null>;
  shouldShowOutlineRail: boolean;
  onQueryChange: (query: string) => void;
  onNavigate: (direction: 1 | -1) => void;
  onClose: () => void;
};

export function FindPanel({
  isOpen,
  query,
  panelState,
  inputRef,
  shouldShowOutlineRail,
  onQueryChange,
  onNavigate,
  onClose,
}: FindPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute top-2 right-0 z-30 flex justify-end px-4 ${
        shouldShowOutlineRail ? "xl:pr-[324px]" : ""
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border/50 bg-card/95 px-2 py-1.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04] supports-backdrop-filter:backdrop-blur-md">
        <SearchIcon size={12} className="shrink-0 text-muted-foreground/70" />
        <input
          ref={inputRef}
          autoFocus
          aria-label="Find in current note"
          value={query}
          className="h-5 w-[160px] bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onNavigate(event.shiftKey ? -1 : 1);
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
              return;
            }

            const primaryPressed =
              event.metaKey !== event.ctrlKey && (event.metaKey || event.ctrlKey);
            if (primaryPressed && event.key.toLowerCase() === "g") {
              event.preventDefault();
              onNavigate(event.shiftKey ? -1 : 1);
            }
          }}
        />
        {query.trim() ? (
          <span
            aria-live="polite"
            aria-label="Find results"
            className="min-w-[36px] text-right text-[11px] tabular-nums text-muted-foreground"
          >
            {panelState.matchCount > 0
              ? `${panelState.activeIndex + 1}/${panelState.matchCount}`
              : "No matches"}
          </span>
        ) : null}
        <div className="mx-0.5 h-3.5 w-px bg-border/40" />
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          disabled={panelState.matchCount === 0}
          aria-label="Previous match"
          className="h-5 w-5"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onNavigate(-1);
          }}
        >
          <ArrowUpIcon size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          disabled={panelState.matchCount === 0}
          aria-label="Next match"
          className="h-5 w-5"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onNavigate(1);
          }}
        >
          <ArrowDownIcon size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Close find"
          className="h-5 w-5"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onClose();
          }}
        >
          <XIcon size={12} />
        </Button>
      </div>
    </div>
  );
}
