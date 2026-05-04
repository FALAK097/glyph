import {
  getBaseName,
  getDirName,
  getDisplayFileName,
  getRelativePath,
  isPathInside,
  normalizePath,
} from "./paths";
import type {
  DirectoryNode,
  NoteBrowserEntry,
  NoteCollectionAccentKey,
  NoteCollectionIconKey,
  NoteFolderAppearanceMap,
} from "./workspace";

export const NOTE_COLLECTION_ACCENT_KEYS: NoteCollectionAccentKey[] = [
  "violet",
  "indigo",
  "blue",
  "sky",
  "cyan",
  "teal",
  "emerald",
  "lime",
  "amber",
  "orange",
  "coral",
  "rose",
  "pink",
  "red",
  "slate",
];

export const NOTE_COLLECTION_ICON_KEYS: NoteCollectionIconKey[] = [
  "folder",
  "book",
  "briefcase",
  "calendar",
  "sparkles",
  "rocket",
  "tag",
  "archive",
  "leaf",
  "layers",
  "globe",
  "home",
  "camera",
  "notebook",
  "star",
];

export type NoteCollectionItem = {
  id: string;
  label: string;
  path: string;
  sourcePath: string;
  appearancePath: string;
  count: number;
  notePaths: string[];
  accent: NoteCollectionAccentKey;
  icon: NoteCollectionIconKey;
  isActive: boolean;
  workspacePath: string | null;
  isRootCollection: boolean;
  isAllCollection: boolean;
};

type CollectionBuildInput = {
  path: string;
  sourcePath: string;
  workspacePath: string | null;
  isRootCollection: boolean;
  notePaths: string[];
};

const normalizeCollectionKey = (value: string) => normalizePath(value).replace(/\/+$/, "");
const toCollectionLookupKey = (value: string) => normalizeCollectionKey(value).toLowerCase();

const createHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export function getDefaultNoteCollectionAppearance(path: string) {
  const hash = createHash(normalizeCollectionKey(path).toLowerCase());
  return {
    accent: NOTE_COLLECTION_ACCENT_KEYS[hash % NOTE_COLLECTION_ACCENT_KEYS.length],
    icon: NOTE_COLLECTION_ICON_KEYS[
      Math.floor(hash / NOTE_COLLECTION_ACCENT_KEYS.length) % NOTE_COLLECTION_ICON_KEYS.length
    ],
  };
}

export function getNoteCollectionAppearance(
  path: string,
  appearances: NoteFolderAppearanceMap | null | undefined,
) {
  const normalizedPath = normalizeCollectionKey(path);
  const lookupKey = normalizedPath.toLowerCase();
  const explicit = appearances?.[lookupKey];
  const fallback = getDefaultNoteCollectionAppearance(normalizedPath);

  return {
    accent: explicit?.accent ?? fallback.accent,
    icon: explicit?.icon ?? fallback.icon,
  };
}

function getCollectionLabel(input: CollectionBuildInput) {
  if (input.isRootCollection) {
    return getDisplayFileName(getBaseName(input.sourcePath));
  }

  return getBaseName(input.sourcePath);
}

function collectMarkdownPaths(node: DirectoryNode): string[] {
  if (node.type === "file") {
    return [node.path];
  }

  return node.children.flatMap((child) => collectMarkdownPaths(child));
}

function addCollection(collections: CollectionBuildInput[], nextCollection: CollectionBuildInput) {
  if (nextCollection.notePaths.length === 0) {
    return;
  }

  collections.push({
    ...nextCollection,
    path: normalizeCollectionKey(nextCollection.path),
    notePaths: Array.from(new Set(nextCollection.notePaths.map((path) => normalizePath(path)))),
  });
}

