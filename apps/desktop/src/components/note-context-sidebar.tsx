import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { parseDocument } from "yaml";

import {
  parseMarkdownFrontmatter,
  serializeMarkdownFrontmatter,
} from "@/core/frontmatter";
import { getBaseName, getDirName } from "@/core/paths";
import type { FileDocument } from "@/core/workspace";

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
  "not started": "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary",
  "in progress": "bg-primary/10 text-primary",
  learning: "bg-accent text-accent-foreground",
  blocked: "bg-destructive/10 text-destructive",
  draft: "bg-muted text-foreground",
  archived: "bg-muted text-muted-foreground",
  paused: "bg-secondary text-secondary-foreground",
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
    <div className="group grid min-h-8 grid-cols-[18px_72px_minmax(0,1fr)] items-center gap-2 text-xs">
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
      className={`h-7 w-full rounded-md border border-transparent bg-muted/70 px-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background ${props.className ?? ""}`}
    />
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
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  allowCreate?: boolean;
  onChange: (value: string) => void;
  renderTrigger?: (option: SelectOption | null) => ReactNode;
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
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <button
        type="button"
        className="flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded-md border border-transparent bg-muted/70 px-2 text-left text-xs text-foreground transition-colors hover:bg-muted focus:border-primary/40 focus:bg-background focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">
          {renderTrigger ? renderTrigger(selected) : selected?.label || value || placeholder}
        </span>
        <ArrowDownIcon size={12} className="shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-[220px] overflow-hidden rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            <SearchIcon size={12} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              placeholder={searchPlaceholder}
              className="h-6 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
                if (event.key === "Enter") {
                  const first = filteredOptions[0];
                  selectValue(first?.value ?? query.trim());
                }
              }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1" role="listbox">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                role="option"
                aria-selected={option.value === value}
                onClick={() => selectValue(option.value)}
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center text-[10px] text-muted-foreground">
                  {option.value === value ? <TickIcon size={12} /> : option.icon}
                </span>
                <span className={`min-w-0 truncate ${option.className ?? ""}`}>{option.label}</span>
              </button>
            ))}
            {showCreate ? (
              <>
                {filteredOptions.length > 0 ? <div className="my-1 h-px bg-border" /> : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => selectValue(query.trim())}
                >
                  <PlusIcon size={12} />
                  <span className="truncate">Create {query.trim()}</span>
                </button>
              </>
            ) : null}
            {filteredOptions.length === 0 && !showCreate ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
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
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <button
        type="button"
        className="text-muted-foreground transition-colors hover:text-primary"
        aria-label="Add tag"
        onClick={() => setOpen((current) => !current)}
      >
        <PlusIcon size={13} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 overflow-hidden rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            <SearchIcon size={12} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              placeholder="Type tag..."
              className="h-6 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
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
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              <div>
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  From vault
                </div>
                {filtered.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted"
                    onClick={() => onToggle(tag)}
                  >
                    <span className="grid w-3 place-items-center text-primary">
                      {selected.has(tag) ? <TickIcon size={11} /> : null}
                    </span>
                    <TagPill tag={tag} />
                  </button>
                ))}
              </div>
            ) : null}
            {showCreate ? (
              <>
                {filtered.length > 0 ? <div className="my-1 h-px bg-border" /> : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => {
                    onToggle(query.trim());
                    setQuery("");
                  }}
                >
                  Create <TagPill tag={query.trim()} />
                </button>
              </>
            ) : null}
            {filtered.length === 0 && !showCreate ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">No tags</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
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

  return (
    <CompactInput
      type={type === "Number" ? "number" : type === "Date" ? "date" : type === "URL" ? "url" : "text"}
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
  const [editingRelationship, setEditingRelationship] = useState<string | null>(null);

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
  const statusOptions = knownStatuses.map((status) => ({
    value: status,
    label: status,
    icon: (
      <span
        className={`h-1.5 w-1.5 rounded-full ${STATUS_TONE[status.toLowerCase()] ?? "bg-muted"}`}
      />
    ),
    className: STATUS_TONE[status.toLowerCase()] ?? "bg-muted text-foreground",
  }));
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
                <span
                  className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${option?.className ?? "bg-primary/10 text-primary"}`}
                >
                  {option?.icon}
                  <span className="truncate">{option?.label ?? model.type}</span>
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
                <span
                  className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${option?.className ?? "bg-muted text-foreground"}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  <span className="truncate">{option?.label ?? model.status}</span>
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
            <CompactInput
              type="date"
              value={model.date}
              onChange={(event) => updateFrontmatter({ date: event.target.value })}
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
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
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
          <div className="mb-2 flex flex-wrap gap-1.5">
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
              <span className="text-xs text-muted-foreground">No tags</span>
            )}
          </div>
          {model.suggestedTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {model.suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-primary"
                  onClick={() => addTag(tag)}
                >
                  + {tag}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">Properties</div>
          <div className="space-y-1.5">
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
          </div>
          {!showAddProperty ? (
            <button
              type="button"
              className="mt-2 flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
              onClick={() => setShowAddProperty(true)}
            >
              <PlusIcon size={12} />
              Add property
            </button>
          ) : (
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_86px_minmax(0,1fr)_28px_28px] gap-1.5">
              <CompactInput
                value={newProperty.name}
                placeholder="Property"
                autoFocus
                onChange={(event) =>
                  setNewProperty((current) => ({ ...current, name: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowAddProperty(false);
                  if (event.key === "Enter" && newProperty.name.trim()) addCustomProperty();
                }}
              />
              <OptionPicker
                value={newProperty.type}
                options={propertyTypeOptions}
                placeholder="Type"
                searchPlaceholder="Type..."
                allowCreate={false}
                onChange={(value) => setNewProperty((current) => ({ ...current, type: value }))}
                renderTrigger={(option) => (
                  <span className="inline-flex items-center gap-1">
                    {option?.icon}
                    {option?.label ?? newProperty.type}
                  </span>
                )}
              />
              <PropertyValueEditor
                type={newProperty.type}
                value={newProperty.value}
                statusOptions={statusOptions}
                tagOptions={knownTags}
                onChange={(value) => setNewProperty((current) => ({ ...current, value }))}
              />
              <button
                type="button"
                className="grid h-7 place-items-center rounded-md bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
                disabled={!newProperty.name.trim()}
                onClick={() => {
                  addCustomProperty();
                  setShowAddProperty(false);
                }}
                aria-label="Add property"
              >
                <TickIcon size={13} />
              </button>
              <button
                type="button"
                className="grid h-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowAddProperty(false)}
                aria-label="Cancel property"
              >
                <XIcon size={12} />
              </button>
            </div>
          )}
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">Relationships</div>
          <div className="space-y-2">
            {DEFAULT_RELATIONSHIPS.map((relationshipName) => (
              <div key={relationshipName}>
                <div className="mb-1 text-[11px] text-muted-foreground">{relationshipName}</div>
                {editingRelationship === relationshipName ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_28px] gap-1.5">
                    <OptionPicker
                      value=""
                      options={noteTitleOptions}
                      placeholder="Add note title"
                      searchPlaceholder="Search notes..."
                      onChange={(value) => {
                        addRelationship(relationshipName, value);
                        setEditingRelationship(null);
                      }}
                    />
                    <button
                      type="button"
                      className="grid h-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setEditingRelationship(null)}
                      aria-label="Cancel relationship"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="h-7 w-full rounded-md border border-dashed border-border bg-background px-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    onClick={() => setEditingRelationship(relationshipName)}
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
            {model.relationships.map((relationship, index) => (
              <div
                key={`${relationship.name}-${relationship.note}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate text-muted-foreground">{relationship.name}</span>
                <span className="min-w-0 truncate text-foreground">{relationship.note}</span>
              </div>
            ))}
            <div className="grid grid-cols-[100px_minmax(0,1fr)_28px] gap-1.5">
              <OptionPicker
                value={newRelation.name}
                options={Array.from(
                  new Set([
                    ...DEFAULT_RELATIONSHIPS,
                    ...model.relationships.map((relationship) => relationship.name),
                  ]),
                ).map((name) => ({ value: name, label: name }))}
                placeholder="Relation"
                searchPlaceholder="Relation..."
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
                className="grid h-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                disabled={!newRelation.name.trim() || !newRelation.note.trim()}
                onClick={() => addRelationship(newRelation.name, newRelation.note)}
                aria-label="Add relationship"
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
