import { useEffect, useMemo, useRef } from "react";

type CommandPaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
  hint?: string;
  shortcut?: string;
  section: string;
  kind: "command" | "file";
  onSelect: () => void;
  onPreview?: () => void;
};

type CommandPaletteProps = {
  isOpen: boolean;
  query: string;
  items: CommandPaletteItem[];
  selectedIndex: number;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onHoverItem: (index: number) => void;
  onMove: (direction: 1 | -1) => void;
  onSelect: () => void;
};

const paletteIcons: Record<CommandPaletteItem["kind"], string> = {
  command: "⌘",
  file: "#"
};

export function CommandPalette({
  isOpen,
  query,
  items,
  selectedIndex,
  onChangeQuery,
  onClose,
  onHoverItem,
  onMove,
  onSelect
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const sections = useMemo(() => {
    const groups: Array<{ title: string; items: Array<{ item: CommandPaletteItem; index: number }> }> = [];

    items.forEach((item, index) => {
      const group = groups.at(-1);

      if (!group || group.title !== item.section) {
        groups.push({
          title: item.section,
          items: [{ item, index }]
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
      block: "nearest"
    });
  }, [isOpen, selectedIndex]);

  if (!isOpen) {
    return null;
  }

  return (
    <section className="modal-shell" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-card palette-card max-w-xl mx-auto mt-[10vh] bg-background border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ padding: 0 }}
      >
        <div className="flex items-center px-4 py-3 border-b border-border bg-muted/30">
          <input
            ref={inputRef}
            className="w-full bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground"
            aria-label="Search files, commands, and themes"
            placeholder="Search files, commands, and themes..."
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
        <div className="palette-list p-2 max-h-[350px] overflow-y-auto" role="listbox" aria-label="Command palette results">
          {items.length === 0 ? (
            <div className="palette-empty py-8 text-center text-sm text-muted-foreground">
              <p>No results found.</p>
            </div>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedIndex === index ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                }`}
                type="button"
                role="option"
                aria-selected={selectedIndex === index}
                onMouseEnter={() => {
                  onHoverItem(index);
                  item.onPreview?.();
                }}
                onClick={item.onSelect}
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">{item.title}</span>
                  {item.subtitle && (
                    <span className={`text-xs mt-0.5 ${selectedIndex === index ? "text-accent-foreground opacity-80" : "text-muted-foreground"}`}>{item.subtitle}</span>
                  )}
                </div>
                {item.shortcut ? (
                  <div className="flex gap-1">
                    {item.shortcut.split('').map((char, i) => (
                      <kbd key={i} className="px-1.5 py-0.5 text-[10px] font-sans font-medium bg-background border border-border rounded text-muted-foreground shadow-sm">
                        {char}
                      </kbd>
                    ))}
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
