import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { parseDocument } from "yaml";

import {
  parseMarkdownFrontmatter,
  serializeMarkdownFrontmatter,
} from "@/core/frontmatter";
import { getBaseName, getDirName } from "@/core/paths";
import type { FileDocument } from "@/core/workspace";
import { cn } from "@/core/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  ArchiveIcon,
  ArrowDownIcon,
  BookIcon,
  BriefcaseIcon,
  CalendarIcon,
  CameraIcon,
  DiscountTagIcon,
  FileIcon,
  GlobeIcon,
  HomeIcon,
  HonourStarIcon,
  IdeaIcon,
  LayersIcon,
  LeafIcon,
  LinkIcon,
  MonitorIcon,
  MoonIcon,
  NotebookIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
  TickIcon,
  XIcon,
} from "./icons";

type NoteContextSidebarProps = {
  activeFile: FileDocument;
  draftContent: string;
  rootPath: string | null;
  noteTitleSuggestions: Array<{ title: string; icon: string | null; path: string | null }>;
  onClose: () => void;
  onOpenNote: (path: string) => void;
  onUpdateContent: (content: string) => void;
};

type Relationship = {
  name: string;
  note: string;
};

type IconOption = {
  key: string;
  label: string;
  icon: ReactNode;
};

type SelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  className?: string;
};

const DEFAULT_TYPES = ["None"];
const DEFAULT_STATUSES = [
  "None",
  "Not Started",
  "Active",
  "In Progress",
  "Learning",
  "Blocked",
  "Draft",
  "Archived",
  "Paused",
];
const DEFAULT_RELATIONSHIPS = ["Belongs to", "Related to", "Has"];
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "always",
  "being",
  "also",
  "because",
  "before",
  "between",
  "could",
  "doing",
  "every",
  "from",
  "have",
  "never",
  "what",
  "when",
  "where",
  "which",
  "while",
  "into",
  "make",
  "more",
  "notes",
  "only",
  "right",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "with",
  "would",
  "your",
]);

const ICON_OPTIONS: IconOption[] = [
  { key: "none", label: "None", icon: null },
  { key: "spark", label: "Spark", icon: <SparklesIcon size={13} /> },
  { key: "idea", label: "Idea", icon: <IdeaIcon size={13} /> },
  { key: "book", label: "Book", icon: <BookIcon size={13} /> },
  { key: "work", label: "Work", icon: <BriefcaseIcon size={13} /> },
  { key: "calendar", label: "Calendar", icon: <CalendarIcon size={13} /> },
  { key: "tag", label: "Tag", icon: <DiscountTagIcon size={13} /> },
  { key: "archive", label: "Archive", icon: <ArchiveIcon size={13} /> },
  { key: "home", label: "Home", icon: <HomeIcon size={13} /> },
  { key: "globe", label: "Globe", icon: <GlobeIcon size={13} /> },
  { key: "layers", label: "Layers", icon: <LayersIcon size={13} /> },
  { key: "notebook", label: "Notebook", icon: <NotebookIcon size={13} /> },
  { key: "star", label: "Star", icon: <HonourStarIcon size={13} /> },
  { key: "leaf", label: "Leaf", icon: <LeafIcon size={13} /> },
  { key: "camera", label: "Camera", icon: <CameraIcon size={13} /> },
  { key: "rocket", label: "Rocket", icon: <RocketIcon size={13} /> },
  { key: "file", label: "File", icon: <FileIcon size={13} /> },
  { key: "sun", label: "Sun", icon: <SunIcon size={13} /> },
  { key: "moon", label: "Moon", icon: <MoonIcon size={13} /> },
  { key: "monitor", label: "Monitor", icon: <MonitorIcon size={13} /> },
];

