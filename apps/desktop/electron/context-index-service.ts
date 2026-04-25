import fs from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";

import type {
  ContextIndexEntry,
  ContextIndexEntryKind,
  ContextIndexStatus,
  ContextIndexValue,
  DirectoryNode,
  SearchResult,
} from "../src/shared/workspace.js";

type FrontmatterValue = ContextIndexValue;

type FrontmatterRecord = {
  [key: string]: FrontmatterValue;
};

type IndexedHeading = {
  level: number;
  text: string;
  line: number;
};

type IndexedLink = {
  kind: "markdown" | "wiki";
  target: string;
  label: string | null;
  line: number;
};

type IndexedBacklink = {
  sourcePath: string;
  sourceRelativePath: string;
  label: string | null;
  line: number;
};

type IndexedNoteRecord = {
  kind: ContextIndexEntryKind;
  path: string;
  name: string;
  relativePath: string;
  content: string;
  frontmatter: FrontmatterRecord;
  frontmatterText: string | null;
  tags: string[];
  headings: IndexedHeading[];
  links: IndexedLink[];
  backlinks: IndexedBacklink[];
  modifiedAt: string;
  size: number;
  indexedAt: string;
};

type PersistedContextIndex = {
  version: 1;
  rootPath: string;
  generatedAt: string;
  notes: IndexedNoteRecord[];
};

type CreateContextIndexServiceOptions = {
  onStatusChanged: (status: ContextIndexStatus) => void;
};

const INDEX_DIRECTORY_NAME = ".glyph";
const INDEX_FILE_NAME = "index.json";
const MARKDOWN_LINK_PATTERN = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const WIKI_LINK_PATTERN = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

function isMarkdownFile(targetPath: string) {
  return /\.(md|mdx|markdown)$/i.test(targetPath);
}

function getIndexedEntryKind(filePath: string): ContextIndexEntryKind {
  const fileName = path.basename(filePath).toLowerCase();

  if (fileName === "agents.md") {
    return "agents";
  }

  if (fileName === "skill.md") {
    return "skill";
  }

  return "note";
}

function toPathKey(targetPath: string) {
  return path.normalize(targetPath).toLowerCase();
}

function toSearchText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toSearchText(entry)).join(" ");
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map((entry) => toSearchText(entry))
      .join(" ");
  }

  return "";
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeFrontmatterValue(value: unknown): FrontmatterValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFrontmatterValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeFrontmatterValue(entry)]),
    );
  }

  return String(value);
}

function parseFrontmatter(frontmatterText: string): FrontmatterRecord {
  try {
    const document = parseDocument(frontmatterText, {
      prettyErrors: false,
      strict: false,
      uniqueKeys: false,
    });
    const value = document.toJSON();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return normalizeFrontmatterValue(value) as FrontmatterRecord;
  } catch {
    return {};
  }
}

function parseMarkdownDocument(content: string) {
  const normalizedContent = content.replace(/\r\n?/g, "\n");

  if (!normalizedContent.startsWith("---\n")) {
    return {
      body: normalizedContent,
      frontmatter: {},
      frontmatterText: null,
      frontmatterLineOffset: 0,
    };
  }

  const lines = normalizedContent.split("\n");
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

  if (endIndex < 0) {
    return {
      body: normalizedContent,
      frontmatter: {},
      frontmatterText: null,
      frontmatterLineOffset: 0,
    };
  }

  const frontmatterText = lines.slice(1, endIndex).join("\n").trim() || null;

  return {
    body: lines.slice(endIndex + 1).join("\n"),
    frontmatter: frontmatterText ? parseFrontmatter(frontmatterText) : {},
    frontmatterText,
    frontmatterLineOffset: endIndex + 1,
  };
}

function normalizeTags(frontmatter: FrontmatterRecord) {
  const values = [frontmatter.tags, frontmatter.tag, frontmatter.keywords].flatMap((entry) => {
    if (Array.isArray(entry)) {
      return entry;
    }

    if (typeof entry === "string") {
      return entry.split(",");
    }

    return [];
  });

  return Array.from(
    new Set(values.map((entry) => String(entry).trim().replace(/^#/, "")).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function extractHeadings(body: string, lineOffset: number): IndexedHeading[] {
  return body
    .split("\n")
    .map((line, index) => {
      const match = line.match(HEADING_PATTERN);
      if (!match) {
        return null;
      }

      return {
        level: match[1].length,
        text: match[2].trim(),
        line: lineOffset + index + 1,
      };
    })
    .filter((heading): heading is IndexedHeading => heading !== null);
}

function extractLinks(body: string, lineOffset: number): IndexedLink[] {
  const links: IndexedLink[] = [];
  const lines = body.split("\n");

  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(MARKDOWN_LINK_PATTERN)) {
      const target = match[2]?.trim();
      if (!target) {
        continue;
      }

      links.push({
        kind: "markdown",
        target,
        label: match[1]?.trim() || null,
        line: lineOffset + index + 1,
      });
    }

    for (const match of line.matchAll(WIKI_LINK_PATTERN)) {
      const target = match[1]?.trim();
      if (!target) {
        continue;
      }

      links.push({
        kind: "wiki",
        target,
        label: match[2]?.trim() || null,
        line: lineOffset + index + 1,
      });
    }
  }

  return links;
}

function collectMarkdownFiles(nodes: DirectoryNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.type === "file") {
      return isMarkdownFile(node.path) ? [node.path] : [];
    }

    return collectMarkdownFiles(node.children);
  });
}

