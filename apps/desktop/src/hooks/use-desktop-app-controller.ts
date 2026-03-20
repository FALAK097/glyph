import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type { DragPosition, SidebarTopLevelNode } from "@/types/sidebar";

import { getShortcutDisplay, matchShortcut, mergeShortcutSettings } from "@/shared/shortcuts";
import type { AppSettings, DirectoryNode, FileDocument, SearchResult, SidebarItemSetting, ThemeMode, WorkspaceSnapshot } from "@/shared/workspace";
import { useWorkspaceStore } from "@/store/workspace";
import { applyTheme } from "@/theme/themes";

import { getErrorMessage } from "@/lib/errors";
import { isFileInsideWorkspace, isPathInside, isSamePath, normalizePath } from "@/lib/paths";
import {
  orderSidebarNodes,
  removeSidebarPath,
  reorderSidebarNodes,
  renameSidebarFile,
  toSidebarItemSetting,
  upsertSidebarFile,
  upsertSidebarFolder
} from "@/lib/sidebar-tree";
import { flattenFiles } from "@/lib/workspace-tree";

import type { CommandPaletteItem } from "@/types/command-palette";

export const useDesktopAppController = (glyph: NonNullable<Window["glyph"]>) => {
  const {
    rootPath,
    tree,
    activeFile,
    draftContent,
    isDirty,
    isSaving,
    lastSavedAt,
    error,
    setWorkspace,
    setTree,
    setActiveFile,
    attachActiveFile,
    updateActiveFile,
    updateDraftContent,
    markSaved,
    setSaving,
    setError,
    pushHistory,
    canGoBack,
    canGoForward,
    goBack,
    goForward
  } = useWorkspaceStore();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(true);
  const [sidebarNodes, setSidebarNodes] = useState<DirectoryNode[]>([]);
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<string[]>([]);
  const [hasHydratedSidebar, setHasHydratedSidebar] = useState(false);
  const draftFileCreationRef = useRef<Promise<FileDocument | null> | null>(null);
  const deferredPaletteQuery = useDeferredValue(paletteQuery);

  const files = useMemo(() => flattenFiles(tree, rootPath), [rootPath, tree]);
  const wordCount = useMemo(() => {
    const text = draftContent.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [draftContent]);
  const readingTime = Math.max(1, Math.round(wordCount / 200));

  const visibleSidebarNodes = useMemo<SidebarTopLevelNode[]>(() => {
    const expanded = new Set(expandedFolderPaths.map(p => normalizePath(p).toLowerCase()));
    return sidebarNodes.map((node) => ({
      node,
      isExpanded: node.type === "directory" ? expanded.has(normalizePath(node.path).toLowerCase()) : true
    }));
  }, [expandedFolderPaths, sidebarNodes]);

  const persistedSidebar = useMemo(() => ({
    items: sidebarNodes.map(toSidebarItemSetting),
    expandedFolders: expandedFolderPaths
  }), [expandedFolderPaths, sidebarNodes]);

  const restoreSidebarNodes = useCallback(async (items: SidebarItemSetting[]) => {
    const resolved = await Promise.all(items.map((item) => glyph.getSidebarNode(item.kind, item.path)));
    return resolved.filter((node): node is DirectoryNode => node !== null);
  }, [glyph]);

  const syncWorkspace = useCallback((workspace: WorkspaceSnapshot) => {
    setWorkspace(workspace);
    setSidebarNodes((prev) => upsertSidebarFolder(prev, workspace));
    setExpandedFolderPaths((prev) => (prev.some((p) => isSamePath(p, workspace.rootPath)) ? prev : [...prev, workspace.rootPath]));
  }, [setWorkspace]);

  const syncOpenedFile = useCallback(async (file: FileDocument) => {
    setActiveFile(file);
    setIsWorkspaceMode(isFileInsideWorkspace(file.path, rootPath));
    setSidebarNodes((prev) => upsertSidebarFile(prev, file));
    const nextSettings = await glyph.getSettings();
    setSettings(nextSettings);
    setIsPaletteOpen(false);
  }, [rootPath, setActiveFile, glyph]);

  useEffect(() => {
    const boot = async () => {
      const nextSettings = await glyph.getSettings();
      setSettings(nextSettings);
      applyTheme(nextSettings.themeMode);

      let nextSidebarNodes = orderSidebarNodes(await restoreSidebarNodes(nextSettings.sidebar.items), nextSettings.sidebar.items);
      const nextExpandedFolders = new Set(nextSettings.sidebar.expandedFolders);

      const target = await glyph.getPendingExternalPath();
      if (target) {
        if (target.isDirectory) {
          const workspace = await glyph.openFolder(target.path);
          if (workspace) {
            setWorkspace(workspace);
            setIsWorkspaceMode(true);
            nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
            nextExpandedFolders.add(workspace.rootPath);
          }
        } else {
          const workspace = await glyph.openDefaultWorkspace();
          if (workspace) {
            setWorkspace(workspace);
            nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
            nextExpandedFolders.add(workspace.rootPath);
          }
          const file = await glyph.readFile(target.path);
          setActiveFile(file);
          setIsWorkspaceMode(Boolean(workspace && isFileInsideWorkspace(file.path, workspace.rootPath)));
          nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, file);
        }
      } else {
        const workspace = await glyph.openDefaultWorkspace();
        if (workspace) {
          setWorkspace(workspace);
          setIsWorkspaceMode(true);
          nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
          nextExpandedFolders.add(workspace.rootPath);
        }
      }

      setSidebarNodes(nextSidebarNodes);
      setExpandedFolderPaths(Array.from(nextExpandedFolders));
      setHasHydratedSidebar(true);
    };

    void boot();
  }, [restoreSidebarNodes, setActiveFile, setWorkspace, glyph]);

  useEffect(() => {
    return glyph.onExternalFile(async (target) => {
      if (target.isDirectory) {
        const workspace = await glyph.openFolder(target.path);
        if (workspace) {
          syncWorkspace(workspace);
          setIsWorkspaceMode(true);
        }
      } else {
        const file = await glyph.readFile(target.path);
        await syncOpenedFile(file);
      }
    });
  }, [syncOpenedFile, syncWorkspace, glyph]);

  useEffect(() => {
    return glyph.onWorkspaceChanged(async ({ rootPath: changedRootPath, tree: nextTree, changedPath }) => {
      setTree(nextTree);
      setSidebarNodes((prev) => upsertSidebarFolder(prev, { rootPath: changedRootPath, tree: nextTree, activeFile: null }));

      if (changedPath === activeFile?.path && !isDirty) {
        const refreshedFile = await glyph.readFile(changedPath);
        updateActiveFile(refreshedFile);
      }
    });
  }, [activeFile?.path, isDirty, updateActiveFile, setTree, glyph]);

  useEffect(() => {
    if (!activeFile || !isDirty || isSaving) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        let currentPath = activeFile.path;
        let finalFile = activeFile;
        const isUntitled = activeFile.name.startsWith("Untitled-");

        if (isUntitled && draftContent.trim().length > 0) {
          const firstLine = draftContent.split(/\r?\n/)[0]?.replace(/^#+\s*/, "").trim() || "Untitled";
          const safeName = firstLine.replace(/[^a-zA-Z0-9-_\s]/g, "").trim().substring(0, 50);
          if (safeName && safeName !== "Untitled") {
            const newName = `${safeName}.md`;
            finalFile = await glyph.renameFile(currentPath, newName);
            setSidebarNodes((prev) => upsertSidebarFile(renameSidebarFile(prev, currentPath, finalFile), finalFile));
            currentPath = finalFile.path;
            updateActiveFile(finalFile);
          }
        }

        const savedFile = await glyph.saveFile(currentPath, draftContent);
        markSaved(savedFile);
      } catch (saveError) {
        setSaving(false);
        setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeFile?.path, draftContent, isDirty, isSaving, markSaved, setError, setSaving, glyph]);

  useEffect(() => {
    if (!isPaletteOpen) {
      setSearchResults([]);
      return;
    }

    const query = deferredPaletteQuery.trim().toLowerCase();

    if (!isWorkspaceMode || !query || query.startsWith("theme")) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const results = await glyph.searchWorkspace(query);
      setSearchResults(results);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [deferredPaletteQuery, isPaletteOpen, isWorkspaceMode, glyph]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    applyTheme(settings.themeMode);
  }, [settings]);

  const saveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await glyph.updateSettings(patch);
    setSettings(next);
    return next;
  }, [glyph]);

  useEffect(() => {
    if (!settings || !hasHydratedSidebar) {
      return;
    }

    const currentSidebar = JSON.stringify(persistedSidebar);
    const savedSidebar = JSON.stringify(settings.sidebar);
    if (currentSidebar === savedSidebar) {
      return;
    }

    void saveSettings({ sidebar: persistedSidebar });
  }, [hasHydratedSidebar, persistedSidebar, saveSettings, settings]);

  const openFile = useCallback(async (filePath: string) => {
    const file = await glyph.readFile(filePath);
    await syncOpenedFile(file);
    pushHistory(filePath);
  }, [syncOpenedFile, glyph, pushHistory]);

  const createNote = useCallback(async () => {
    const baseDir = isWorkspaceMode ? rootPath : settings?.defaultWorkspacePath ?? null;

    if (!baseDir) {
      return;
    }

    const file = await glyph.createFile(baseDir, `Untitled-${Date.now()}.md`);
    setActiveFile(file);
    setIsWorkspaceMode(true);
    setSidebarNodes((prev) => upsertSidebarFile(prev, file));
    const nextSettings = await glyph.getSettings();
    setSettings(nextSettings);
    setIsPaletteOpen(false);
  }, [isWorkspaceMode, rootPath, setActiveFile, settings?.defaultWorkspacePath, glyph]);

  const ensureActiveDraftFile = useCallback(async () => {
    if (activeFile) {
      return activeFile;
    }

    if (draftFileCreationRef.current) {
      return draftFileCreationRef.current;
    }

    const baseDir = isWorkspaceMode ? rootPath : settings?.defaultWorkspacePath ?? null;
    if (!baseDir) {
      return null;
    }

    const createPromise = (async () => {
      const file = await glyph.createFile(baseDir, `Untitled-${Date.now()}.md`);
      attachActiveFile(file);
      setIsWorkspaceMode(true);
      setSidebarNodes((prev) => upsertSidebarFile(prev, file));
      const nextSettings = await glyph.getSettings();
      setSettings(nextSettings);
      return file;
    })();

    draftFileCreationRef.current = createPromise;

    try {
      return await createPromise;
    } finally {
      draftFileCreationRef.current = null;
    }
  }, [activeFile, attachActiveFile, glyph, isWorkspaceMode, rootPath, settings?.defaultWorkspacePath]);

  const handleDraftChange = useCallback((nextContent: string) => {
    updateDraftContent(nextContent);

    if (!activeFile && nextContent.trim().length > 0) {
      void ensureActiveDraftFile().catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
    }
  }, [activeFile, ensureActiveDraftFile, setError, updateDraftContent]);

  const currentFileIndex = files.findIndex((item) => item.path === activeFile?.path);

  const moveNote = useCallback(async (direction: 1 | -1) => {
    if (currentFileIndex === -1 || files.length === 0) {
      return;
    }

    const nextIndex = (currentFileIndex + direction + files.length) % files.length;
    await openFile(files[nextIndex].path);
  }, [currentFileIndex, files, openFile]);

  const navigateBack = useCallback(async () => {
    const prevPath = goBack();
    if (prevPath) {
      const file = await glyph.readFile(prevPath);
      await syncOpenedFile(file);
    }
  }, [goBack, glyph, syncOpenedFile]);

  const navigateForward = useCallback(async () => {
    const nextPath = goForward();
    if (nextPath) {
      const file = await glyph.readFile(nextPath);
      await syncOpenedFile(file);
    }
  }, [goForward, glyph, syncOpenedFile]);

  const handleDeleteFile = useCallback(async (filePath: string) => {
    try {
      await glyph.deleteFile(filePath);
      setSidebarNodes((prev) => removeSidebarPath(prev, filePath));

      if (activeFile?.path === filePath) {
        setActiveFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    }
  }, [activeFile?.path, setActiveFile, setError, glyph]);

  const revealInFinder = useCallback(async (targetPath: string) => {
    try {
      await glyph.revealInFinder(targetPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open in Finder");
    }
  }, [setError, glyph]);

  const handleRenameFile = useCallback(async (filePath: string, newName: string) => {
    if (!newName.trim()) {
      return;
    }

    try {
      const renamedFile = await glyph.renameFile(filePath, newName);
      setSidebarNodes((prev) => upsertSidebarFile(renameSidebarFile(prev, filePath, renamedFile), renamedFile));
      if (activeFile?.path === filePath) {
        setActiveFile(renamedFile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename file");
    }
  }, [activeFile?.path, setActiveFile, setError, glyph]);

  const handleRemoveFolder = useCallback((folderPath: string) => {
    setSidebarNodes((prev) => removeSidebarPath(prev, folderPath));
    setExpandedFolderPaths((prev) => prev.filter((path) => !isPathInside(path, folderPath)));

    if (rootPath && isSamePath(rootPath, folderPath)) {
      setWorkspace({ rootPath: "", tree: [], activeFile: null });
      setIsWorkspaceMode(false);
    }
  }, [rootPath, setWorkspace]);

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolderPaths((prev) => (
      prev.some((path) => isSamePath(path, folderPath))
        ? prev.filter((path) => !isSamePath(path, folderPath))
        : [...prev, folderPath]
    ));
  }, []);

  const handleReorderNodes = useCallback((sourcePath: string, targetPath: string, position: DragPosition) => {
    setSidebarNodes((prev) => reorderSidebarNodes(prev, sourcePath, targetPath, position));
  }, []);

  const shortcuts = useMemo(() => mergeShortcutSettings(settings?.shortcuts), [settings?.shortcuts]);

  // Stable commands list — only rebuilds when actions/shortcuts change, never on query change
  const baseCommands = useMemo<CommandPaletteItem[]>(() => [
    {
      id: "new-note",
      title: "New note",
      subtitle: "Create a fresh markdown note",
      shortcut: getShortcutDisplay(shortcuts, "new-note"),
      section: "Actions",
      kind: "command",
      onSelect: () => void createNote()
    },
    {
      id: "open-file",
      title: "Open File",
      subtitle: "Open an existing markdown file",
      shortcut: getShortcutDisplay(shortcuts, "open-file"),
      section: "Actions",
      kind: "command",
      onSelect: async () => {
        const file = await glyph.openDocument();
        if (file) await syncOpenedFile(file);
        setIsPaletteOpen(false);
      }
    },
    {
      id: "open-folder",
      title: "Open Folder",
      subtitle: "Open a folder as a workspace",
      shortcut: getShortcutDisplay(shortcuts, "open-folder"),
      section: "Actions",
      kind: "command",
      onSelect: async () => {
        const workspace = await glyph.openFolder();
        if (workspace) { syncWorkspace(workspace); setIsWorkspaceMode(true); }
        setIsPaletteOpen(false);
      }
    },
    {
      id: "previous-note",
      title: "Previous note",
      subtitle: "Jump to previous note",
      shortcut: getShortcutDisplay(shortcuts, "previous-note"),
      section: "Actions",
      kind: "command",
      onSelect: () => { void moveNote(-1); setIsPaletteOpen(false); }
    },
    {
      id: "next-note",
      title: "Next note",
      subtitle: "Jump to next note",
      shortcut: getShortcutDisplay(shortcuts, "next-note"),
      section: "Actions",
      kind: "command",
      onSelect: () => { void moveNote(1); setIsPaletteOpen(false); }
    },
    {
      id: "navigate-back",
      title: "Navigate Back",
      subtitle: "Go to previous file in history",
      shortcut: getShortcutDisplay(shortcuts, "navigate-back"),
      section: "Navigation",
      kind: "command",
      onSelect: () => { void navigateBack(); setIsPaletteOpen(false); }
    },
    {
      id: "navigate-forward",
      title: "Navigate Forward",
      subtitle: "Go to next file in history",
      shortcut: getShortcutDisplay(shortcuts, "navigate-forward"),
      section: "Navigation",
      kind: "command",
      onSelect: () => { void navigateForward(); setIsPaletteOpen(false); }
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "Adjust workspace defaults",
      shortcut: getShortcutDisplay(shortcuts, "settings"),
      section: "Actions",
      kind: "command",
      onSelect: () => { setIsSettingsOpen(true); setIsPaletteOpen(false); }
    },
    {
      id: "theme-light",
      title: "Theme: Light",
      subtitle: "Switch to light mode",
      section: "Theme",
      kind: "command",
      onSelect: () => { void saveSettings({ themeMode: "light" }); setIsPaletteOpen(false); }
    },
    {
      id: "theme-dark",
      title: "Theme: Dark",
      subtitle: "Switch to dark mode",
      section: "Theme",
      kind: "command",
      onSelect: () => { void saveSettings({ themeMode: "dark" }); setIsPaletteOpen(false); }
    },
    {
      id: "theme-system",
      title: "Theme: System",
      subtitle: "Sync theme with system",
      section: "Theme",
      kind: "command",
      onSelect: () => { void saveSettings({ themeMode: "system" }); setIsPaletteOpen(false); }
    }
  ], [createNote, moveNote, navigateBack, navigateForward, saveSettings, shortcuts, syncOpenedFile, syncWorkspace, glyph]);

  // Stable deduplicated file list — only rebuilds when sidebarNodes or files change, never on query change
  const allSearchableFiles = useMemo(() => {
    const seenPaths = new Set<string>();
    const result: Array<{ path: string; name: string; relativePath: string }> = [];

    const traverseSidebar = (nodes: DirectoryNode[], parentPath: string = "") => {
      for (const node of nodes) {
        if (node.type === "file") {
          if (!seenPaths.has(node.path)) {
            seenPaths.add(node.path);
            result.push({
              path: node.path,
              name: node.name,
              relativePath: parentPath ? `${parentPath}/${node.name}` : node.name
            });
          }
        } else {
          traverseSidebar(node.children, parentPath ? `${parentPath}/${node.name}` : node.name);
        }
      }
    };
    traverseSidebar(sidebarNodes);

    for (const f of files) {
      if (!seenPaths.has(f.path)) {
        seenPaths.add(f.path);
        result.push(f);
      }
    }

    return result;
  }, [files, sidebarNodes]);

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const query = deferredPaletteQuery.trim().toLowerCase();

    // No query: show all commands only
    if (!query) {
      return baseCommands;
    }

    const items: CommandPaletteItem[] = [];

    // Match commands by title only — never subtitle (prevents false positives)
    const matchedCommands = baseCommands.filter((cmd) =>
      cmd.title.toLowerCase().includes(query)
    );
    items.push(...matchedCommands);

    // Match files by name or path
    const matchingFiles = allSearchableFiles.filter((file) =>
      file.name.toLowerCase().includes(query) ||
      file.relativePath.toLowerCase().includes(query)
    );

    matchingFiles.slice(0, 12).forEach((file) => {
      items.push({
        id: file.path,
        title: file.name,
        subtitle: file.relativePath,
        hint: "File",
        section: "Files",
        kind: "file",
        onSelect: () => void openFile(file.path)
      });
    });

    // Full-text content search results
    searchResults.slice(0, 8).forEach((result) => {
      items.push({
        id: `search-${result.path}-${result.line}`,
        title: result.name,
        subtitle: `${result.snippet} · line ${result.line}`,
        hint: "Match",
        section: "Matches",
        kind: "file",
        onSelect: () => void openFile(result.path)
      });
    });

    return items;
  }, [allSearchableFiles, baseCommands, deferredPaletteQuery, openFile, searchResults]);

  // Reset query when palette closes
  useEffect(() => {
    if (!isPaletteOpen) {
      setPaletteQuery("");
    }
  }, [isPaletteOpen]);

  // Reset selected index whenever the query or results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [deferredPaletteQuery]);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isEditableInput = target && (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      );

      if (event.key === "Escape" && !isEditableInput) {
        setIsPaletteOpen(false);
        setIsSettingsOpen(false);
        return;
      }

      // These shortcuts fire globally — even when the editor (contenteditable) is focused.
      const globalShortcutIds = new Set(["toggle-sidebar", "command-palette", "settings", "navigate-back", "navigate-forward"]);
      const globalShortcut = shortcuts.find((entry) => globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys));
      if (globalShortcut) {
        event.preventDefault();
        switch (globalShortcut.id) {
          case "toggle-sidebar":
            setIsSidebarCollapsed((prev) => !prev);
            break;
          case "command-palette":
            setIsPaletteOpen((value) => !value);
            break;
          case "settings":
            setIsSettingsOpen((value) => !value);
            break;
          case "navigate-back":
            void navigateBack();
            break;
          case "navigate-forward":
            void navigateForward();
            break;
        }
        return;
      }

      if (!isEditableInput) {
        const shortcut = shortcuts.find((entry) => !globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys));

        if (shortcut) {
          event.preventDefault();

          switch (shortcut.id) {
            case "new-note":
              void createNote();
              break;
            case "open-file": {
              const file = await glyph.openDocument();
              if (file) {
                await syncOpenedFile(file);
              }
              break;
            }
            case "open-folder": {
              const workspace = await glyph.openFolder();
              if (workspace) {
                syncWorkspace(workspace);
                setIsWorkspaceMode(true);
              }
              break;
            }
            case "save":
              if (activeFile) {
                setSaving(true);
                try {
                  const savedFile = await glyph.saveFile(activeFile.path, draftContent);
                  markSaved(savedFile);
                } catch (saveError) {
                  console.error("Manual save failed:", saveError);
                  setError(getErrorMessage(saveError));
                } finally {
                  setSaving(false);
                }
              }
              break;
            case "previous-note":
              void moveNote(-1);
              break;
            case "next-note":
              void moveNote(1);
              break;
          }
          return;
        }


      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, activeFile, draftContent, markSaved, setError, setSaving, glyph, createNote, moveNote, syncOpenedFile, syncWorkspace, navigateBack, navigateForward]);

  useEffect(() => {
    return glyph.onCommand(async (command) => {
      if (command === "quick-open") {
        setIsPaletteOpen(true);
        return;
      }

      if (command === "toggle-sidebar") {
        setIsSidebarCollapsed((prev) => !prev);
        return;
      }

      if (command === "new-file") {
        await createNote();
        return;
      }

      if (command === "open-file") {
        const file = await glyph.openDocument();
        if (file) {
          await syncOpenedFile(file);
        }
        return;
      }

      if (command === "open-folder") {
        const workspace = await glyph.openFolder();
        if (workspace) {
          syncWorkspace(workspace);
          setIsWorkspaceMode(true);
        }
        return;
      }

      if (command === "save" && activeFile) {
        setSaving(true);
        try {
          const savedFile = await glyph.saveFile(activeFile.path, draftContent);
          markSaved(savedFile);
        } catch (saveError) {
          console.error("Menu save failed:", saveError);
          setError(getErrorMessage(saveError));
        } finally {
          setSaving(false);
        }
      }
    });
  }, [activeFile, createNote, draftContent, markSaved, setError, setSaving, syncOpenedFile, syncWorkspace, glyph]);

  const saveStateLabel = isSaving
    ? "Saving..."
    : isDirty
      ? "Unsaved"
      : lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "Ready";

  const chooseFolderAndUpdateWorkspace = useCallback(async () => {
    const selection = await glyph.openDialog("directory");
    if (!selection) {
      return;
    }

    const nextSettings = await saveSettings({ defaultWorkspacePath: selection.path });
    const workspace = await glyph.openFolder(nextSettings.defaultWorkspacePath);
    if (workspace) {
      syncWorkspace(workspace);
      setIsWorkspaceMode(true);
    }
  }, [saveSettings, syncWorkspace, glyph]);

  const changeThemeMode = useCallback(async (mode: ThemeMode) => {
    await saveSettings({ themeMode: mode });
  }, [saveSettings]);

  const changeShortcuts = useCallback(async (nextShortcuts: AppSettings["shortcuts"]) => {
    await saveSettings({ shortcuts: nextShortcuts });
  }, [saveSettings]);

  return {
    activeFile,
    canGoBack,
    canGoForward,
    changeShortcuts,
    changeThemeMode,
    chooseFolderAndUpdateWorkspace,
    createNote,
    draftContent,
    error,
    files,
    handleDeleteFile,
    handleRemoveFolder,
    handleRenameFile,
    handleReorderNodes,
    handleToggleFolder,
    isPaletteOpen,
    isSaving,
    isSettingsOpen,
    isSidebarCollapsed,
    markSaved,
    navigateBack,
    navigateForward,
    openFile,
    paletteItems,
    paletteQuery,
    readingTime,
    revealInFinder,
    saveSettings,
    saveStateLabel,
    selectedIndex,
    setIsPaletteOpen,
    setIsSettingsOpen,
    setIsSidebarCollapsed,
    setPaletteQuery,
    setSelectedIndex,
    settings,
    shortcuts,
    updateDraftContent: handleDraftChange,
    visibleSidebarNodes,
    wordCount
  };
};
