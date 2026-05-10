import { useMemo } from "react";
import type { ReactNode } from "react";
import { parseDocument } from "yaml";

import { parseMarkdownFrontmatter } from "@/core/frontmatter";
import { getBaseName, getDirName, getRelativePath } from "@/core/paths";
import type { FileDocument } from "@/core/workspace";
import type { OutlineItem } from "@/types/navigation";

import {
  CalendarIcon,
  DiscountTagIcon,
  FileIcon,
  LinkIcon,
  OutlineIcon,
  SparklesIcon,
  XIcon,
} from "./icons";

type NoteContextSidebarProps = {
  activeFile: FileDocument;
  draftContent: string;
  rootPath: string | null;
  outlineItems: OutlineItem[];
  wordCount: number;
  readingTime: number;
  onClose: () => void;
  onJumpToHeading: (id: string) => void;
};

type ContextLink = {
  label: string;
  target: string;
};

const MARKDOWN_LINK_PATTERN = /!?\[([^\]\n]+)\]\(([^)\n]+)\)/g;
const WIKI_LINK_PATTERN = /!?\[\[([^\]\n]+)\]\]/g;
const INLINE_TAG_PATTERN = /(^|[\s([{])#([A-Za-z0-9][A-Za-z0-9_/-]*)\b/g;

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

function getMetadataString(frontmatter: Record<string, unknown>, key: string) {
  const value = frontmatter[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function getFrontmatterTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(getFrontmatterTags);
  }

  if (typeof value === "string") {
    return value.split(/[,\s]+/).map(normalizeTag).filter(Boolean);
  }

  return [];
}

function collectInlineTags(body: string) {
  const tags = new Set<string>();

  for (const line of body.split("\n")) {
    INLINE_TAG_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(INLINE_TAG_PATTERN)) {
      const tag = normalizeTag(match[2] ?? "");
      if (tag) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags);
}

function collectLinks(body: string) {
  const links: ContextLink[] = [];

  for (const line of body.split("\n")) {
    MARKDOWN_LINK_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(MARKDOWN_LINK_PATTERN)) {
      const target = (match[2] ?? "").trim();
      if (target) {
        links.push({ label: (match[1] ?? target).trim(), target });
      }
    }

    WIKI_LINK_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(WIKI_LINK_PATTERN)) {
      const rawTarget = (match[1] ?? "").trim();
      const [target, alias] = rawTarget.split("|").map((part) => part.trim());
      if (target) {
        links.push({ label: alias || target, target });
      }
    }
  }

  return links.slice(0, 12);
}

function truncateMiddle(value: string, maxLength = 34) {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.ceil((maxLength - 1) / 2);
  const tailLength = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
}

function PropertyRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid min-h-7 grid-cols-[18px_72px_minmax(0,1fr)] items-center gap-2 text-xs">
      <span className="text-muted-foreground/75">{icon}</span>
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{value}</span>
    </div>
  );
}