function stripLinkHash(target: string) {
  return target.split("#", 1)[0]?.trim() ?? "";
}

function stripMarkdownExtension(target: string) {
  return target.replace(/\.(md|mdx|markdown)$/i, "");
}

function getRecordLookupKeys(record: IndexedNoteRecord) {
  const relativePath = record.relativePath.toLowerCase();
  const relativePathWithoutExtension = stripMarkdownExtension(relativePath);
  const baseName = stripMarkdownExtension(path.basename(record.name).toLowerCase());

  return [relativePath, relativePathWithoutExtension, baseName];
}

function resolveLinkPath(record: IndexedNoteRecord, target: string) {
  const cleanTarget = stripLinkHash(target);
  if (!cleanTarget || /^[a-z][a-z0-9+.-]*:/i.test(cleanTarget)) {
    return null;
  }

  if (path.isAbsolute(cleanTarget)) {
    return path.normalize(cleanTarget).toLowerCase();
  }

  const sourceDir = path.dirname(record.path);
  return path.normalize(path.resolve(sourceDir, cleanTarget)).toLowerCase();
}

function attachBacklinks(records: Map<string, IndexedNoteRecord>) {
  const exactPathTargets = new Map<string, string>();
  const looseTargets = new Map<string, string>();

  for (const [key, record] of records) {
    exactPathTargets.set(key, key);
    for (const lookupKey of getRecordLookupKeys(record)) {
      looseTargets.set(lookupKey, key);
    }

    records.set(key, {
      ...record,
      backlinks: [],
    });
  }

  for (const sourceRecord of records.values()) {
    for (const link of sourceRecord.links) {
      const resolvedPath =
        link.kind === "markdown" ? resolveLinkPath(sourceRecord, link.target) : null;
      const targetKey =
        (resolvedPath ? exactPathTargets.get(resolvedPath) : null) ??
        looseTargets.get(stripMarkdownExtension(stripLinkHash(link.target).toLowerCase()));

      if (!targetKey || targetKey === toPathKey(sourceRecord.path)) {
        continue;
      }

      const targetRecord = records.get(targetKey);
      if (!targetRecord) {
        continue;
      }

      records.set(targetKey, {
        ...targetRecord,
        backlinks: [
          ...targetRecord.backlinks,
          {
            sourcePath: sourceRecord.path,
            sourceRelativePath: sourceRecord.relativePath,
            label: link.label,
            line: link.line,
          },
        ],
      });
    }
  }
}

function buildSnippet(lineContent: string, query: string) {
  const trimmed = lineContent.trim();
  if (trimmed.length <= 180) {
    return trimmed;
  }

  const index = trimmed.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, index - 60);
  return `${start > 0 ? "..." : ""}${trimmed.slice(start, start + 180)}`;
}

function toContextIndexEntry(record: IndexedNoteRecord): ContextIndexEntry {
  return {
    kind: record.kind,
    path: record.path,
    name: record.name,
    relativePath: record.relativePath,
    frontmatter: record.frontmatter,
    frontmatterText: record.frontmatterText,
    tags: record.tags,
    headings: record.headings,
    links: record.links,
    backlinks: record.backlinks,
    modifiedAt: record.modifiedAt,
    size: record.size,
    indexedAt: record.indexedAt,
  };
}

