import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { TaskColumnColor } from "@/core/tasks";
import { Button } from "@/components/ui/button";
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

// Overrides the default purple --ring focus styles to match column color
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
const MONTH_FORMATTER = new Intl.DateTimeFormat("en", { month: "long" });

function formatDate(day: number, month: number, year: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTaskText(value: string) {
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

type CalendarDay = {
  day: number;
  month: number;
  year: number;
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
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<CalendarDay | null>(null);
  const [today] = useState(() => {
    const current = new Date();
    return {
      day: current.getDate(),
      month: current.getMonth(),
      year: current.getFullYear(),
    };
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);

  // The last whitespace-delimited token determines which popover shows
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

  // Reset selected tag index when suggestions change (dep on matchingTags, not .length,
  // so same-size result swaps after the query changes also reset the highlight).
  useEffect(() => {
    setSelectedTagIndex(0);
  }, [matchingTags]);

  // Reset calendar selected day when date picker closes
  useEffect(() => {
    if (!showDatePicker) {
      setCalendarSelectedDay(null);
    }
  }, [showDatePicker]);

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

  // Auto-grow textarea height to fit content.
  // If a popover is currently open, re-measure the form's bounding rect so the
  // portal stays pinned to the correct position after the height changes.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (showPopover) {
      const rect = formRef.current?.getBoundingClientRect();
      if (rect) {
        setAnchor({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          viewportHeight: window.innerHeight,
        });
      }
    }
  }, [showPopover, value]);

  const replaceActiveToken = useCallback((nextToken: string) => {
    setValue((current) => `${current.replace(/\S*$/, "").trimEnd()} ${nextToken} `.trimStart());
    window.setTimeout(() => textareaRef.current?.focus(), 0);
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
  const monthLabel = MONTH_FORMATTER.format(calendarMonth);
  const emptyDayKeys = useMemo(
    () => Array.from({ length: firstWeekday }, (_, index) => `empty-${year}-${month}-${index + 1}`),
    [firstWeekday, month, year],
  );
  const shiftCalendarMonth = useCallback((offset: number) => {
    setCalendarMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + offset, 1);
      return next;
    });
  }, []);

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
                {matchingTags.map((tag, tagIndex) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setSelectedTagIndex(tagIndex)}
                    onClick={() => replaceActiveToken(`#${tag}`)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm",
                      tagIndex === selectedTagIndex ? "bg-muted" : "hover:bg-muted",
                    )}
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
                    onClick={() => shiftCalendarMonth(-1)}
                    className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    ‹
                  </button>
                  <span>
                    {monthLabel} {year}
                  </span>
                  <button
                    type="button"
                    onClick={() => shiftCalendarMonth(1)}
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
                  {emptyDayKeys.map((key) => (
                    <span key={key} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const isToday =
                      today.day === day && today.month === month && today.year === year;
                    const isSelected =
                      calendarSelectedDay !== null &&
                      calendarSelectedDay.day === day &&
                      calendarSelectedDay.month === month &&
                      calendarSelectedDay.year === year;
                    return (
                      <button
                        key={day}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => replaceActiveToken(formatDate(day, month, year))}
                        className={cn(
                          "rounded-md py-1.5 text-sm transition-colors",
                          isSelected && isToday
                            ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                            : isSelected
                              ? "bg-primary/80 font-semibold text-primary-foreground hover:bg-primary/70"
                              : isToday
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
        <textarea
          ref={textareaRef}
          autoFocus={autoFocus}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onCancel();
              return;
            }
            // Tab / Shift+Tab with date picker open: navigate calendar days
            if (e.key === "Tab" && showDatePicker) {
              e.preventDefault();
              const dir = e.shiftKey ? -1 : 1;
              const base = calendarSelectedDay ?? today;
              const d = new Date(base.year, base.month, base.day + dir);
              const next: CalendarDay = {
                day: d.getDate(),
                month: d.getMonth(),
                year: d.getFullYear(),
              };
              setCalendarSelectedDay(next);
              // Keep the calendar showing the month that contains the selected day
              setCalendarMonth(new Date(next.year, next.month, 1));
              return;
            }
            // Shift+Enter: insert a newline — native textarea behaviour, no preventDefault needed
            if (e.key === "Enter" && e.shiftKey) {
              return;
            }
            // Enter with date picker open: confirm selected day (or today if none selected)
            if (e.key === "Enter" && showDatePicker) {
              e.preventDefault();
              const d = calendarSelectedDay ?? today;
              replaceActiveToken(formatDate(d.day, d.month, d.year));
              return;
            }
            // Enter with tag suggestions open: select highlighted tag
            if (e.key === "Enter" && matchingTags.length > 0) {
              e.preventDefault();
              replaceActiveToken(`#${matchingTags[selectedTagIndex] ?? matchingTags[0]}`);
              return;
            }
            // Enter with no popover open: submit the form
            if (e.key === "Enter") {
              e.preventDefault();
              const parsed = parseTaskText(value);
              if (!parsed.title) return;
              onSubmit(parsed);
              setValue("");
              return;
            }
            // Arrow keys to navigate tag suggestions
            if (e.key === "ArrowDown" && matchingTags.length > 0) {
              e.preventDefault();
              setSelectedTagIndex((i) => Math.min(i + 1, matchingTags.length - 1));
              return;
            }
            if (e.key === "ArrowUp" && matchingTags.length > 0) {
              e.preventDefault();
              setSelectedTagIndex((i) => Math.max(i - 1, 0));
            }
          }}
          placeholder="Task title #project @date"
          className={cn(
            // Mirror Input component styling minus fixed height — auto-grows via useEffect
            "min-h-9 w-full min-w-0 resize-none overflow-hidden rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow]",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
            color && COLOR_INPUT_FOCUS[color],
          )}
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
