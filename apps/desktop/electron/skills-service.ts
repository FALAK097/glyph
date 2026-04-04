import { app } from "electron";
import { watch } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";

import {
  AGENTS_FILE_NAME,
  SKILL_FILE_NAME,
  getSkillMetadataString,
  parseSkillDocument,
  type SkillDocument,
  type SkillDocumentKind,
  type SkillEntry,
  type SkillLibraryChangeEvent,
  type SkillLibrarySnapshot,
  type SkillSource,
  type SkillSourceKind,
  type SkillToolKind,
} from "../src/shared/skills.js";
import {
  SKILL_AGENT_CATALOG,
  SKILL_SOURCE_CATALOG,
  type SkillSourceRootTemplate,
} from "../src/shared/skill-agent-catalog.js";

type ResolvedSkillSourceDefinition = {
  id: string;
  kind: SkillSourceKind;
  name: string;
  rootPath: string;
  description: string;
  isReadOnly: boolean;
  maxDepth: number;
};

type CreateSkillsServiceOptions = {
  projectRoot: string | null;
  onLibraryChanged: (event: SkillLibraryChangeEvent) => void;
};

type SkillSearchRecord = {
  combinedText: string;
  description: string;
  id: string;
  name: string;
  slug: string;
  sourceName: string;
  tags: string[];
};

type IndexedSkillEntry = {
  entry: SkillEntry;
  searchRecord: SkillSearchRecord;
};

const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".svn",
  "dist",
  "dist-electron",
  "node_modules",
  "release",
]);

const WATCH_DEBOUNCE_MS = 180;

function toPathKey(targetPath: string) {
  return path.normalize(targetPath).toLowerCase();
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenizeSearchQuery(query: string) {
  return normalizeSearchText(query)
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean);
}

async function directoryExists(targetPath: string) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(targetPath: string) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function getCompatibleToolKinds(sourceKind: SkillSourceKind): SkillToolKind[] {
  if (sourceKind === "agents" || sourceKind === "project") {
    return SKILL_AGENT_CATALOG.filter((entry) => entry.supportsUniversalScope).map(
      (entry) => entry.kind,
    );
  }

  return [sourceKind as SkillToolKind];
}

function getSourceDefinitions(projectRoot: string | null): ResolvedSkillSourceDefinition[] {
  const resolveRootPath = (template: SkillSourceRootTemplate) => {
    if (template.base === "project" && !projectRoot) {
      return null;
    }

    const basePath = template.base === "home" ? app.getPath("home") : projectRoot;
    return basePath ? path.join(basePath, ...template.segments) : null;
  };

  return SKILL_SOURCE_CATALOG.flatMap((entry) => {
    const rootPath = resolveRootPath(entry.root);
    if (!rootPath) {
      return [];
    }

    return [
      {
        id: entry.id,
        kind: entry.kind,
        name: entry.name,
        rootPath,
        description: entry.description,
        isReadOnly: entry.isReadOnly,
        maxDepth: entry.maxDepth,
      },
    ];
  });
}

