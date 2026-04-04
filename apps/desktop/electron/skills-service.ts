import { app } from "electron";
import { watch } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";

import {
  AGENTS_FILE_NAME,
  SKILL_FILE_NAME,
  parseSkillDocument,
  type SkillDocument,
  type SkillDocumentKind,
  type SkillEntry,
  type SkillLibraryChangeEvent,
  type SkillLibrarySnapshot,
  type SkillSource,
  type SkillSourceKind,
} from "../src/shared/skills.js";

type SourceDefinition = {
  id: string;
  kind: SkillSourceKind;
  name: string;
  rootPath: string;
  description: string | null;
  isReadOnly: boolean;
  maxDepth: number;
};

type CreateSkillsServiceOptions = {
  projectRoot: string;
  onLibraryChanged: (event: SkillLibraryChangeEvent) => void;
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

function getSourceDefinitions(projectRoot: string): SourceDefinition[] {
  const homePath = app.getPath("home");

  return [
    {
      id: "codex-user",
      kind: "codex",
      name: "Codex",
      rootPath: path.join(homePath, ".codex", "skills"),
      description: "Editable local Codex skills",
      isReadOnly: false,
      maxDepth: 3,
    },
    {
      id: "agents-global",
      kind: "agents",
      name: "Global",
      rootPath: path.join(homePath, ".agents", "skills"),
      description: "Editable cross-project agent skills",
      isReadOnly: false,
      maxDepth: 3,
    },
    {
      id: "claude-user",
      kind: "claude",
      name: "Claude Code",
      rootPath: path.join(homePath, ".claude", "skills"),
      description: "Claude Code skills on this machine",
      isReadOnly: false,
      maxDepth: 3,
    },
    {
      id: "cursor-user",
      kind: "cursor",
      name: "Cursor",
      rootPath: path.join(homePath, ".cursor", "skills"),
      description: "Cursor agent skills on this machine",
      isReadOnly: false,
      maxDepth: 3,
    },
    {
      id: "opencode-user",
      kind: "opencode",
      name: "OpenCode",
      rootPath: path.join(homePath, ".config", "opencode", "skills"),
      description: "OpenCode skills on this machine",
      isReadOnly: false,
      maxDepth: 3,
    },
    {
      id: "windsurf-user",
      kind: "windsurf",
      name: "Windsurf",
      rootPath: path.join(homePath, ".windsurf", "skills"),
      description: "Windsurf agent skills on this machine",
      isReadOnly: false,
      maxDepth: 3,
    },
    {
      id: "amp-user",
      kind: "amp",
      name: "Amp",
      rootPath: path.join(homePath, ".amp", "skills"),
      description: "Amp agent skills on this machine",
      isReadOnly: false,
      maxDepth: 3,
    },
    {
      id: "project-skills",
      kind: "project",
      name: "Project Skills",
      rootPath: path.join(projectRoot, ".agents", "skills"),
      description: "Skills checked into the active project",
      isReadOnly: false,
      maxDepth: 3,
    },
  ];
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
  }>;

  try {
    entries = await fs.readdir(targetPath, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch {
    return [];
  }

  const hasSkillFile = entries.some(
    (entry) => entry.isFile() && entry.name.toLowerCase() === SKILL_FILE_NAME.toLowerCase(),
  );

  if (hasSkillFile) {
    return [path.join(targetPath, SKILL_FILE_NAME)];
  }

  const directories = entries.filter(
    (entry) => entry.isDirectory() && !IGNORED_DIRECTORY_NAMES.has(entry.name),
  );

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

async function buildSkillEntry(
  source: SourceDefinition,
  skillFilePath: string,
): Promise<SkillEntry | null> {
  try {
    const skillStats = await fs.stat(skillFilePath);
    const content = (await fs.readFile(skillFilePath, "utf8")).replace(/\r\n?/g, "\n");
    const parsed = parseSkillDocument(content);
    const directoryPath = path.dirname(skillFilePath);
    const agentsFilePath = path.join(directoryPath, AGENTS_FILE_NAME);
    const hasAgentsFile = await fileExists(agentsFilePath);

    return {
      id: `${source.id}:${toSlug(skillFilePath, source.rootPath)}`,
      slug: toSlug(skillFilePath, source.rootPath),
      name: parsed.title ?? path.basename(directoryPath),
      description: parsed.description,
      version: typeof parsed.frontmatter.version === "string" ? parsed.frontmatter.version : null,
      sourceId: source.id,
      sourceName: source.name,
      sourceKind: source.kind,
      sourceRootPath: source.rootPath,
      directoryPath,
      skillFilePath,
      agentsFilePath: hasAgentsFile ? agentsFilePath : null,
      isReadOnly: source.isReadOnly,
      hasAgentsFile,
      hasScripts: await directoryExists(path.join(directoryPath, "scripts")),
      hasAssets: await directoryExists(path.join(directoryPath, "assets")),
      hasReferences: await directoryExists(path.join(directoryPath, "references")),
      hasRules: await directoryExists(path.join(directoryPath, "rules")),
      hasExamples: await directoryExists(path.join(directoryPath, "examples")),
      lastModifiedAt: skillStats.mtime.toISOString(),
      frontmatter: parsed.frontmatter,
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
  let snapshot: SkillLibrarySnapshot = {
    sources: [],
    skills: [],
    scannedAt: new Date(0).toISOString(),
  };
  let refreshPromise: Promise<SkillLibrarySnapshot> | null = null;
  let scheduledRefresh: NodeJS.Timeout | null = null;
  let pendingChangedPaths = new Set<string>();
  const watchers = new Map<string, ReturnType<typeof watch>>();

  const refresh = async (changedPaths?: string[]) => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const sourceDefinitions = getSourceDefinitions(projectRoot);
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
          return {
            source,
            skills: entries.filter((entry): entry is SkillEntry => entry !== null).sort(sortSkills),
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

      for (const [rootPath, watcher] of watchers.entries()) {
        if (nextSources.some((source) => toPathKey(source.rootPath) === toPathKey(rootPath))) {
          continue;
        }

        void watcher.close();
        watchers.delete(rootPath);
      }

      for (const source of activeSources) {
        if (watchers.has(source.rootPath)) {
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

        watchers.set(source.rootPath, watcher);
      }

      snapshot = nextSnapshot;

      if (changedPaths && changedPaths.length > 0) {
        onLibraryChanged({
          snapshot: nextSnapshot,
          changedPaths: Array.from(new Set(changedPaths.map((entry) => path.normalize(entry)))),
        });
      }

      return nextSnapshot;
    })().finally(() => {
      refreshPromise = null;
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
      path.basename(filePath).toUpperCase() === AGENTS_FILE_NAME ? "agents" : "skill";

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

  const dispose = async () => {
    if (scheduledRefresh) {
      clearTimeout(scheduledRefresh);
      scheduledRefresh = null;
    }

    await Promise.all(Array.from(watchers.values()).map((watcher) => watcher.close()));
    watchers.clear();
  };

  return {
    dispose,
    getSnapshot,
    readDocument,
    refresh,
    saveDocument,
  };
}
