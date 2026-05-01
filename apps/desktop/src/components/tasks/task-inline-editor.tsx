import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/utils";

const DATE_PATTERN = /\b\d{2}-\d{2}-\d{4}\b/;
const TAG_PATTERN = /#[A-Za-z][\w/-]*/g;

function formatDate(day: number, month: number, year: number) {
  return `${String(day).padStart(2, "0")}-${String(month + 1).padStart(2, "0")}-${year}`;
}

export function parseTaskText(value: string) {
  const labels = Array.from(
    new Set(value.match(TAG_PATTERN)?.map((label) => label.slice(1)) ?? []),
  );
  const dueDate = value.match(DATE_PATTERN)?.[0] ?? null;
  const title = value
    .replace(TAG_PATTERN, "")
    .replace(DATE_PATTERN, "")
    .replace(/@/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, labels, dueDate };
}

type TaskInlineEditorProps = {
  autoFocus?: boolean;
  initialValue?: string;
  submitLabel: string;
  tagSuggestions: string[];
  onCancel: () => void;
  onSubmit: (value: { title: string; labels: string[]; dueDate: string | null }) => void;
};

export const TaskInlineEditor = memo(function TaskInlineEditor({
  autoFocus = false,
  initialValue = "",
  submitLabel,
  tagSuggestions,
  onCancel,
  onSubmit,
}: TaskInlineEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  const replaceActiveToken = useCallback((nextToken: string) => {
    setValue((current) => `${current.replace(/\S*$/, "").trimEnd()} ${nextToken} `.trimStart());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = parseTaskText(value);
      if (!parsed.title) {
        return;
      }
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

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-md border border-border bg-card p-2 shadow-xs"
    >
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
        placeholder="Task title #project @date"
        className="h-9"
      />
      {matchingTags.length > 0 ? (
        <div className="absolute bottom-[calc(100%+8px)] left-2 z-50 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
          {matchingTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => replaceActiveToken(`#${tag}`)}
              className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-popover-foreground hover:text-foreground"
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
      {showDatePicker ? (
        <div className="absolute bottom-[calc(100%+8px)] left-2 z-50 w-72 rounded-lg border border-border bg-popover p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-popover-foreground">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
              className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Prev
            </button>
            <span>
              {monthLabel} {year}
            </span>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
              className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Next
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: firstWeekday }, (_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
              <button
                key={day}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => replaceActiveToken(formatDate(day, month, year))}
                className={cn(
                  "rounded-md py-1.5 text-sm text-popover-foreground hover:text-foreground",
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex justify-end gap-1.5">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!parseTaskText(value).title}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
});