export function NoteContextSidebar({
  activeFile,
  draftContent,
  rootPath,
  outlineItems,
  wordCount,
  readingTime,
  onClose,
  onJumpToHeading,
}: NoteContextSidebarProps) {
  const context = useMemo(() => {
    const parsed = parseMarkdownFrontmatter(draftContent);
    const frontmatter = getFrontmatterRecord(parsed.frontmatterText);
    const frontmatterTags = [
      ...getFrontmatterTags(frontmatter.tags),
      ...getFrontmatterTags(frontmatter.tag),
      ...getFrontmatterTags(frontmatter.keywords),
    ];
    const tags = Array.from(new Set([...frontmatterTags, ...collectInlineTags(parsed.body)]));
    const links = collectLinks(parsed.body);
    const type = getMetadataString(frontmatter, "type") ?? "Note";
    const status = getMetadataString(frontmatter, "status") ?? "Evergreen";
    const date =
      getMetadataString(frontmatter, "date") ??
      getMetadataString(frontmatter, "created") ??
      getMetadataString(frontmatter, "updated") ??
      null;
    const noteId =
      getMetadataString(frontmatter, "id") ??
      getMetadataString(frontmatter, "note_id") ??
      activeFile.path;
    const sourceUrl =
      getMetadataString(frontmatter, "url") ?? getMetadataString(frontmatter, "source");

    return {
      date,
      links,
      noteId,
      sourceUrl,
      status,
      tags,
      type,
    };
  }, [activeFile.path, draftContent]);

  const folderName = getBaseName(getDirName(activeFile.path));
  const relativePath = getRelativePath(activeFile.path, rootPath);
  const topHeadings = outlineItems.slice(0, 10);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <SparklesIcon size={14} className="text-primary" />
          <span className="truncate text-xs font-semibold text-foreground">Context</span>
        </div>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close context sidebar"
          onClick={onClose}
        >
          <XIcon size={14} />
        </button>
      </header>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <section className="space-y-2">
          <PropertyRow
            icon={<FileIcon size={13} />}
            label="Type"
            value={
              <span className="inline-flex max-w-full items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {context.type}
              </span>
            }
          />
          <PropertyRow
            icon={<span className="block h-2.5 w-2.5 rounded-full border border-muted-foreground/70" />}
            label="Status"
            value={
              <span className="inline-flex max-w-full items-center rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                {context.status}
              </span>
            }
          />
          <PropertyRow
            icon={<CalendarIcon size={13} />}
            label="Date"
            value={<span className="text-muted-foreground">{context.date ?? "-"}</span>}
          />
          <PropertyRow
            icon={<span className="font-mono text-[10px]">T</span>}
            label="Note ID"
            value={
              <span title={context.noteId} className="block truncate text-muted-foreground">
                {truncateMiddle(context.noteId)}
              </span>
            }
          />
          <PropertyRow
            icon={<LinkIcon size={13} />}
            label="URL"
            value={
              <span
                title={context.sourceUrl ?? undefined}
                className="block truncate text-muted-foreground"
              >
                {context.sourceUrl ? truncateMiddle(context.sourceUrl) : "-"}
              </span>
            }
          />
          <PropertyRow
            icon={<OutlineIcon size={13} />}
            label="Stats"
            value={
              <span className="text-muted-foreground">
                {wordCount.toLocaleString()} words / {readingTime} min read
              </span>
            }
          />
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">Belongs to</div>
          <div className="rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
            {folderName || "Workspace"}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground" title={relativePath}>
            {relativePath}
          </div>
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Has Notes</span>
            <span className="text-[10px] text-muted-foreground">{context.links.length}</span>
          </div>
          <div className="space-y-1.5">
            {context.links.length > 0 ? (
              context.links.map((link, index) => (
                <div
                  key={`${link.target}-${index}`}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary"
                  title={link.target}
                >
                  <span className="truncate">{link.label}</span>
                  <LinkIcon size={11} className="shrink-0 opacity-70" />
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
                No linked notes yet
              </div>
            )}
          </div>
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Outline</span>
            <span className="text-[10px] text-muted-foreground">{outlineItems.length}</span>
          </div>
          <div className="space-y-1">
            {topHeadings.length > 0 ? (
              topHeadings.map((heading) => (
                <button
                  key={heading.id}
                  type="button"
                  className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                  onClick={() => onJumpToHeading(heading.id)}
                >
                  <span className="w-5 shrink-0 text-[10px] font-semibold text-muted-foreground">
                    H{heading.depth}
                  </span>
                  <span className="truncate">{heading.title}</span>
                </button>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
                Add headings to grow structure
              </div>
            )}
          </div>
        </section>

        <div className="my-4 h-px bg-border/70" />

        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <DiscountTagIcon size={12} />
            Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {context.tags.length > 0 ? (
              context.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  #{tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No tags</span>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
