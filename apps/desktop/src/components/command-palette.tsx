import { useCallback, useEffect, useMemo, useRef } from "react";

import type { CommandPaletteItem, CommandPaletteProps } from "../types/command-palette";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const CommandPalette = ({
  isOpen,
  query,
  items,
  selectedIndex,
  onChangeQuery,
  onClose,
  onHoverItem,
  onMove,
  onSelect,
}: CommandPaletteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => {
    const groups: Array<{
      title: string;
      items: Array<{ item: CommandPaletteItem; index: number }>;
    }> = [];

    items.forEach((item, index) => {
      const group = groups.at(-1);

      if (!group || group.title !== item.section) {
        groups.push({
          title: item.section,
          items: [{ item, index }],
        });
        return;
      }

      group.items.push({ item, index });
    });

    return groups;
  }, [items]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    itemRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [isOpen, selectedIndex]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-labelledby="command-palette-title"
        className="w-[90%] max-w-lg p-0 overflow-hidden border-border/50"
      >
        <h2 id="command-palette-title" className="sr-only">
          Command Palette
        </h2>
        {/* Search input */}
        <div className="px-4 py-3 border-b border-border/30 bg-background">
          <Input
            ref={inputRef}
            className="border-0 bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/50 h-10"
            aria-label="Search notes, skills, and commands…"
            placeholder="Search notes, skills, and commands…"
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
            onKeyDown={(event) => {
              // Allow Cmd+A for select all
              if ((event.metaKey || event.ctrlKey) && event.key === "a") {
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                onMove(1);
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                onMove(-1);
              }

              if (event.key === "Enter") {
                event.preventDefault();
                onSelect();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
        </div>

        {/* Results container */}
        <div
          ref={scrollContainerRef}
          className="max-h-[380px] overflow-y-auto scrollbar-hide"
          role="listbox"
          aria-label="Command palette results"
        >
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <p>No results found.</p>
            </div>
          ) : (
            <div className="px-2 pt-1 pb-2">
              {sections.map((section, sectionIdx) => (
                <div key={`${section.title}-${sectionIdx}`}>
                  {sectionIdx > 0 && <div className="h-px bg-border/20 my-1" />}
                  <div>
                    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {section.title}
                    </div>
                    {section.items.map(({ item, index }) => (
                      <Button
                        key={item.id}
                        ref={(element) => {
                          itemRefs.current[index] = element;
                        }}
                        className={`
                          h-auto w-full px-3 py-2.5 rounded-sm text-sm
                          transition-[background-color,color,transform] duration-100 ease-out flex items-center justify-between
                          ${
                            selectedIndex === index
                              ? "bg-accent/10 text-foreground"
                              : "text-foreground hover:bg-muted/50"
                          }
                        `}
                        type="button"
                        variant="ghost"
                        size="sm"
                        role="option"
                        aria-selected={selectedIndex === index}
                        onMouseEnter={() => {
                          onHoverItem(index);
                          item.onPreview?.();
                        }}
                        onClick={item.onSelect}
                      >
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <span className="font-medium text-sm">{item.title}</span>
                          {item.subtitle ? (
                            <span
                              className={`text-xs mt-0.5 truncate ${
                                selectedIndex === index
                                  ? "text-foreground/60"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {item.subtitle}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2 pl-3">
                          {item.hint ? (
                            <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                              {item.hint}
                            </span>
                          ) : null}
                          {item.shortcut ? (
                            <div className="flex gap-1">
                              {item.shortcut.split("").map((char, i) => (
                                <kbd
                                  key={`${item.id}:${i}`}
                                  className="rounded border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                  {char}
                                </kbd>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
