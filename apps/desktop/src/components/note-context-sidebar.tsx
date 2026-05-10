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

import {
  BookIcon,
  BriefcaseIcon,
  CalendarIcon,
  CameraIcon,
  DiscountTagIcon,
  FileIcon,
  ArrowDownIcon,
  HomeIcon,
  IdeaIcon,
  LeafIcon,
  LinkIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  SparklesIcon,
  TickIcon,
  XIcon,
} from "./icons";

type NoteContextSidebarProps = {
  activeFile: FileDocument;
  draftContent: string;
  rootPath: string | null;
  noteTitleSuggestions: string[];
  onClose: () => void;
  onUpdateContent: (content: string) => void;
};

type CustomProperty = {
  name: string;
  type: string;
  value: string;
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

const DEFAULT_TYPES = ["None", "Note", "Essay", "Habit", "Recipe", "Meeting", "Project"];
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
const PROPERTY_TYPES = ["Text", "Number", "Date", "Boolean", "Status", "URL", "Tags", "Color"];
const DEFAULT_RELATIONSHIPS = ["Belongs to", "Related to", "Has"];
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "between",
  "could",
  "every",
  "from",
  "have",
  "into",
  "notes",
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
  { key: "none", label: "None", icon: <FileIcon size={13} /> },
  { key: "spark", label: "Spark", icon: <SparklesIcon size={13} /> },
  { key: "idea", label: "Idea", icon: <IdeaIcon size={13} /> },
  { key: "book", label: "Book", icon: <BookIcon size={13} /> },
  { key: "work", label: "Work", icon: <BriefcaseIcon size={13} /> },
  { key: "home", label: "Home", icon: <HomeIcon size={13} /> },
  { key: "leaf", label: "Leaf", icon: <LeafIcon size={13} /> },
  { key: "camera", label: "Camera", icon: <CameraIcon size={13} /> },
  { key: "rocket", label: "Rocket", icon: <RocketIcon size={13} /> },
];

const STATUS_TONE: Record<string, string> = {
  "not started": "text-muted-foreground",
  active: "text-primary",
  "in progress": "text-primary",
  learning: "text-amber-500",
  blocked: "text-destructive",
  draft: "text-muted-foreground/80",
  archived: "text-muted-foreground/60",
  paused: "text-orange-500",
};

const TAG_TONES = [
  "bg-primary/10 text-primary",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-muted text-foreground",
  "bg-destructive/10 text-destructive",
];

const PROPERTY_TYPE_ICONS: Record<string, string> = {
  Boolean: "O",
  Color: "C",
  Date: "D",
  Number: "#",
  Status: "S",
  Tags: "#",
  Text: "T",
  URL: "U",
};

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