const STATUS_STYLES: Record<string, { dot: string; text: string; chip: string }> = {
  none: {
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
  },
  "not started": {
    dot: "bg-slate-500",
    text: "text-slate-600 dark:text-slate-300",
    chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  active: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  "in progress": {
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  learning: {
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  blocked: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
    chip: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
  draft: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  archived: {
    dot: "bg-zinc-500",
    text: "text-zinc-600 dark:text-zinc-300",
    chip: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  },
  paused: {
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-300",
    chip: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
};

const TAG_TONES = [
  "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  "bg-orange-500/10 text-orange-700 dark:text-orange-300",
];

type CalendarDay = {
  day: number;
  month: number;
  year: number;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en", { month: "long" });

function formatDateForString(day: number, month: number, year: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseInputDate(dateString: string): CalendarDay | null {
  if (!dateString) return null;
  const parts = dateString.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  return null;
}

function normalizeTag(input: string) {
  return input.trim().replace(/^#/, "").toLowerCase();
}

function getFrontmatterRecord(frontmatterText: string | null) {
  if (!frontmatterText) {
    return {};
  }

  const document = parseDocument(frontmatterText, {
    merge: true,
    prettyErrors: false,
    strict: false,
    uniqueKeys: false,
  });

  if (document.errors.length > 0) {
    return {};
  }

  const parsed = document.toJSON();
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function getString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function getStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(getStringArray);
  }
  if (typeof value === "string") {
    return value.split(/[,\s]+/).map(normalizeTag).filter(Boolean);
  }
  return [];
}

function getRelationships(value: unknown): Relationship[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const name = getString(record.name).trim();
    const note = getString(record.note).trim();
    if (!name || !note) return [];
    return [{ name, note }];
  });
}

function escapeYaml(value: string) {
  if (!value) return '""';
  if (/^[A-Za-z0-9_./@ -]+$/.test(value) && !/^(true|false|null|none)$/i.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function serializeValue(value: unknown, indent = ""): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return ["[]"];
    return value.flatMap((entry) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const entries = Object.entries(entry as Record<string, unknown>);
        if (entries.length === 0) return [`${indent}- {}`];
        const [firstKey, firstValue] = entries[0];
        return [
          `${indent}- ${firstKey}: ${escapeYaml(String(firstValue ?? ""))}`,
          ...entries
            .slice(1)
            .map(([key, nestedValue]) => `${indent}  ${key}: ${escapeYaml(String(nestedValue ?? ""))}`),
        ];
      }
      return `${indent}- ${escapeYaml(String(entry ?? ""))}`;
    });
  }

  return [escapeYaml(String(value ?? ""))];
}

function serializeFrontmatter(frontmatter: Record<string, unknown>) {
  return Object.entries(frontmatter)
    .filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return String(value).trim().length > 0;
    })
    .flatMap(([key, value]) => {
      const lines = serializeValue(value, "  ");
      if (lines.length === 1 && !lines[0].startsWith("  -")) {
        return `${key}: ${lines[0]}`;
      }
      return [`${key}:`, ...lines];
    })
    .join("\n");
}

function detectTags(body: string, existingTags: string[]) {
  const existing = new Set(existingTags);
  const counts = new Map<string, number>();
  const normalizedBody = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ");

  for (const match of normalizedBody.toLowerCase().matchAll(/[a-z][a-z0-9-]{4,}/g)) {
    const tag = normalizeTag(match[0]);
    if (STOP_WORDS.has(tag) || existing.has(tag)) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([tag, count]) => count >= 2 && !STOP_WORDS.has(tag))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([tag]) => tag);
}

