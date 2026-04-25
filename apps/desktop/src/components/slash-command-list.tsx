import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type {
  SlashCommandItem,
  SlashCommandListHandle,
  SlashCommandListProps,
} from "../types/slash-command";
import { formatKeysForPlatform, splitShortcutTokens } from "../shared/shortcuts";

/**
 * Render a shortcut string as individual `<kbd>` token spans.
 * Converts the internal format (e.g. "⌘ ⌥ 1") to the platform-appropriate
 * display (e.g. "⌘⌥1" on macOS, "Ctrl+Alt+1" on Windows) then splits into
 * per-key tokens.
 */
function ShortcutBadge({ shortcut }: { shortcut: string }) {
  const display = formatKeysForPlatform(shortcut, navigator.platform);
  const tokens = splitShortcutTokens(display);
  return (
    <span className="slash-kbd-group" aria-label={display}>
      {tokens.map((token, i) => (
        <kbd key={i} className="slash-kbd">
          {token}
        </kbd>
      ))}
    </span>
  );
}

export const SlashCommandList = forwardRef<SlashCommandListHandle, SlashCommandListProps>(
  ({ items, onSelect }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const selectedRef = useRef<HTMLButtonElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useEffect(() => {
      selectedRef.current?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) onSelect(item);
      },
      [items, onSelect],
    );

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === "ArrowUp") {
            if (items.length === 0) return false;
            setSelectedIndex((i) => (i + items.length - 1) % items.length);
            return true;
          }
          if (event.key === "ArrowDown") {
            if (items.length === 0) return false;
            setSelectedIndex((i) => (i + 1) % items.length);
            return true;
          }
          if (event.key === "Enter") {
            selectItem(selectedIndex);
            return true;
          }
          return false;
        },
      }),
      [items.length, selectedIndex, selectItem],
    );

    if (items.length === 0) {
      return (
        <div className="slash-panel" role="listbox" aria-label="Markdown commands">
          <p className="slash-empty">No commands found</p>
        </div>
      );
    }

    return (
      <div ref={containerRef} className="slash-panel" role="listbox" aria-label="Markdown commands">
        {items.map((item: SlashCommandItem, index: number) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              ref={isSelected ? selectedRef : null}
              className={`slash-row${isSelected ? " slash-row--selected" : ""}`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="slash-row-label">{item.title}</span>
              {item.shortcut ? <ShortcutBadge shortcut={item.shortcut} /> : null}
            </button>
          );
        })}
      </div>
    );
  },
);

SlashCommandList.displayName = "SlashCommandList";
