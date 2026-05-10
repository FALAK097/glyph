import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { WikiSuggestItem, WikiSuggestListHandle, WikiSuggestListProps } from "../types/wiki-suggest";
import {
  SparklesIcon,
  IdeaIcon,
  BookIcon,
  BriefcaseIcon,
  CalendarIcon,
  DiscountTagIcon,
  ArchiveIcon,
  HomeIcon,
  GlobeIcon,
  LayersIcon,
  NotebookIcon,
  HonourStarIcon,
  LeafIcon,
  CameraIcon,
  RocketIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  FileIcon,
} from "./icons";

const ICONS_MAP: Record<string, React.ComponentType<any>> = {
  spark: SparklesIcon,
  idea: IdeaIcon,
  book: BookIcon,
  work: BriefcaseIcon,
  calendar: CalendarIcon,
  tag: DiscountTagIcon,
  archive: ArchiveIcon,
  home: HomeIcon,
  globe: GlobeIcon,
  layers: LayersIcon,
  notebook: NotebookIcon,
  star: HonourStarIcon,
  leaf: LeafIcon,
  camera: CameraIcon,
  rocket: RocketIcon,
  sun: SunIcon,
  moon: MoonIcon,
  monitor: MonitorIcon,
};

function LocalNoteIcon({ iconKey }: { iconKey?: string | null }) {
  const IconComponent = iconKey ? ICONS_MAP[iconKey] : null;
  if (IconComponent) {
    return <IconComponent size={14} className="text-primary shrink-0" />;
  }
  return <FileIcon size={14} className="text-muted-foreground/50 shrink-0" />;
}

export const WikiSuggestList = forwardRef<WikiSuggestListHandle, WikiSuggestListProps>(
  ({ items, onSelect }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const prevItemsLengthRef = useRef(items.length);
    const selectedRef = useRef<HTMLButtonElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (items.length !== prevItemsLengthRef.current) {
        prevItemsLengthRef.current = items.length;
        setSelectedIndex(0);
      }
    }, [items.length]);

    useEffect(() => {
      selectedRef.current?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const handleSelectionChange = useCallback((index: number) => {
      setSelectedIndex(index);
    }, []);

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
          if (event.key === "Enter" || event.key === "Tab") {
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
        <div className="slash-panel" role="listbox" aria-label="Note suggestions">
          <p className="slash-empty">No notes found</p>
        </div>
      );
    }

    return (
      <div ref={containerRef} className="slash-panel" role="listbox" aria-label="Note suggestions">
        {items.map((item: WikiSuggestItem, index: number) => {
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
              onMouseEnter={() => handleSelectionChange(index)}
              style={{ gap: "10px" }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <LocalNoteIcon iconKey={item.icon} />
                <span className="slash-row-label flex-1 truncate">{item.title}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  },
);

WikiSuggestList.displayName = "WikiSuggestList";
