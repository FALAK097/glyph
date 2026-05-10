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
  HomeIcon,
  IdeaIcon,
  LeafIcon,
  LinkIcon,
  PlusIcon,
  RocketIcon,
  SparklesIcon,
  XIcon,
} from "./icons";

type NoteContextSidebarProps = {
  activeFile: FileDocument;
  draftContent: string;
  rootPath: string | null;
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
    <div className="grid min-h-8 grid-cols-[18px_72px_minmax(0,1fr)] items-center gap-2 text-xs">
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

function CompactSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-7 w-full rounded-md border border-transparent bg-muted/70 px-2 text-xs text-foreground outline-none transition-colors focus:border-primary/40 focus:bg-background ${props.className ?? ""}`}
    />
  );
}

export function NoteContextSidebar({
  activeFile,
  draftContent,
  rootPath: _rootPath,
  onClose,
  onUpdateContent,
}: NoteContextSidebarProps) {
  const [newTag, setNewTag] = useState("");
  const [newProperty, setNewProperty] = useState({ name: "", type: "Text", value: "" });
  const [newRelation, setNewRelation] = useState({ name: "Related to", note: "" });

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
  const statusTone = STATUS_TONE[model.status.toLowerCase()] ?? "bg-muted text-foreground";
  const knownTypes = Array.from(new Set([...DEFAULT_TYPES, model.type])).filter(Boolean);
  const knownStatuses = Array.from(new Set([...DEFAULT_STATUSES, model.status])).filter(Boolean);
  const knownTags = Array.from(new Set([...model.tags, ...model.suggestedTags])).sort();

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
    setNewTag("");
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
            <input
              list="glyph-note-types"
              value={model.type}
              onChange={(event) => updateFrontmatter({ type: event.target.value })}
              className="h-7 w-full rounded-md border border-transparent bg-muted/70 px-2 text-xs text-primary outline-none focus:border-primary/40 focus:bg-background"
            />
            <datalist id="glyph-note-types">
              {knownTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </FieldRow>

          <FieldRow
            icon={<span className="block h-2.5 w-2.5 rounded-full border border-muted-foreground/70" />}
            label="Status"
          >
            <input
              list="glyph-note-statuses"
              value={model.status}
              onChange={(event) => updateFrontmatter({ status: event.target.value })}
              className={`h-7 w-full rounded-md border border-transparent px-2 text-xs outline-none focus:border-primary/40 ${statusTone}`}
            />
            <datalist id="glyph-note-statuses">
              {knownStatuses.map((status) => (
                <option key={status} value={status} />
              ))}
            </datalist>
          </FieldRow>

          <FieldRow icon={<SparklesIcon size={13} />} label="Icon">
            <CompactSelect
              value={model.icon}
              onChange={(event) => updateFrontmatter({ icon: event.target.value })}
            >
              {ICON_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </CompactSelect>
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
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-primary"
              aria-label="Add tag"
              onClick={() => addTag(newTag || model.suggestedTags[0] || "")}
            >
              <PlusIcon size={13} />
            </button>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {model.tags.length > 0 ? (
              model.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
                  onClick={() =>
                    updateFrontmatter({ tags: model.tags.filter((current) => current !== tag) })
                  }
                >
                  #{tag}
                </button>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No tags</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <input
              list="glyph-note-tags"
              value={newTag}
              placeholder="Add tag"
              onChange={(event) => setNewTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addTag(newTag);
              }}
              className="h-7 min-w-0 flex-1 rounded-md border border-dashed border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
            />
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-primary"
              onClick={() => addTag(newTag)}
              aria-label="Save tag"
            >
              <PlusIcon size={13} />
            </button>
            <datalist id="glyph-note-tags">
              {knownTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
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
              <FieldRow key={`${property.name}-${index}`} icon={<span>T</span>} label={property.name}>
                <CompactInput
                  value={property.value}
                  onChange={(event) => {
                    const nextProperties = model.customProperties.map((entry, propertyIndex) =>
                      propertyIndex === index ? { ...entry, value: event.target.value } : entry,
                    );
                    updateFrontmatter({ properties: nextProperties });
                  }}
                />
              </FieldRow>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_86px_minmax(0,1fr)_28px] gap-1.5">
            <CompactInput
              value={newProperty.name}
              placeholder="Property"
              onChange={(event) => setNewProperty((current) => ({ ...current, name: event.target.value }))}
            />
            <CompactSelect
              value={newProperty.type}
              onChange={(event) => setNewProperty((current) => ({ ...current, type: event.target.value }))}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </CompactSelect>
            <CompactInput
              value={newProperty.value}
              placeholder="Value"
              onChange={(event) => setNewProperty((current) => ({ ...current, value: event.target.value }))}
            />
            <button
              type="button"
              className="grid h-7 place-items-center rounded-md bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
              disabled={!newProperty.name.trim()}
              onClick={addCustomProperty}
              aria-label="Add property"
            >
              <PlusIcon size={13} />
            </button>
          </div>
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">Relationships</div>
          <div className="space-y-2">
            {DEFAULT_RELATIONSHIPS.map((relationshipName) => (
              <div key={relationshipName}>
                <div className="mb-1 text-[11px] text-muted-foreground">{relationshipName}</div>
                <CompactInput
                  list="glyph-note-relationships"
                  placeholder="Add note title"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addRelationship(relationshipName, event.currentTarget.value);
                      event.currentTarget.value = "";
                    }
                  }}
                />
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
              <CompactInput
                list="glyph-relationship-names"
                value={newRelation.name}
                placeholder="Relationship"
                onChange={(event) => setNewRelation((current) => ({ ...current, name: event.target.value }))}
              />
              <CompactInput
                list="glyph-note-relationships"
                value={newRelation.note}
                placeholder="Note title"
                onChange={(event) => setNewRelation((current) => ({ ...current, note: event.target.value }))}
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
          <datalist id="glyph-relationship-names">
            {[...DEFAULT_RELATIONSHIPS, ...model.relationships.map((relationship) => relationship.name)].map(
              (name) => (
                <option key={name} value={name} />
              ),
            )}
          </datalist>
          <datalist id="glyph-note-relationships">
            <option value={title} />
            <option value={folderName} />
          </datalist>
        </section>
      </div>
    </aside>
  );
}
