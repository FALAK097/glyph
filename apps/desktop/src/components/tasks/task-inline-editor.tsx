import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { TaskColumnColor } from "@/core/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/utils";

const COLOR_BORDER: Record<TaskColumnColor, string> = {
  amber: "border-chart-2/35",
  blue: "border-primary/35",
  cyan: "border-chart-3/35",
  emerald: "border-chart-5/35",
  lime: "border-chart-5/35",
  orange: "border-chart-2/35",
  pink: "border-chart-4/35",
  rose: "border-destructive/35",
  slate: "border-muted-foreground/25",
  violet: "border-chart-4/35",
};

// Overrides the Input's default purple --ring focus styles to match column color
const COLOR_INPUT_FOCUS: Record<TaskColumnColor, string> = {
  amber: "focus-visible:border-chart-2/60 focus-visible:ring-chart-2/25",
  blue: "focus-visible:border-primary/60 focus-visible:ring-primary/25",
  cyan: "focus-visible:border-chart-3/60 focus-visible:ring-chart-3/25",
  emerald: "focus-visible:border-chart-5/60 focus-visible:ring-chart-5/25",
  lime: "focus-visible:border-chart-5/60 focus-visible:ring-chart-5/25",
  orange: "focus-visible:border-chart-2/60 focus-visible:ring-chart-2/25",
  pink: "focus-visible:border-chart-4/60 focus-visible:ring-chart-4/25",
  rose: "focus-visible:border-destructive/60 focus-visible:ring-destructive/25",
  slate: "focus-visible:border-muted-foreground/40 focus-visible:ring-muted-foreground/15",
  violet: "focus-visible:border-chart-4/60 focus-visible:ring-chart-4/25",
};

// Overrides the Button's default bg-primary so it matches the column color
const COLOR_BUTTON: Record<TaskColumnColor, string> = {
  amber: "bg-chart-2 hover:bg-chart-2/80",
  blue: "bg-primary hover:bg-primary/80",
  cyan: "bg-chart-3 hover:bg-chart-3/80",
  emerald: "bg-chart-5 hover:bg-chart-5/80",
  lime: "bg-chart-5 hover:bg-chart-5/80",
  orange: "bg-chart-2 hover:bg-chart-2/80",
  pink: "bg-chart-4 hover:bg-chart-4/80",
  rose: "bg-destructive hover:bg-destructive/80",
  slate: "bg-muted-foreground hover:bg-muted-foreground/80",
  violet: "bg-chart-4 hover:bg-chart-4/80",
};

const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const TAG_PATTERN = /#[A-Za-z][\w/-]*/g;

function formatDate(day: number, month: number, year: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseTaskText(value: string) {
  const labels = Array.from(
    new Set(value.match(TAG_PATTERN)?.map((label) => label.slice(1)) ?? []),
  );
  const dueDate = value.match(DATE_PATTERN)?.[0] ?? null;
  const title = value
    .replace(TAG_PATTERN, "")
    .replace(DATE_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, labels, dueDate };
}

type PopoverAnchor = {
  top: number;
  bottom: number;
  left: number;
  width: number;
  viewportHeight: number;
};

type TaskInlineEditorProps = {
  autoFocus?: boolean;
  color?: TaskColumnColor;
  initialValue?: string;
  submitLabel: string;
  tagSuggestions: string[];
  onCancel: () => void;
  onSubmit: (value: { title: string; labels: string[]; dueDate: string | null }) => void;
};

export const TaskInlineEditor = memo(function TaskInlineEditor({
  autoFocus = false,
  color,
  initialValue = "",
  submitLabel,
  tagSuggestions,
  onCancel,
  onSubmit,
}: TaskInlineEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);

  const activeToken = value.split(/\s/).at(-1) ?? "";
  const showDatePicker = activeToken.startsWith("@");
  const tagQuery = activeToken.startsWith("#") ? activeToken.slice(1).toLowerCase() : "";
  const deferredTagQuery = useDeferredValue(tagQuery);
  const matchingTags = useMemo(
    () =>
      activeToken.startsWith("#")
        ? tagSuggestions.filter((tag) => tag.toLowerCase().includes(deferredTagQuery)).slice(0, 8)
        : [],
    [activeToken, deferredTagQuery, tagSuggestions],
  );

  const showPopover = showDatePicker || matchingTags.length > 0;

  useEffect(() => {
    if (!showPopover) {
      setAnchor(null);
      return;
    }
    const form = formRef.current;
    if (!form) return;
    const rect = form.getBoundingClientRect();
    setAnchor({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      viewportHeight: window.innerHeight,
    });
  }, [showPopover]);

  const replaceActiveToken = useCallback((nextToken: string) => {
    setValue((current) => `${current.replace(/\S*$/, "").trimEnd()} ${nextToken} `.trimStart());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = parseTaskText(value);
      if (!parsed.title) return;
      onSubmit(parsed);
      setValue("");
    },
    [onSubmit, value],
  );

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long" }).format(calendarMonth);

  // Decide whether to show above or below based on available space
  const CALENDAR_H = 300;
  const TAGS_H = matchingTags.length * 40;
  const popoverHeight = showDatePicker ? CALENDAR_H : TAGS_H;
  const spaceBelow = anchor ? anchor.viewportHeight - anchor.bottom - 8 : 0;
  const openBelow = !anchor || spaceBelow >= popoverHeight || spaceBelow >= anchor.top - 8;

  const popoverStyle: React.CSSProperties = anchor
    ? openBelow
      ? { position: "fixed", top: anchor.bottom + 8, left: anchor.left, zIndex: 9999 }
      : {
          position: "fixed",
          bottom: anchor.viewportHeight - anchor.top + 8,
          left: anchor.left,
          zIndex: 9999,
        }
    : { display: "none" };

  const popoverContent =
    anchor && showPopover
      ? createPortal(
          <div style={popoverStyle}>
            {matchingTags.length > 0 ? (
              <div className="w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
                {matchingTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => replaceActiveToken(`#${tag}`)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      #{tag}
                    </span>
                  </button>
                ))}
              </div>
            ) : showDatePicker ? (
              <div className="w-72 rounded-lg border border-border bg-popover p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-popover-foreground">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
                    }
                    className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    ‹
                  </button>
                  <span>
                    {monthLabel} {year}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
                    }
                    className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    ›
                  </button>
                </div>
                <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground/70">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <span key={d} className="py-0.5">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {Array.from({ length: firstWeekday }, (_, i) => (
                    <span key={`e-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const isToday =
                      new Date().getDate() === day &&
                      new Date().getMonth() === month &&
                      new Date().getFullYear() === year;
                    return (
                      <button
                        key={day}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => replaceActiveToken(formatDate(day, month, year))}
                        className={cn(
                          "rounded-md py-1.5 text-sm transition-colors",
                          isToday
                            ? "bg-primary/15 font-semibold text-primary hover:bg-primary/25"
                            : "text-popover-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={cn(
          "rounded-md border bg-card p-2 shadow-xs",
          color ? COLOR_BORDER[color] : "border-border",
        )}
      >
        <Input
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Task title #project @date"
          className={cn("h-9", color && COLOR_INPUT_FOCUS[color])}
        />
        <div className="mt-2 flex justify-end gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!parseTaskText(value).title}
            className={cn(color && COLOR_BUTTON[color])}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
      {popoverContent}
    </>
  );
});
