import { memo, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import type { SearchPanelProps } from "../types/search-panel";
import { SearchIcon } from "./icons";
import type { SearchResult } from "@/shared/workspace";

const ResultItem = memo(
  ({
    result,
    onOpenResult,
  }: {
    result: SearchResult;
    onOpenResult: (result: SearchResult) => void;
  }) => {
    return (
      <Button
        className="h-auto w-full justify-start rounded-lg px-3 py-2 text-left"
        variant="ghost"
        type="button"
        onClick={() => onOpenResult(result)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <strong className="truncate text-sm font-medium text-foreground">{result.name}</strong>
            <span className="shrink-0 text-xs text-muted-foreground">Line {result.line}</span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {result.snippet || "Match found in file."}
          </p>
        </div>
      </Button>
    );
  },
);
ResultItem.displayName = "ResultItem";

export const SearchPanel = ({
  query,
  results,
  isLoading,
  isOpen,
  onChangeQuery,
  onClose,
  onOpenResult,
}: SearchPanelProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      if (previousFocus && document.body.contains(previousFocus)) {
        requestAnimationFrame(() => previousFocus.focus());
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b border-border/60 px-5 pt-5 pb-4">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Global Search
          </p>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Search this workspace
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search across markdown files in the opened workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon size={16} className="text-muted-foreground" />
            </div>
            <Input
              ref={inputRef}
              aria-label="Search workspace"
              type="search"
              placeholder="Search markdown files..."
              value={query}
              onChange={(event) => onChangeQuery(event.target.value)}
              className="h-9 bg-background pl-10 text-sm"
            />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto px-2 pb-2">
          {isLoading ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">Searching...</p>
          ) : null}
          {!isLoading && !query.trim() ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              Type to search across the opened workspace.
            </p>
          ) : null}
          {!isLoading && query.trim() && results.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              No results found for “{query}”.
            </p>
          ) : null}
          {!isLoading
            ? results.map((result) => (
                <ResultItem
                  key={`${result.path}:${result.line}:${result.snippet}`}
                  result={result}
                  onOpenResult={onOpenResult}
                />
              ))
            : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