async function collectSkillFiles(
  targetPath: string,
  maxDepth: number,
  depth = 0,
): Promise<string[]> {
  if (depth > maxDepth) {
    return [];
  }

  let entries: Array<{
    name: string;
    isDirectory: () => boolean;
    isFile: () => boolean;
    isSymbolicLink: () => boolean;
  }>;

  try {
    entries = await fs.readdir(targetPath, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch {
    return [];
  }

  const skillFileEntry = entries.find(
    (entry) => entry.isFile() && entry.name.toLowerCase() === SKILL_FILE_NAME.toLowerCase(),
  );

  if (skillFileEntry) {
    return [path.join(targetPath, skillFileEntry.name)];
  }

  const directories = (
    await Promise.all(
      entries.map(async (entry) => {
        if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          return null;
        }

        if (entry.isDirectory()) {
          return entry;
        }

        if (!entry.isSymbolicLink()) {
          return null;
        }

        try {
          const resolvedStats = await fs.stat(path.join(targetPath, entry.name));
          return resolvedStats.isDirectory() ? entry : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((entry): entry is (typeof entries)[number] => entry !== null);

  const nestedResults = await Promise.all(
    directories.map((directory) =>
      collectSkillFiles(path.join(targetPath, directory.name), maxDepth, depth + 1),
    ),
  );

  return nestedResults.flat();
}

function toSlug(skillFilePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, path.dirname(skillFilePath));
  return relativePath.split(path.sep).join("/");
}

function buildSkillSearchText({
  body,
  description,
  frontmatterText,
  name,
  slug,
  sourceName,
  tags,
}: {
  body: string;
  description: string | null;
  frontmatterText: string | null;
  name: string;
  slug: string;
  sourceName: string;
  tags: string[];
}) {
  return [name, description ?? "", slug, sourceName, tags.join(" "), frontmatterText ?? "", body]
    .join("\n")
    .toLowerCase();
}

function getSkillSearchScore(
  record: SkillSearchRecord,
  queryTerms: string[],
  normalizedQuery: string,
) {
  if (queryTerms.length === 0) {
    return -1;
  }

  if (!queryTerms.every((term) => record.combinedText.includes(term))) {
    return -1;
  }

  let score = 0;

  if (record.name === normalizedQuery) {
    score += 240;
  } else if (record.name.startsWith(normalizedQuery)) {
    score += 180;
  } else if (record.name.includes(normalizedQuery)) {
    score += 120;
  }

  if (record.slug.startsWith(normalizedQuery)) {
    score += 100;
  } else if (record.slug.includes(normalizedQuery)) {
    score += 60;
  }

  if (record.tags.some((tag) => tag === normalizedQuery)) {
    score += 80;
  } else if (record.tags.some((tag) => tag.includes(normalizedQuery))) {
    score += 40;
  }

  if (record.description.includes(normalizedQuery)) {
    score += 30;
  }

  if (record.sourceName.includes(normalizedQuery)) {
    score += 20;
  }

  return score;
}

async function buildSkillEntry(
  source: ResolvedSkillSourceDefinition,
  skillFilePath: string,
): Promise<IndexedSkillEntry | null> {
  try {
    const skillStats = await fs.stat(skillFilePath);
    const content = (await fs.readFile(skillFilePath, "utf8")).replace(/\r\n?/g, "\n");
    const parsed = parseSkillDocument(content);
    const directoryPath = path.dirname(skillFilePath);
    const resolvedDirectoryPath = await fs.realpath(directoryPath).catch(() => directoryPath);
    const agentsFilePath = path.join(directoryPath, AGENTS_FILE_NAME);
    const hasAgentsFile = await fileExists(agentsFilePath);
    let readableAgentsFilePath: string | null = null;
    let agentsContent = "";

    if (hasAgentsFile) {
      try {
        agentsContent = (await fs.readFile(agentsFilePath, "utf8")).replace(/\r\n?/g, "\n");
        readableAgentsFilePath = agentsFilePath;
      } catch {
        // Keep optional sidecars from dropping the whole skill entry.
      }
    }

    const slug = toSlug(skillFilePath, source.rootPath);
    const name = parsed.title ?? path.basename(directoryPath);
    const description = parsed.description;
    const entry: SkillEntry = {
      id: `${source.id}:${slug}`,
      slug,
      name,
      description,
      version: getSkillMetadataString(parsed.frontmatter, ["version"], ["metadata", "version"]),
      tags: parsed.tags,
      sourceId: source.id,
      sourceName: source.name,
      sourceKind: source.kind,
      compatibleToolKinds: getCompatibleToolKinds(source.kind),
      sourceRootPath: source.rootPath,
      directoryPath,
      resolvedDirectoryPath,
      skillFilePath,
      agentsFilePath: readableAgentsFilePath,
      isReadOnly: source.isReadOnly,
      hasAgentsFile: readableAgentsFilePath !== null,
      hasScripts: await directoryExists(path.join(directoryPath, "scripts")),
      hasAssets: await directoryExists(path.join(directoryPath, "assets")),
      hasReferences: await directoryExists(path.join(directoryPath, "references")),
      hasRules: await directoryExists(path.join(directoryPath, "rules")),
      hasExamples: await directoryExists(path.join(directoryPath, "examples")),
      lastModifiedAt: skillStats.mtime.toISOString(),
      frontmatter: parsed.frontmatter,
    };

    return {
      entry,
      searchRecord: {
        id: entry.id,
        combinedText: normalizeSearchText(
          buildSkillSearchText({
            description,
            frontmatterText: parsed.frontmatterText,
            name,
            slug,
            sourceName: source.name,
            tags: parsed.tags,
            body: `${parsed.body}\n${agentsContent}`.trim(),
          }),
        ),
        description: normalizeSearchText(description ?? ""),
        name: normalizeSearchText(name),
        slug: normalizeSearchText(slug),
        sourceName: normalizeSearchText(source.name),
        tags: parsed.tags.map((tag) => normalizeSearchText(tag)).filter(Boolean),
      },
    };
  } catch {
    return null;
  }
}

function sortSkills(left: SkillEntry, right: SkillEntry) {
  if (left.sourceName !== right.sourceName) {
    return left.sourceName.localeCompare(right.sourceName);
  }

  return left.name.localeCompare(right.name);
}

function findEntryForPath(snapshot: SkillLibrarySnapshot, targetPath: string) {
  const pathKey = toPathKey(targetPath);

  return snapshot.skills.find(
    (entry) =>
      toPathKey(entry.skillFilePath) === pathKey ||
      (entry.agentsFilePath !== null && toPathKey(entry.agentsFilePath) === pathKey),
  );
}

async function preserveLineEndings(filePath: string, content: string) {
  try {
    const existingContent = await fs.readFile(filePath, "utf8");
    if (existingContent.includes("\r\n")) {
      return content.replace(/\r?\n/g, "\r\n");
    }
  } catch {
    // Fall back to normalized content when the current file cannot be read.
  }

  return content;
}

export function createSkillsService({ projectRoot, onLibraryChanged }: CreateSkillsServiceOptions) {
  let activeProjectRoot = projectRoot;
  let snapshot: SkillLibrarySnapshot = {
    sources: [],
    skills: [],
    scannedAt: new Date(0).toISOString(),
  };
  let refreshPromise: Promise<SkillLibrarySnapshot> | null = null;
  let needsRefreshAfterCurrent = false;
  let queuedRefreshChangedPaths = new Set<string>();
  let scheduledRefresh: NodeJS.Timeout | null = null;
  let pendingChangedPaths = new Set<string>();
  let searchIndex = new Map<string, SkillSearchRecord>();
  const watchers = new Map<string, ReturnType<typeof watch>>();

  const refresh = async (changedPaths?: string[]) => {
    if (refreshPromise) {
      needsRefreshAfterCurrent = true;
      changedPaths?.forEach((changedPath) => {
        queuedRefreshChangedPaths.add(path.normalize(changedPath));
      });
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const sourceDefinitions = getSourceDefinitions(activeProjectRoot);
      const availableSources = await Promise.all(
        sourceDefinitions.map(async (source) => ({
          source,
          exists: await directoryExists(source.rootPath),
        })),
      );

      const activeSources = availableSources
        .filter((entry) => entry.exists)
        .map((entry) => entry.source);

      const skillGroups = await Promise.all(
        activeSources.map(async (source) => {
          const files = await collectSkillFiles(source.rootPath, source.maxDepth);
          const entries = await Promise.all(
            files.map((skillFilePath) => buildSkillEntry(source, skillFilePath)),
          );

          const indexedEntries = entries.filter(
            (entry): entry is IndexedSkillEntry => entry !== null,
          );

          return {
            source,
            searchIndex: new Map(
              indexedEntries.map((entry) => [entry.entry.id, entry.searchRecord] as const),
            ),
            skills: indexedEntries.map((entry) => entry.entry).sort(sortSkills),
          };
        }),
      );

      const nextSources: SkillSource[] = skillGroups.map(({ source, skills }) => ({
        id: source.id,
        kind: source.kind,
        name: source.name,
        rootPath: source.rootPath,
        description: source.description,
        isReadOnly: source.isReadOnly,
        skillCount: skills.length,
      }));
      const nextSnapshot: SkillLibrarySnapshot = {
        sources: sourceDefinitions.map((source) => ({
          id: source.id,
          kind: source.kind,
          name: source.name,
          rootPath: source.rootPath,
          description: source.description,
          isReadOnly: source.isReadOnly,
          skillCount: nextSources.find((entry) => entry.id === source.id)?.skillCount ?? 0,
        })),
        skills: skillGroups.flatMap((group) => group.skills),
        scannedAt: new Date().toISOString(),
      };
      const nextSearchIndex = new Map<string, SkillSearchRecord>();

      for (const group of skillGroups) {
        for (const [skillId, searchRecord] of group.searchIndex.entries()) {
          nextSearchIndex.set(skillId, searchRecord);
        }
      }

      for (const [rootPath, watcher] of watchers.entries()) {
        if (nextSources.some((source) => toPathKey(source.rootPath) === rootPath)) {
          continue;
        }

        void watcher.close();
        watchers.delete(rootPath);
      }

      for (const source of activeSources) {
        const sourceKey = toPathKey(source.rootPath);

        if (watchers.has(sourceKey)) {
          continue;
        }

        const watcher = watch(source.rootPath, {
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 150,
            pollInterval: 50,
          },
          depth: source.maxDepth,
        });

        watcher.on("all", (_eventName, changedPath) => {
          pendingChangedPaths.add(path.normalize(changedPath));

          if (scheduledRefresh) {
            clearTimeout(scheduledRefresh);
          }

          scheduledRefresh = setTimeout(() => {
            const nextChangedPaths = Array.from(pendingChangedPaths);
            pendingChangedPaths = new Set<string>();
            scheduledRefresh = null;
            void refresh(nextChangedPaths);
          }, WATCH_DEBOUNCE_MS);
        });

        watchers.set(sourceKey, watcher);
      }

      snapshot = nextSnapshot;
      searchIndex = nextSearchIndex;

      if (changedPaths && changedPaths.length > 0) {
        onLibraryChanged({
          snapshot: nextSnapshot,
          changedPaths: Array.from(new Set(changedPaths.map((entry) => path.normalize(entry)))),
        });
      }

      return nextSnapshot;
    })().finally(() => {
      refreshPromise = null;

      if (!needsRefreshAfterCurrent) {
        return;
      }

      const nextChangedPaths =
        queuedRefreshChangedPaths.size > 0 ? Array.from(queuedRefreshChangedPaths) : undefined;
      needsRefreshAfterCurrent = false;
      queuedRefreshChangedPaths = new Set<string>();
      void refresh(nextChangedPaths);
    });

    return refreshPromise;
  };

  const getSnapshot = async () => {
    if (snapshot.sources.length === 0 && snapshot.skills.length === 0) {
      return refresh();
    }

    return snapshot;
  };

  const readDocument = async (filePath: string): Promise<SkillDocument> => {
    const currentSnapshot = await getSnapshot();
    const entry = findEntryForPath(currentSnapshot, filePath);

    if (!entry) {
      throw new Error("Skill document is not part of the discovered library.");
    }

    const content = (await fs.readFile(filePath, "utf8")).replace(/\r\n?/g, "\n");
    const stats = await fs.stat(filePath);
    const documentKind: SkillDocumentKind =
      path.basename(filePath).toUpperCase() === AGENTS_FILE_NAME.toUpperCase() ? "agents" : "skill";

    return {
      kind: documentKind,
      path: filePath,
      name: path.basename(filePath),
      content,
      isEditable: !entry.isReadOnly,
      lastModifiedAt: stats.mtime.toISOString(),
    };
  };

  const saveDocument = async (filePath: string, content: string): Promise<SkillDocument> => {
    const currentSnapshot = await getSnapshot();
    const entry = findEntryForPath(currentSnapshot, filePath);

    if (!entry) {
      throw new Error("Skill document is not part of the discovered library.");
    }

    if (entry.isReadOnly) {
      throw new Error("This skill is read-only.");
    }

    const normalizedContent = await preserveLineEndings(filePath, content);
    await fs.writeFile(filePath, normalizedContent, "utf8");
    await refresh([filePath]);
    return readDocument(filePath);
  };

  const search = async (query: string) => {
    const currentSnapshot = await getSnapshot();
    const normalizedQuery = normalizeSearchText(query);
    const queryTerms = tokenizeSearchQuery(query);

    if (!normalizedQuery || queryTerms.length === 0) {
      return [];
    }

    return currentSnapshot.skills
      .map((skill, index) => {
        const record = searchIndex.get(skill.id);
        if (!record) {
          return null;
        }

        const score = getSkillSearchScore(record, queryTerms, normalizedQuery);
        if (score < 0) {
          return null;
        }

        return { id: skill.id, index, score };
      })
      .filter((entry): entry is { id: string; index: number; score: number } => entry !== null)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      })
      .map((entry) => entry.id);
  };

  const dispose = async () => {
    if (scheduledRefresh) {
      clearTimeout(scheduledRefresh);
      scheduledRefresh = null;
    }

    await Promise.all(Array.from(watchers.values()).map((watcher) => watcher.close()));
    watchers.clear();
  };

  const setProjectRoot = async (nextProjectRoot: string | null) => {
    const normalizedCurrent = activeProjectRoot ? path.normalize(activeProjectRoot) : null;
    const normalizedNext = nextProjectRoot ? path.normalize(nextProjectRoot) : null;
    const currentKey = normalizedCurrent ? toPathKey(normalizedCurrent) : null;
    const nextKey = normalizedNext ? toPathKey(normalizedNext) : null;

    if (currentKey === nextKey) {
      return snapshot;
    }

    activeProjectRoot = normalizedNext;
    return refresh();
  };

  return {
    dispose,
    getSnapshot,
    readDocument,
    refresh,
    saveDocument,
    search,
    setProjectRoot,
  };
}
