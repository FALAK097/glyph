import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import type { QuickOpenPanelProps } from "../types/quick-open-panel";
import { SearchIcon } from "./icons";

export const QuickOpenPanel = ({
  query,
  items,
  isOpen,
  onChangeQuery,
  onClose,
  onOpenItem,
}: QuickOpenPanelProps) => {
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
            Quick Open
          </p>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Jump to a file
          </DialogTitle>
          <DialogDescription className="sr-only">
            Type a file name to filter notes in the current workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon size={16} className="text-muted-foreground" />
            </div>
            <Input
              ref={inputRef}
              aria-label="Quick open file"
              type="search"
              placeholder="Type a file name..."
              value={query}
              onChange={(event) => onChangeQuery(event.target.value)}
              className="h-9 bg-background pl-10 text-sm"
            />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto px-2 pb-2">
          {!query.trim() ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              Type to filter files in the current workspace.
            </p>
          ) : null}
          {query.trim() && items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              No files match “{query}”.
            </p>
          ) : null}
          {items.map((item) => (
            <Button
              key={item.path}
              className="h-auto w-full justify-start rounded-lg px-3 py-2 text-left"
              variant="ghost"
              type="button"
              onClick={() => onOpenItem(item)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <strong className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </strong>
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.relativePath}</p>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
