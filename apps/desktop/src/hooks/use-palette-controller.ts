import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { NoteShortcutItem } from "@/types/navigation";
import type { CommandPaletteItem } from "@/types/command-palette";

import type {
  AppSettings,
  DirectoryNode,
  FileDocument,
  SearchResult,
  ShortcutSetting,
} from "@/core/workspace";

import { normalizePath } from "@/core/paths";

const toPathKey = (path: string) => normalizePath(path).toLowerCase();

type UsePaletteControllerOptions = {
  glyph: NonNullable<Window["glyph"]>;
  settings: AppSettings | null;
  shortcuts: ShortcutSetting[];
  isPaletteOpen: boolean;
  isWorkspaceMode: boolean;
  sidebarNodes: DirectoryNode[];
  hiddenFileKeys: Set<string>;
  allSearchableFiles: Array<{ path: string; name: string; relativePath: string }>;
  activeFile: FileDocument | null;
  baseCommands: CommandPaletteItem[];
  openFile: (filePath: string) => Promise<void>;
  setIsPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function usePaletteController({
  glyph,
  settings,
  isPaletteOpen,
  isWorkspaceMode,
  hiddenFileKeys,
  allSearchableFiles,
  activeFile,
  baseCommands,
  openFile,
  setIsPaletteOpen,
}: UsePaletteControllerOptions) {
  const [paletteQuery, setPaletteQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchVersionRef = useRef(0);

  useEffect(() => {
    if (!isPaletteOpen) {
      setSearchResults([]);
      return;
    }

    const query = paletteQuery.trim().toLowerCase();

    if (!isWorkspaceMode || !query || query.startsWith("theme")) {
      setSearchResults([]);
      return;
    }

    searchVersionRef.current += 1;
    const currentVersion = searchVersionRef.current;

    const timer = window.setTimeout(async () => {
      const results = await glyph.searchWorkspace(query);
      if (currentVersion === searchVersionRef.current) {
        setSearchResults(results);
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      searchVersionRef.current += 1;
    };
  }, [glyph, isPaletteOpen, isWorkspaceMode, paletteQuery]);

  useEffect(() => {
    if (!isPaletteOpen) {
      setPaletteQuery("");
    }
  }, [isPaletteOpen]);

  const noteShortcutLookup = useMemo(() => {
    const lookup = new Map<string, NoteShortcutItem>();

    for (const file of allSearchableFiles) {
      lookup.set(toPathKey(file.path), {
        path: file.path,
        title: file.name.replace(/\.(md|mdx|markdown)$/i, ""),
        subtitle: file.relativePath,
      });
    }

    if (activeFile && !lookup.has(toPathKey(activeFile.path))) {
      lookup.set(toPathKey(activeFile.path), {
        path: activeFile.path,
        title: activeFile.name.replace(/\.(md|mdx|markdown)$/i, ""),
        subtitle: activeFile.path,
      });
    }

    return lookup;
  }, [activeFile, allSearchableFiles]);

  const toShortcutItems = useCallback(
    (paths: string[], badge?: string) =>
      paths.map((targetPath) => {
        const match = noteShortcutLookup.get(toPathKey(targetPath));
        if (match) {
          return { ...match, badge };
        }

        const segments = targetPath.replace(/\\/g, "/").split("/");
        const fileName = segments.pop() ?? targetPath;
        return {
          path: targetPath,
          title: fileName.replace(/\.(md|mdx|markdown)$/i, ""),
          subtitle: targetPath,
          badge,
        };
      }),
    [noteShortcutLookup],
  );

  const pinnedNotes = useMemo(
    () => toShortcutItems(settings?.pinnedFiles ?? []),
    [settings?.pinnedFiles, toShortcutItems],
  );

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const query = paletteQuery.trim().toLowerCase();
    const pinnedPaletteItems = pinnedNotes.slice(0, 8).map((note) => ({
      id: `pinned-${note.path}`,
      title: note.title,
      subtitle: note.subtitle,
      hint: "Pinned",
      section: "Pinned Notes",
      kind: "file" as const,
      onSelect: () => void openFile(note.path),
    }));

    if (!query) {
      return [...pinnedPaletteItems, ...baseCommands];
    }

    const items: CommandPaletteItem[] = [];

    const matchedCommands = baseCommands.filter((cmd) => cmd.title.toLowerCase().includes(query));
    items.push(...matchedCommands);
    items.push(
      ...pinnedPaletteItems.filter(
        (note) =>
          note.title.toLowerCase().includes(query) || note.subtitle?.toLowerCase().includes(query),
      ),
    );

    const pinnedPathKeys = new Set(pinnedNotes.map((note) => toPathKey(note.path)));
    const noteResultKeys = new Set<string>();

    const matchingFiles = allSearchableFiles.filter(
      (file) =>
        (file.name.toLowerCase().includes(query) ||
          file.relativePath.toLowerCase().includes(query)) &&
        !pinnedPathKeys.has(toPathKey(file.path)),
    );

    matchingFiles.slice(0, 12).forEach((file) => {
      noteResultKeys.add(toPathKey(file.path));
      items.push({
        id: file.path,
        title: file.name,
        subtitle: file.relativePath,
        hint: "File",
        section: "Notes",
        kind: "file",
        onSelect: () => void openFile(file.path),
      });
    });

    searchResults.slice(0, 8).forEach((result) => {
      const pathKey = toPathKey(result.path);
      if (hiddenFileKeys.has(pathKey) || noteResultKeys.has(pathKey)) {
        return;
      }

      noteResultKeys.add(pathKey);
      items.push({
        id: `search-${result.path}-${result.line}`,
        title: result.name,
        subtitle: `${result.snippet} · line ${result.line}`,
        hint: "Match",
        section: "Notes",
        kind: "file",
        onSelect: () => void openFile(result.path),
      });
    });

    return items;
  }, [
    allSearchableFiles,
    baseCommands,
    hiddenFileKeys,
    openFile,
    paletteQuery,
    pinnedNotes,
    searchResults,
  ]);

  return {
    isPaletteOpen,
    setIsPaletteOpen,
    paletteQuery,
    setPaletteQuery,
    searchResults,
    paletteItems,
    pinnedNotes,
  };
}