function hashText(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function getTagTone(tag: string) {
  return TAG_TONES[hashText(tag) % TAG_TONES.length];
}

function getStatusStyle(status: string) {
  return (
    STATUS_STYLES[status.toLowerCase()] ?? {
      dot: TAG_TONES[hashText(status) % TAG_TONES.length].split(" ")[0] ?? "bg-primary/10",
      text: TAG_TONES[hashText(status) % TAG_TONES.length].split(" ").slice(1).join(" "),
      chip: TAG_TONES[hashText(status) % TAG_TONES.length],
    }
  );
}

function getIconOption(iconKey: string | null | undefined) {
  if (!iconKey) return null;
  const option = ICON_OPTIONS.find((entry) => entry.key === iconKey);
  return option?.key === "none" ? null : option;
}

function NoteGlyph({ iconKey, fallbackClassName }: { iconKey?: string | null; fallbackClassName?: string }) {
  const icon = getIconOption(iconKey);
  return icon ? (
    <span className="grid h-4 w-4 shrink-0 place-items-center text-primary">{icon.icon}</span>
  ) : (
    <FileIcon size={13} className={cn("shrink-0", fallbackClassName ?? "text-muted-foreground/50")} />
  );
}

function getSuggestionIcon(
  note: string,
  noteTitleSuggestions: Array<{ title: string; icon: string | null; path: string | null }>,
) {
  return (
    noteTitleSuggestions.find(
      (entry) => entry.title.toLowerCase() === note.toLowerCase(),
    )?.icon ?? null
  );
}

function getSuggestionPath(
  note: string,
  noteTitleSuggestions: Array<{ title: string; icon: string | null; path: string | null }>,
) {
  return (
    noteTitleSuggestions.find(
      (entry) => entry.title.toLowerCase() === note.toLowerCase(),
    )?.path ?? null
  );
}

function isCreateOptionVisible(query: string, options: SelectOption[]) {
  const trimmed = query.trim();
  return trimmed.length > 0 && !options.some((option) => option.value.toLowerCase() === trimmed.toLowerCase());
}

function filterOptions(options: SelectOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options;
  return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
}

function FieldRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="group grid min-h-[30px] grid-cols-[16px_68px_minmax(0,1fr)] items-center gap-2.5 px-1 text-[11px] leading-none">
      <span className="text-muted-foreground/75">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CompactInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:bg-muted/30 focus:border-primary/20 focus:bg-muted/50 ${props.className ?? ""}`}
    />
  );
}

function BasePopover({
  open,
  onOpenChange,
  trigger,
  children,
  className,
  align = "end",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger render={trigger} />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align={align}
          sideOffset={4}
          className="isolate z-50 outline-none"
        >
          <Popover.Popup
            className={cn(
              "z-50 max-h-(--available-height) max-w-[calc(100vw-24px)] origin-(--transform-origin) overflow-hidden rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "dark:bg-popover/90 dark:backdrop-blur-2xl",
              className,
            )}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function OptionPicker({
  value,
  options,
  placeholder,
  searchPlaceholder,
  allowCreate = true,
  onChange,
  renderTrigger,
  align = "end",
  widthClassName = "w-[200px]",
  defaultOpen = false,
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  allowCreate?: boolean;
  onChange: (value: string) => void;
  renderTrigger?: (option: SelectOption | null) => ReactNode;
  align?: "start" | "center" | "end";
  widthClassName?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value) ?? null;
  const filteredOptions = filterOptions(options, query);
  const showCreate = allowCreate && isCreateOptionVisible(query, options);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setQuery("");
    setOpen(false);
  };

  return (
    <BasePopover
      align={align}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      trigger={
        <button
          type="button"
          className="flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded-md border border-transparent bg-transparent px-1 text-left text-xs text-foreground transition-colors hover:bg-muted/50 focus:border-primary/20 focus:bg-muted/50 focus:outline-none"
        >
          <span className="min-w-0 truncate">
            {renderTrigger ? renderTrigger(selected) : selected?.label || value || placeholder}
          </span>
          <ArrowDownIcon size={11} className="shrink-0 opacity-40" />
        </button>
      }
    >
      <div className={cn("flex flex-col overflow-hidden", widthClassName)}>
        <div className="flex items-center gap-1.5 border-b border-border/40 px-2.5 py-2">
          <SearchIcon size={12} className="text-muted-foreground/60" />
          <input
            autoFocus
            value={query}
            placeholder={searchPlaceholder}
            className="h-5 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }
              if (event.key === "Enter") {
                const first = filteredOptions[0];
                selectValue(first?.value ?? query.trim());
              }
            }}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1" role="listbox">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors",
                option.value === value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
              )}
              role="option"
              aria-selected={option.value === value}
              onClick={() => selectValue(option.value)}
            >
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center text-muted-foreground">
                {option.value === value ? <TickIcon size={12} className="text-primary" /> : option.icon}
              </span>
              <span className={cn("min-w-0 truncate", option.className)}>{option.label}</span>
            </button>
          ))}
          {showCreate ? (
            <>
              {filteredOptions.length > 0 ? <div className="my-1 h-px bg-border/40" /> : null}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
                onClick={() => selectValue(query.trim())}
              >
                <PlusIcon size={12} />
                <span className="truncate">Create "{query.trim()}"</span>
              </button>
            </>
          ) : null}
          {filteredOptions.length === 0 && !showCreate ? (
            <div className="px-2 py-3 text-center text-[11px] text-muted-foreground/60 italic">
              No matches
            </div>
          ) : null}
        </div>
      </div>
    </BasePopover>
  );
}
function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsedDay = useMemo(() => parseInputDate(value), [value]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (parsedDay) return new Date(parsedDay.year, parsedDay.month, 1);
    return new Date();
  });

  const today = useMemo(() => {
    const current = new Date();
    return { day: current.getDate(), month: current.getMonth(), year: current.getFullYear() };
  }, []);

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = MONTH_FORMATTER.format(calendarMonth);

  const emptyCells = Array.from({ length: firstWeekday }, (_, index) => index);

  const handleShiftMonth = (offset: number) => {
    setCalendarMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + offset, 1);
      return next;
    });
  };

  const handleSelectDay = (day: number) => {
    onChange(formatDateForString(day, month, year));
    setOpen(false);
  };

  return (
    <BasePopover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          className="flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded-md border border-transparent bg-transparent px-1 text-left text-xs text-foreground transition-colors hover:bg-muted/50 focus:border-primary/20 focus:bg-muted/50 focus:outline-none"
        >
          <span className="min-w-0 truncate text-muted-foreground/70">
            {value || "Set date..."}
          </span>
          <CalendarIcon size={11} className="shrink-0 opacity-40" />
        </button>
      }
    >
      <div className="w-52 p-2.5">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => handleShiftMonth(-1)}
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span className="text-xs font-bold">‹</span>
          </button>
          <span className="text-[11px] font-semibold tracking-tight text-foreground">
            {monthLabel} {year}
          </span>
          <button
            type="button"
            onClick={() => handleShiftMonth(1)}
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span className="text-xs font-bold">›</span>
          </button>
        </div>
        <div className="mb-1.5 grid grid-cols-7 gap-px text-center text-[10px] font-medium text-muted-foreground/60">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {emptyCells.map((i) => (
            <div key={`empty-${i}`} className="h-6" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const isToday = today.day === day && today.month === month && today.year === year;
            const isSelected =
              parsedDay?.day === day && parsedDay.month === month && parsedDay.year === year;
            return (
              <button
                key={day}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={cn(
                  "h-6 w-full rounded-md text-[10px] transition-colors font-medium",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "hover:bg-muted text-foreground/80 hover:text-foreground",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="mt-2.5 w-full rounded-md border border-border/40 bg-muted/10 py-1.5 text-[10px] font-medium text-muted-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </BasePopover>
  );
}


function TagPill({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span
      className={`group/tag inline-flex max-w-[140px] items-center overflow-hidden rounded-full px-2 py-0.5 text-[10px] font-semibold ${getTagTone(tag)}`}
      title={tag}
    >
      <span className="min-w-0 truncate">{tag}</span>
      {onRemove ? (
        <button
          type="button"
          className="ml-0.5 max-w-0 overflow-hidden text-current opacity-0 transition-all group-hover/tag:max-w-3 group-hover/tag:opacity-80"
          onClick={onRemove}
          aria-label={`Remove ${tag}`}
        >
          x
        </button>
      ) : null}
    </span>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = getIconOption(value);

  return (
    <BasePopover
      align="end"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          className="flex h-7 w-full min-w-0 items-center gap-2 rounded-md border border-transparent bg-transparent px-1 text-left text-xs text-foreground transition-colors hover:bg-muted/50 focus:border-primary/20 focus:bg-muted/50 focus:outline-none"
        >
          {selected ? (
            <span className="text-primary">{selected.icon}</span>
          ) : (
            <span className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? "None"}</span>
          <span className="text-muted-foreground">›</span>
        </button>
      }
    >
      <div className="w-[180px] p-1.5">
        <div className="mb-1 grid grid-cols-5 gap-1.5">
          {ICON_OPTIONS.filter((option) => option.key !== "none").map((option) => (
            <Tooltip key={option.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.key);
                    setOpen(false);
                  }}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground",
                    value === option.key ? "text-primary" : "",
                  )}
                  aria-label={`Use ${option.label} icon`}
                >
                  {option.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{option.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange("none");
            setOpen(false);
          }}
          className="mt-1 flex h-7 w-full items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          None
        </button>
      </div>
    </BasePopover>
  );
}

function TagPicker({
  tags,
  suggestions,
  onToggle,
}: {
  tags: string[];
  suggestions: string[];
  onToggle: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = new Set(tags);
  const options = Array.from(new Set([...tags, ...suggestions])).sort((left, right) =>
    left.localeCompare(right),
  );
  const filtered = options.filter((tag) => tag.toLowerCase().includes(query.trim().toLowerCase()));
  const showCreate =
    query.trim().length > 0 &&
    !options.some((tag) => tag.toLowerCase() === query.trim().toLowerCase());

  return (
    <BasePopover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      trigger={
        <button
          type="button"
          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
          aria-label="Add tag"
        >
          <PlusIcon size={12} />
        </button>
      }
    >
      <div className="flex w-56 flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-border/40 px-2.5 py-2">
          <SearchIcon size={12} className="text-muted-foreground/60" />
          <input
            autoFocus
            value={query}
            placeholder="Type tag..."
            className="h-5 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && query.trim()) {
                onToggle(query.trim());
                setQuery("");
              }
            }}
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length > 0 ? (
            <div>
              <div className="px-2 py-1.5 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                Known Tags
              </div>
              {filtered.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => onToggle(tag)}
                >
                  <span className="grid w-3.5 shrink-0 place-items-center text-primary">
                    {selected.has(tag) ? <TickIcon size={12} /> : null}
                  </span>
                  <TagPill tag={tag} />
                </button>
              ))}
            </div>
          ) : null}
          {showCreate ? (
            <>
              {filtered.length > 0 ? <div className="my-1 h-px bg-border/40" /> : null}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                onClick={() => {
                  onToggle(query.trim());
                  setQuery("");
                }}
              >
                <span className="text-muted-foreground">Create</span>
                <TagPill tag={query.trim()} />
              </button>
            </>
          ) : null}
          {filtered.length === 0 && !showCreate ? (
            <div className="px-2 py-3 text-center text-[11px] text-muted-foreground/60 italic">
              No matching tags
            </div>
          ) : null}
        </div>
      </div>
    </BasePopover>
  );
}

function RelationshipNoteChip({
  note,
  icon,
  onOpen,
  onRemove,
}: {
  note: string;
  icon: string | null;
  onOpen?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group/relationship-note flex min-h-8 items-center gap-2 rounded-md bg-muted/70 px-2.5 text-xs text-foreground transition-colors hover:bg-muted">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <NoteGlyph iconKey={icon} />
        <span className="min-w-0 flex-1 truncate font-medium">{note}</span>
      </button>
      <button
        type="button"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/relationship-note:opacity-100"
        aria-label={`Remove ${note}`}
        onClick={onRemove}
      >
        <XIcon size={12} />
      </button>
    </div>
  );
}

export function NoteContextSidebar({
  activeFile,
  draftContent,
  rootPath: _rootPath,
  noteTitleSuggestions,
  onClose,
  onOpenNote,
  onUpdateContent,
}: NoteContextSidebarProps) {
  const [newRelation, setNewRelation] = useState({ name: "", note: "" });
  const [editingRelationshipName, setEditingRelationshipName] = useState<string | null>(null);
  const [showCustomRelationship, setShowCustomRelationship] = useState(false);

  const parsed = useMemo(() => parseMarkdownFrontmatter(draftContent), [draftContent]);
  const frontmatter = useMemo(
    () => getFrontmatterRecord(parsed.frontmatterText),
    [parsed.frontmatterText],
  );
  const model = useMemo(() => {
    const tags = Array.from(
      new Set([
        ...getStringArray(frontmatter.tags),
        ...getStringArray(frontmatter.tag),
        ...getStringArray(frontmatter.keywords),
      ]),
    );
    return {
      date: getString(frontmatter.date),
      icon: getString(frontmatter.icon) || "none",
      relationships: getRelationships(frontmatter.relationships),
      status: getString(frontmatter.status) || "None",
      tags,
      type: getString(frontmatter.type) || "None",
      url: getString(frontmatter.url),
      suggestedTags: detectTags(parsed.body, tags),
    };
  }, [frontmatter, parsed.body]);

  const folderName = getBaseName(getDirName(activeFile.path)) || "Workspace";
  const title = activeFile.name.replace(/\.md$/i, "");
  const selectedIcon = ICON_OPTIONS.find((option) => option.key === model.icon) ?? ICON_OPTIONS[0];
  const knownTypes = Array.from(new Set([...DEFAULT_TYPES, model.type])).filter(Boolean);
  const knownStatuses = Array.from(new Set([...DEFAULT_STATUSES, model.status])).filter(Boolean);
  const knownTags = Array.from(new Set([...model.tags, ...model.suggestedTags])).sort();
  const typeOptions = knownTypes.map((type) => ({
    value: type,
    label: type,
    icon: type === "None" ? <FileIcon size={12} /> : <SparklesIcon size={12} />,
    className: type === "None" ? "text-muted-foreground" : "text-primary",
  }));
  const statusOptions = knownStatuses.map((status) => {
    const style = getStatusStyle(status);
    return {
      value: status,
      label: status,
      icon: <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />,
      className: style.text,
    };
  });
  const noteTitleOptions = [
    { title, icon: model.icon === "none" ? null : model.icon, path: activeFile.path },
    { title: folderName, icon: null, path: null },
    ...noteTitleSuggestions,
  ]
    .filter((entry) => entry.title)
    .reduce<Array<{ title: string; icon: string | null; path: string | null }>>((accumulator, entry) => {
      if (!accumulator.some((existing) => existing.title.toLowerCase() === entry.title.toLowerCase())) {
        accumulator.push(entry);
      }
      return accumulator;
    }, [])
    .map((entry) => ({
      value: entry.title,
      label: entry.title,
      icon: <NoteGlyph iconKey={entry.icon} />,
    }));

  const updateFrontmatter = (nextValues: Record<string, unknown>) => {
    const nextFrontmatter = { ...frontmatter, ...nextValues };
    onUpdateContent(
      serializeMarkdownFrontmatter({
        frontmatterText: serializeFrontmatter(nextFrontmatter),
        body: parsed.body,
      }),
    );
  };

  const addTag = (tagInput: string) => {
    const tag = normalizeTag(tagInput);
    if (!tag || model.tags.includes(tag)) return;
    updateFrontmatter({ tags: [...model.tags, tag] });
  };

  const addRelationship = (nameInput: string, noteInput: string) => {
    const name = nameInput.trim();
    const note = noteInput.trim();
    if (!name || !note) return;
    updateFrontmatter({ relationships: [...model.relationships, { name, note }] });
    setNewRelation({ name: "", note: "" });
    setEditingRelationshipName(null);
    setShowCustomRelationship(false);
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 px-3">
        <div className="flex min-w-0 items-center gap-2">
          {model.icon !== "none" ? <span className="text-primary">{selectedIcon.icon}</span> : null}
          <span className="truncate text-xs font-semibold text-foreground">{title}</span>
        </div>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close context sidebar"
          onClick={onClose}
        >
          <XIcon size={14} />
        </button>
      </header>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <section className="space-y-1.5">
          <FieldRow icon={<FileIcon size={13} />} label="Type">
            <OptionPicker
              value={model.type}
              options={typeOptions}
              placeholder="None"
              searchPlaceholder="Search types..."
              onChange={(value) => updateFrontmatter({ type: value === "None" ? "" : value })}
              renderTrigger={(option) => (
                <span className="inline-flex items-center gap-1.5 text-foreground/80">
                  <span className="opacity-70">{option?.icon}</span>
                  <span className="truncate font-medium">{option?.label ?? model.type}</span>
                </span>
              )}
            />
          </FieldRow>

          <FieldRow
            icon={<span className="block h-2.5 w-2.5 rounded-full border border-muted-foreground/70" />}
            label="Status"
          >
            <OptionPicker
              value={model.status}
              options={statusOptions}
              placeholder="None"
              searchPlaceholder="Type status..."
              onChange={(value) => updateFrontmatter({ status: value === "None" ? "" : value })}
              renderTrigger={(option) => (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", getStatusStyle(option?.value ?? model.status).dot)} />
                  <span className={cn("truncate font-medium", getStatusStyle(option?.value ?? model.status).text)}>
                    {option?.label ?? model.status}
                  </span>
                </span>
              )}
            />
          </FieldRow>

          <FieldRow icon={<SparklesIcon size={13} />} label="Icon">
            <IconPicker
              value={model.icon}
              onChange={(value) => updateFrontmatter({ icon: value === "none" ? "" : value })}
            />
          </FieldRow>

          <FieldRow icon={<CalendarIcon size={13} />} label="Date">
            <DatePicker
              value={model.date}
              onChange={(nextDate) => updateFrontmatter({ date: nextDate })}
            />
          </FieldRow>

          <FieldRow icon={<LinkIcon size={13} />} label="URL">
            <div className="flex min-w-0 items-center gap-1">
              <CompactInput
                type="url"
                value={model.url}
                placeholder="-"
                className={model.url ? "text-primary" : ""}
                onChange={(event) => updateFrontmatter({ url: event.target.value })}
              />
              {model.url ? (
                <a
                  href={model.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-primary/10"
                  aria-label="Open URL"
                >
                  <LinkIcon size={13} />
                </a>
              ) : null}
            </div>
          </FieldRow>
        </section>

        <div className="my-3 h-px bg-border/30" />

        <section>
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground/70">
            <span className="flex items-center gap-1.5">
              <DiscountTagIcon size={12} />
              Tags
            </span>
            <TagPicker
              tags={model.tags}
              suggestions={knownTags}
              onToggle={(tag) => {
                const normalizedTag = normalizeTag(tag);
                if (!normalizedTag) return;
                updateFrontmatter({
                  tags: model.tags.includes(normalizedTag)
                    ? model.tags.filter((current) => current !== normalizedTag)
                    : [...model.tags, normalizedTag],
                });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[24px]">
            {model.tags.length > 0 ? (
              model.tags.map((tag) => (
                <TagPill
                  key={tag}
                  tag={tag}
                  onRemove={() =>
                    updateFrontmatter({ tags: model.tags.filter((current) => current !== tag) })
                  }
                />
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground/40 italic">No tags yet</span>
            )}
          </div>
          {model.suggestedTags.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/20 flex flex-wrap gap-1">
              <span className="w-full text-[9px] text-muted-foreground/60 uppercase tracking-wider">Suggested</span>
              {model.suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/70 bg-muted/50 transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => addTag(tag)}
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="my-3 h-px bg-border/30" />

        <section>
          <div className="mb-2 text-[11px] font-medium text-muted-foreground/70">Relationships</div>
          <div className="space-y-3">
            {DEFAULT_RELATIONSHIPS.map((relationshipName) => {
              const matchingRelationships = model.relationships
                .map((relationship, index) => ({ ...relationship, index }))
                .filter((relationship) => relationship.name === relationshipName);
              return (
                <div key={relationshipName} className="space-y-1.5">
                  <div
                    className={cn(
                      "text-xs",
                      matchingRelationships.length > 0
                        ? "text-muted-foreground"
                        : "text-muted-foreground/45",
                    )}
                  >
                    {relationshipName}
                  </div>
                  {matchingRelationships.map((relationship) => {
                    const iconKey = getSuggestionIcon(relationship.note, noteTitleSuggestions);
                    const notePath = getSuggestionPath(relationship.note, noteTitleSuggestions);
                    return (
                      <RelationshipNoteChip
                        key={`${relationship.name}-${relationship.note}-${relationship.index}`}
                        note={relationship.note}
                        icon={iconKey}
                        onOpen={notePath ? () => onOpenNote(notePath) : undefined}
                        onRemove={() =>
                          updateFrontmatter({
                            relationships: model.relationships.filter(
                              (_entry, index) => index !== relationship.index,
                            ),
                          })
                        }
                      />
                    );
                  })}
                  {editingRelationshipName === relationshipName ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_28px] gap-1.5">
                      <OptionPicker
                        value=""
                        options={noteTitleOptions}
                        placeholder="Add note title"
                        searchPlaceholder="Search notes..."
                        onChange={(value) => addRelationship(relationshipName, value)}
                        defaultOpen
                        renderTrigger={() => <span className="text-muted-foreground">Add</span>}
                      />
                      <button
                        type="button"
                        className="grid h-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => setEditingRelationshipName(null)}
                        aria-label="Cancel relationship"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="h-8 w-full rounded-md border border-dashed border-border bg-background px-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      onClick={() => setEditingRelationshipName(relationshipName)}
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}

            {model.relationships
              .map((relationship, index) => ({ ...relationship, index }))
              .filter((relationship) => !DEFAULT_RELATIONSHIPS.includes(relationship.name))
              .reduce<Array<{ name: string; items: Array<Relationship & { index: number }> }>>(
                (groups, relationship) => {
                  const group = groups.find((entry) => entry.name === relationship.name);
                  if (group) {
                    group.items.push(relationship);
                  } else {
                    groups.push({ name: relationship.name, items: [relationship] });
                  }
                  return groups;
                },
                [],
              )
              .map((group) => {
                return (
                  <div key={group.name} className="space-y-1.5">
                    <div className="text-xs text-muted-foreground">{group.name}</div>
                    {group.items.map((relationship) => {
                      const iconKey = getSuggestionIcon(relationship.note, noteTitleSuggestions);
                      const notePath = getSuggestionPath(relationship.note, noteTitleSuggestions);
                      return (
                        <RelationshipNoteChip
                          key={`${relationship.name}-${relationship.note}-${relationship.index}`}
                          note={relationship.note}
                          icon={iconKey}
                          onOpen={notePath ? () => onOpenNote(notePath) : undefined}
                          onRemove={() =>
                            updateFrontmatter({
                              relationships: model.relationships.filter(
                                (_entry, index) => index !== relationship.index,
                              ),
                            })
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}

            {showCustomRelationship ? (
              <div className="grid grid-cols-[100px_minmax(0,1fr)_28px_28px] gap-1.5 items-center">
                <OptionPicker
                  align="start"
                  value={newRelation.name}
                  options={Array.from(
                    new Set([
                      ...DEFAULT_RELATIONSHIPS,
                      ...model.relationships.map((relationship) => relationship.name),
                    ]),
                  ).map((name) => ({ value: name, label: name }))}
                  placeholder="Name"
                  searchPlaceholder="Relationship name..."
                  allowCreate
                  widthClassName="w-[156px]"
                  onChange={(value) => setNewRelation((current) => ({ ...current, name: value }))}
                />
                <OptionPicker
                  value={newRelation.note}
                  options={noteTitleOptions}
                  placeholder="Note title"
                  searchPlaceholder="Search notes..."
                  onChange={(value) => setNewRelation((current) => ({ ...current, note: value }))}
                />
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!newRelation.name.trim() || !newRelation.note.trim()}
                  onClick={() => addRelationship(newRelation.name, newRelation.note)}
                >
                  <TickIcon size={13} />
                </button>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setShowCustomRelationship(false);
                    setNewRelation({ name: "", note: "" });
                  }}
                >
                  <XIcon size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-1 h-8 w-full rounded-md border border-border bg-background text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                onClick={() => setShowCustomRelationship(true)}
              >
                + Add relationship
              </button>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