export function createContextIndexService({ onStatusChanged }: CreateContextIndexServiceOptions) {
  let rootPath: string | null = null;
  let indexPath: string | null = null;
  let records = new Map<string, IndexedNoteRecord>();
  let status: ContextIndexStatus = {
    rootPath: null,
    indexPath: null,
    state: "idle",
    noteCount: 0,
    lastBuiltAt: null,
    errorMessage: null,
  };
  let writePromise: Promise<boolean> | null = null;

  const setStatus = (patch: Partial<ContextIndexStatus>) => {
    status = {
      ...status,
      ...patch,
    };
    onStatusChanged(status);
  };

  const persist = async () => {
    if (!rootPath || !indexPath) {
      return;
    }

    const payload: PersistedContextIndex = {
      version: 1,
      rootPath,
      generatedAt: new Date().toISOString(),
      notes: Array.from(records.values()).sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath),
      ),
    };

    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  };

  const queuePersist = () => {
    writePromise = (writePromise ?? Promise.resolve())
      .then(async () => {
        await persist();
        return true;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to persist context index.";
        setStatus({ state: "error", errorMessage: message });
        return false;
      })
      .finally(() => {
        writePromise = null;
      });

    return writePromise as Promise<boolean>;
  };

  const indexFile = async (filePath: string) => {
    if (!rootPath) {
      return null;
    }

    const normalizedPath = path.normalize(filePath);
    const [content, stats] = await Promise.all([
      fs.readFile(normalizedPath, "utf8"),
      fs.stat(normalizedPath),
    ]);
    const parsed = parseMarkdownDocument(content);
    const normalizedContent = content.replace(/\r\n?/g, "\n");

    return {
      kind: getIndexedEntryKind(normalizedPath),
      path: normalizedPath,
      name: path.basename(normalizedPath),
      relativePath: path.relative(rootPath, normalizedPath).replace(/\\/g, "/"),
      content: normalizedContent,
      frontmatter: parsed.frontmatter,
      frontmatterText: parsed.frontmatterText,
      tags: normalizeTags(parsed.frontmatter),
      headings: extractHeadings(parsed.body, parsed.frontmatterLineOffset),
      links: extractLinks(parsed.body, parsed.frontmatterLineOffset),
      backlinks: [],
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      indexedAt: new Date().toISOString(),
    } satisfies IndexedNoteRecord;
  };

  const rebuild = async (nextRootPath: string, tree: DirectoryNode[]) => {
    rootPath = path.normalize(nextRootPath);
    indexPath = path.join(rootPath, INDEX_DIRECTORY_NAME, INDEX_FILE_NAME);
    setStatus({
      rootPath,
      indexPath,
      state: "building",
      noteCount: records.size,
      errorMessage: null,
    });

    try {
      const nextRecords = new Map<string, IndexedNoteRecord>();
      const filePaths = collectMarkdownFiles(tree);
      const indexedRecords = await Promise.all(
        filePaths.map(async (filePath) => {
          try {
            return await indexFile(filePath);
          } catch {
            return null;
          }
        }),
      );

      for (const record of indexedRecords) {
        if (!record) {
          continue;
        }

        nextRecords.set(toPathKey(record.path), record);
      }

      records = nextRecords;
      attachBacklinks(records);
      const didPersist = await queuePersist();
      if (!didPersist) {
        return;
      }

      setStatus({
        state: "ready",
        noteCount: records.size,
        lastBuiltAt: new Date().toISOString(),
        errorMessage: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to build context index.";
      setStatus({ state: "error", errorMessage: message });
    }
  };

  const refresh = async (changedPaths: string[]) => {
    if (!rootPath || changedPaths.length === 0) {
      return;
    }

    setStatus({ state: "building", errorMessage: null });

    for (const changedPath of changedPaths) {
      const normalizedPath = path.normalize(changedPath);
      const key = toPathKey(normalizedPath);

      try {
        const stats = await fs.stat(normalizedPath);
        if (!stats.isFile()) {
          records.delete(key);
          continue;
        }

        const record = await indexFile(normalizedPath);
        if (record) {
          records.set(key, record);
        }
      } catch {
        records.delete(key);
      }
    }

    attachBacklinks(records);
    const didPersist = await queuePersist();
    if (!didPersist) {
      return;
    }

    setStatus({
      state: "ready",
      noteCount: records.size,
      lastBuiltAt: new Date().toISOString(),
      errorMessage: null,
    });
  };

  const search = (query: string): SearchResult[] => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return [];
    }

    const terms = normalizedQuery.split(" ").filter(Boolean);
    const results: Array<SearchResult & { score: number }> = [];

    for (const record of records.values()) {
      if (results.length >= 100) {
        break;
      }

      const metadataText = normalizeSearchText(
        [
          record.name,
          record.relativePath,
          record.tags.join(" "),
          record.headings.map((heading) => heading.text).join(" "),
          toSearchText(record.frontmatter),
        ].join(" "),
      );
      const fullText = normalizeSearchText(`${metadataText} ${record.content}`);

      if (!terms.every((term) => fullText.includes(term))) {
        continue;
      }

      const lines = record.content.split("\n");
      const matchingLineIndex = lines.findIndex((line) =>
        terms.every((term) => normalizeSearchText(line).includes(term)),
      );
      const fallbackHeading = record.headings.find((heading) =>
        terms.some((term) => normalizeSearchText(heading.text).includes(term)),
      );
      const line = matchingLineIndex >= 0 ? matchingLineIndex + 1 : (fallbackHeading?.line ?? 1);
      const lineContent =
        matchingLineIndex >= 0
          ? lines[matchingLineIndex]
          : (fallbackHeading?.text ?? record.relativePath);
      let score = 0;

      if (normalizeSearchText(record.name).includes(normalizedQuery)) {
        score += 80;
      }
      if (metadataText.includes(normalizedQuery)) {
        score += 60;
      }
      if (matchingLineIndex >= 0) {
        score += 20;
      }

      results.push({
        path: record.path,
        name: record.name,
        line,
        snippet: buildSnippet(lineContent, query),
        score,
      });
    }

    return results
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
      .slice(0, 50)
      .map(({ score: _score, ...result }) => result);
  };

  return {
    getEntry: (filePath: string) => {
      const record = records.get(toPathKey(filePath));
      return record ? toContextIndexEntry(record) : null;
    },
    getStatus: () => status,
    rebuild,
    refresh,
    search,
  };
}