export function buildNoteCollections(
  nodes: DirectoryNode[],
  activeCollectionPath: string | null,
  appearances: NoteFolderAppearanceMap | null | undefined,
): NoteCollectionItem[] {
  const collections: CollectionBuildInput[] = [];

  const processDirectoryNode = (
    node: Extract<DirectoryNode, { type: "directory" }>,
    workspacePath: string | null,
    isRootCollection: boolean,
  ) => {
    addCollection(collections, {
      path: node.path,
      sourcePath: node.path,
      workspacePath,
      isRootCollection,
      notePaths: collectMarkdownPaths(node),
    });

    // Recursively process nested directories
    node.children.forEach((child) => {
      if (child.type !== "directory") {
        return;
      }

      processDirectoryNode(child, node.path, false);
    });
  };

  nodes.forEach((node) => {
    if (node.type === "file") {
      addCollection(collections, {
        path: node.path,
        sourcePath: node.path,
        workspacePath: null,
        isRootCollection: true,
        notePaths: [node.path],
      });
      return;
    }

    processDirectoryNode(node, node.path, true);
  });

  const builtCollections = collections
    .filter((collection) => collection.notePaths.length > 0)
    .map((collection) => {
      const appearanceSourcePath = collection.path.endsWith("/.root")
        ? (collection.workspacePath ?? collection.path)
        : collection.path;
      const appearance = getNoteCollectionAppearance(appearanceSourcePath, appearances);
      const normalizedCollectionPath = normalizeCollectionKey(collection.path);
      const collectionLookupKey = toCollectionLookupKey(collection.path);

      return {
        id: collectionLookupKey,
        label: collection.path.endsWith("/.root") ? "Root Notes" : getCollectionLabel(collection),
        path: normalizedCollectionPath,
        sourcePath: normalizeCollectionKey(collection.sourcePath),
        appearancePath: appearanceSourcePath,
        count: collection.notePaths.length,
        notePaths: collection.notePaths,
        accent: appearance.accent,
        icon: appearance.icon,
        isActive: activeCollectionPath
          ? toCollectionLookupKey(activeCollectionPath) === collectionLookupKey
          : false,
        workspacePath: collection.workspacePath,
        isRootCollection: collection.isRootCollection,
        isAllCollection: false,
      };
    })
    .sort((left, right) => {
      if (left.isRootCollection !== right.isRootCollection) {
        return left.isRootCollection ? -1 : 1;
      }
      return left.label.localeCompare(right.label);
    });

  const allNotePaths = Array.from(
    new Set(builtCollections.flatMap((collection) => collection.notePaths)),
  );

  if (allNotePaths.length === 0) {
    return builtCollections;
  }

  const allNotesPath = "__glyph_all_notes__";
  const allNotesAppearance = getNoteCollectionAppearance(allNotesPath, appearances);
  const allNotesCollection: NoteCollectionItem = {
    id: allNotesPath,
    label: "All Notes",
    path: allNotesPath,
    sourcePath: builtCollections[0]?.sourcePath ?? allNotesPath,
    appearancePath: allNotesPath,
    count: allNotePaths.length,
    notePaths: allNotePaths,
    accent: allNotesAppearance.accent,
    icon: allNotesAppearance.icon,
    isActive: activeCollectionPath === allNotesPath,
    workspacePath: null,
    isRootCollection: true,
    isAllCollection: true,
  };

  return [allNotesCollection, ...builtCollections];
}

export function filterNoteBrowserEntries(
  entries: NoteBrowserEntry[],
  query: string,
  collection: Pick<NoteCollectionItem, "notePaths"> | null,
) {
  const notePathSet = collection
    ? new Set(collection.notePaths.map((path) => normalizePath(path).toLowerCase()))
    : null;
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter((entry) => {
    if (notePathSet && !notePathSet.has(normalizePath(entry.path).toLowerCase())) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [entry.title, entry.excerpt, getBaseName(entry.path), getDirName(entry.path)]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

export function getNoteBrowserEntrySubtitle(
  entry: NoteBrowserEntry,
  collectionPath: string | null,
) {
  return getRelativePath(entry.path, collectionPath);
}

export function remapNoteFolderAppearances(
  appearances: NoteFolderAppearanceMap,
  oldPath: string,
  newPath: string,
) {
  const normalizedOldPath = normalizeCollectionKey(oldPath).toLowerCase();
  const normalizedNewPath = normalizeCollectionKey(newPath).toLowerCase();

  return Object.fromEntries(
    Object.entries(appearances).map(([entryPath, value]) => {
      const normalizedEntryPath = normalizeCollectionKey(entryPath).toLowerCase();
      if (!isPathInside(normalizedEntryPath, normalizedOldPath)) {
        return [normalizedEntryPath, value] as const;
      }

      const suffix = normalizedEntryPath.slice(normalizedOldPath.length);
      return [`${normalizedNewPath}${suffix}`, value] as const;
    }),
  );
}

export function removeNoteFolderAppearances(
  appearances: NoteFolderAppearanceMap,
  removedPath: string,
) {
  const normalizedRemovedPath = normalizeCollectionKey(removedPath).toLowerCase();

  return Object.fromEntries(
    Object.entries(appearances).filter(([entryPath]) => {
      const normalizedEntryPath = normalizeCollectionKey(entryPath).toLowerCase();
      return !isPathInside(normalizedEntryPath, normalizedRemovedPath);
    }),
  );
}