function getCustomProperties(value: unknown): CustomProperty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const name = getString(record.name).trim();
    if (!name) return [];
    return [{ name, type: getString(record.type) || "Text", value: getString(record.value) }];
  });
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
  for (const match of body.toLowerCase().matchAll(/[a-z][a-z0-9-]{3,}/g)) {
    const tag = normalizeTag(match[0]);
    if (STOP_WORDS.has(tag) || existing.has(tag)) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
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
              "z-50 max-h-(--available-height) min-w-[200px] max-w-[calc(100vw-24px)] origin-(--transform-origin) overflow-hidden rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  allowCreate?: boolean;
  onChange: (value: string) => void;
  renderTrigger?: (option: SelectOption | null) => ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
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
      <div className="flex w-[220px] flex-col overflow-hidden">
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
              <span className={`min-w-0 truncate ${option.className ?? ""}`}>{option.label}</span>
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
          className="grid h-5 w-5 place-items-center rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
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

function PropertyValueEditor({
  type,
  value,
  statusOptions,
  tagOptions,
  onChange,
}: {
  type: string;
  value: string;
  statusOptions: SelectOption[];
  tagOptions: string[];
  onChange: (value: string) => void;
}) {
  if (type === "Boolean") {
    const isTrue = value.toLowerCase() === "true";
    return (
      <button
        type="button"
        className="h-7 rounded-md bg-muted/70 px-2 text-xs text-foreground transition-colors hover:bg-muted"
        onClick={() => onChange(isTrue ? "false" : "true")}
      >
        {isTrue ? "Yes" : "No"}
      </button>
    );
  }

  if (type === "Status") {
    return (
      <OptionPicker
        value={value}
        options={statusOptions}
        placeholder="Status"
        searchPlaceholder="Type status..."
        onChange={onChange}
        renderTrigger={(option) => (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${option?.className ?? ""}`}>
            {option?.label || value || "Status"}
          </span>
        )}
      />
    );
  }

  if (type === "Tags") {
    return (
      <CompactInput
        value={value}
        placeholder={tagOptions.slice(0, 2).join(", ") || "tag1, tag2"}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (type === "Date") {
    return <DatePicker value={value} onChange={onChange} />;
  }

  return (
    <CompactInput
      type={type === "Number" ? "number" : type === "URL" ? "url" : "text"}
      value={value}
      placeholder="Value"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function NoteContextSidebar({
  activeFile,
  draftContent,
  rootPath: _rootPath,
  noteTitleSuggestions,
  onClose,
  onUpdateContent,
}: NoteContextSidebarProps) {
  const [newProperty, setNewProperty] = useState({ name: "", type: "Text", value: "" });
  const [newRelation, setNewRelation] = useState({ name: "Related to", note: "" });
  const [showAddProperty, setShowAddProperty] = useState(false);

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
      customProperties: getCustomProperties(frontmatter.properties),
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
    const textClass = STATUS_TONE[status.toLowerCase()] ?? "text-muted-foreground";
    // Transform 'text-blue-500' into 'bg-blue-500' to style the dot.
    const bgClass = textClass.replace("text-", "bg-");
    return {
      value: status,
      label: status,
      icon: <span className={cn("h-1.5 w-1.5 rounded-full", bgClass)} />,
      className: textClass,
    };
  });
  const iconOptions = ICON_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label,
    icon: option.icon,
  }));
  const propertyTypeOptions = PROPERTY_TYPES.map((type) => ({
    value: type,
    label: type,
    icon: <span className="text-[10px]">{PROPERTY_TYPE_ICONS[type]}</span>,
  }));
  const noteTitleOptions = Array.from(new Set([title, folderName, ...noteTitleSuggestions]))
    .filter(Boolean)
    .map((noteTitle) => ({
      value: noteTitle,
      label: noteTitle,
      icon: <FileIcon size={12} />,
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

  const addCustomProperty = () => {
    const name = newProperty.name.trim();
    if (!name) return;
    updateFrontmatter({
      properties: [...model.customProperties, { ...newProperty, name }],
    });
    setNewProperty({ name: "", type: "Text", value: "" });
  };

  const addRelationship = (nameInput: string, noteInput: string) => {
    const name = nameInput.trim();
    const note = noteInput.trim();
    if (!name || !note) return;
    updateFrontmatter({ relationships: [...model.relationships, { name, note }] });
    setNewRelation({ name, note: "" });
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
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-current", option?.className?.replace('text-', 'bg-') || 'bg-muted-foreground')} />
                  <span className={cn("truncate font-medium", option?.className || "text-foreground/80")}>
                    {option?.label ?? model.status}
                  </span>
                </span>
              )}
            />
          </FieldRow>

          <FieldRow icon={<SparklesIcon size={13} />} label="Icon">
            <OptionPicker
              value={model.icon}
              options={iconOptions}
              placeholder="None"
              searchPlaceholder="Search icons..."
              allowCreate={false}
              onChange={(value) => updateFrontmatter({ icon: value === "none" ? "" : value })}
              renderTrigger={(option) => (
                <span className="inline-flex max-w-full items-center gap-1">
                  <span className="text-primary">{option?.icon}</span>
                  <span className="truncate text-muted-foreground">{option?.label ?? "None"}</span>
                </span>
              )}
            />
          </FieldRow>

          <FieldRow icon={<CalendarIcon size={13} />} label="Date">
            <DatePicker
              value={model.date}
              onChange={(nextDate) => updateFrontmatter({ date: nextDate })}
            />
          </FieldRow>

          <FieldRow icon={<LinkIcon size={13} />} label="URL">
            <CompactInput
              type="url"
              value={model.url}
              placeholder="-"
              onChange={(event) => updateFrontmatter({ url: event.target.value })}
            />
          </FieldRow>

          {/* Inline Custom Properties following URL */}
          {model.customProperties.map((property, index) => (
            <FieldRow
              key={`${property.name}-${index}`}
              icon={<span>{PROPERTY_TYPE_ICONS[property.type] ?? "T"}</span>}
              label={property.name}
            >
              <div className="flex min-w-0 items-center gap-1">
                <PropertyValueEditor
                  type={property.type}
                  value={property.value}
                  statusOptions={statusOptions}
                  tagOptions={knownTags}
                  onChange={(value) => {
                    const nextProperties = model.customProperties.map((entry, propertyIndex) =>
                      propertyIndex === index ? { ...entry, value } : entry,
                    );
                    updateFrontmatter({ properties: nextProperties });
                  }}
                />
                <button
                  type="button"
                  className="grid h-7 w-6 shrink-0 place-items-center text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label={`Delete ${property.name}`}
                  onClick={() =>
                    updateFrontmatter({
                      properties: model.customProperties.filter(
                        (_entry, propertyIndex) => propertyIndex !== index,
                      ),
                    })
                  }
                >
                  x
                </button>
              </div>
            </FieldRow>
          ))}

          {!showAddProperty ? (
            <button
              type="button"
              className="flex h-7 w-full items-center gap-2 px-1.5 text-left text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              onClick={() => setShowAddProperty(true)}
            >
              <PlusIcon size={12} />
              <span>Add property</span>
            </button>
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-1.5 items-start mt-1 border border-border/30 p-1.5 rounded-md bg-muted/10">
              <div className="grid grid-cols-2 gap-1.5">
                <CompactInput
                  value={newProperty.name}
                  placeholder="Property name"
                  autoFocus
                  onChange={(event) =>
                    setNewProperty((current) => ({ ...current, name: event.target.value }))
                  }
                />
                <OptionPicker
                  value={newProperty.type}
                  options={propertyTypeOptions}
                  placeholder="Type"
                  searchPlaceholder="Type..."
                  allowCreate={false}
                  onChange={(value) => setNewProperty((current) => ({ ...current, type: value }))}
                  renderTrigger={(option) => (
                    <span className="inline-flex items-center gap-1 truncate">
                      {option?.icon}
                      {option?.label ?? newProperty.type}
                    </span>
                  )}
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary/20"
                  disabled={!newProperty.name.trim()}
                  onClick={() => {
                    addCustomProperty();
                    setShowAddProperty(false);
                  }}
                >
                  <TickIcon size={13} />
                </button>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted text-muted-foreground"
                  onClick={() => setShowAddProperty(false)}
                >
                  <XIcon size={12} />
                </button>
              </div>
            </div>
          )}
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
          <div className="space-y-1">
            {model.relationships.map((relationship, index) => (
              <div
                key={`${relationship.name}-${relationship.note}-${index}`}
                className="group grid grid-cols-[80px_minmax(0,1fr)_20px] gap-2 items-center p-1 rounded-md transition-colors hover:bg-muted/40 min-h-8"
              >
                <span className="truncate text-[10px] font-medium text-muted-foreground/70 px-1">
                  {relationship.name}
                </span>
                <div className="truncate text-xs text-foreground/90 flex items-center gap-1.5">
                  <FileIcon size={12} className="opacity-50 shrink-0" />
                  <span className="truncate font-medium">{relationship.note}</span>
                </div>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 grid h-5 w-5 place-items-center text-muted-foreground hover:text-destructive transition-opacity"
                  aria-label="Remove relationship"
                  onClick={() =>
                    updateFrontmatter({
                      relationships: model.relationships.filter((_, i) => i !== index),
                    })
                  }
                >
                  <XIcon size={12} />
                </button>
              </div>
            ))}

            {model.relationships.length === 0 && (
               <div className="text-[10px] text-muted-foreground/40 italic px-1 mb-1">No relationships defined</div>
            )}

            <div className="mt-2 grid grid-cols-[85px_minmax(0,1fr)_28px] gap-1.5 items-center">
              <OptionPicker
                align="start"
                value={newRelation.name}
                options={Array.from(
                  new Set([
                    ...DEFAULT_RELATIONSHIPS,
                    ...model.relationships.map((relationship) => relationship.name),
                  ]),
                ).map((name) => ({ value: name, label: name }))}
                placeholder="Rel..."
                searchPlaceholder="Search type..."
                onChange={(value) => setNewRelation((current) => ({ ...current, name: value }))}
              />
              <OptionPicker
                value={newRelation.note}
                options={noteTitleOptions}
                placeholder="Pick note..."
                searchPlaceholder="Search notes..."
                onChange={(value) => setNewRelation((current) => ({ ...current, note: value }))}
              />
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-md border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={!newRelation.name.trim() || !newRelation.note.trim()}
                onClick={() => addRelationship(newRelation.name, newRelation.note)}
              >
                <PlusIcon size={13} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
