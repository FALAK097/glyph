import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type { BreadcrumbItem, NoteShortcutItem, OutlineItem } from "@/types/navigation";
import type { DragPosition, SidebarTopLevelNode } from "@/types/sidebar";

import { getShortcutDisplay, matchShortcut, mergeShortcutSettings } from "@/shared/shortcuts";
import type {
  AppInfo,
  AppSettings,
  DirectoryNode,
  FileDocument,
  SearchResult,
  SidebarItemSetting,
  ThemeMode,
  UpdateState,
  WorkspaceSnapshot,
} from "@/shared/workspace";
import { useWorkspaceStore } from "@/store/workspace";
import { applyTheme } from "@/theme/themes";

import { getErrorMessage } from "@/lib/errors";
import { buildBreadcrumbs, extractMarkdownOutline } from "@/lib/note-navigation";
import { isFileInsideWorkspace, isPathInside, isSamePath, normalizePath } from "@/lib/paths";
import { getFolderRevealLabel } from "@/lib/platform";
import {
  orderSidebarNodes,
  removeSidebarPath,
  reorderSidebarNodes,
  renameSidebarFile,
  toSidebarItemSetting,
  upsertSidebarFile,
  upsertSidebarFolder,
} from "@/lib/sidebar-tree";
import { flattenFiles } from "@/lib/workspace-tree";

import type { CommandPaletteItem } from "@/types/command-palette";

const toPathKey = (path: string) => normalizePath(path).toLowerCase();
const EMPTY_NOTE_NAME = "Untitled";
const NOTE_NAME_SAFE_CHAR_PATTERN = /[^a-zA-Z0-9-_\s]/g;
const TITLE_PREFIX_PATTERN = /^#+\s*/;
const NOTE_NAME_MAX_LENGTH = 50;

const getDraftTitleLine = (content: string) =>
  content.split(/\r?\n/, 1)[0]?.replace(TITLE_PREFIX_PATTERN, "").trim() ?? "";

const getDraftNoteName = (content: string) => {
  const safeName = getDraftTitleLine(content)
    .replace(NOTE_NAME_SAFE_CHAR_PATTERN, "")
    .trim()
    .substring(0, NOTE_NAME_MAX_LENGTH);

  return safeName && safeName !== EMPTY_NOTE_NAME ? safeName : null;
};

const getCommittedDraftFileName = (content: string) => {
  const safeName = getDraftNoteName(content);
  if (!safeName || !/\r?\n/.test(content)) {
    return null;
  }

  return `${safeName}.md`;
};

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
    replaceHistoryPath,
    removeHistoryPath,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  } = useWorkspaceStore();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
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
  const [editorFocusRequest, setEditorFocusRequest] = useState<{
    mode: "start" | "end" | "preserve";
    nonce: number;
  } | null>(null);
  const [outlineJumpRequest, setOutlineJumpRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const draftFileCreationRef = useRef<Promise<FileDocument | null> | null>(null);
  const editorFocusNonceRef = useRef(0);
  const deferredPaletteQuery = useDeferredValue(paletteQuery);

  const files = useMemo(() => flattenFiles(tree, rootPath), [rootPath, tree]);
  const wordCount = useMemo(() => {
    const text = draftContent.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [draftContent]);
  const readingTime = Math.max(1, Math.round(wordCount / 200));
  const outlineItems = useMemo<OutlineItem[]>(
    () => extractMarkdownOutline(draftContent),
    [draftContent],
  );
  const breadcrumbs = useMemo<BreadcrumbItem[]>(
    () => buildBreadcrumbs(activeFile?.path ?? null, rootPath),
    [activeFile?.path, rootPath],
  );
  const editorPreferences = settings?.editorPreferences;
  const isFocusMode = editorPreferences?.focusMode ?? false;
  const showOutline = editorPreferences?.showOutline ?? true;
  const folderRevealLabel = getFolderRevealLabel(appInfo?.platform);
  const isActiveFilePinned = activeFile
    ? (settings?.pinnedFiles ?? []).some((filePath) => isSamePath(filePath, activeFile.path))
    : false;

  const visibleSidebarNodes = useMemo<SidebarTopLevelNode[]>(() => {
    const expanded = new Set(expandedFolderPaths.map((p) => normalizePath(p).toLowerCase()));
    return sidebarNodes.map((node) => ({
      node,
      isExpanded:
        node.type === "directory" ? expanded.has(normalizePath(node.path).toLowerCase()) : true,
    }));
  }, [expandedFolderPaths, sidebarNodes]);

  const persistedSidebar = useMemo(
    () => ({
      items: sidebarNodes.map(toSidebarItemSetting),
      expandedFolders: expandedFolderPaths,
    }),
    [expandedFolderPaths, sidebarNodes],
  );

  const restoreSidebarNodes = useCallback(
    async (items: SidebarItemSetting[]) => {
      const resolved = await Promise.all(
        items.map((item) => glyph.getSidebarNode(item.kind, item.path)),
      );
      return resolved.filter((node): node is DirectoryNode => node !== null);
    },
    [glyph],
  );

  const syncWorkspace = useCallback(
    (workspace: WorkspaceSnapshot) => {
      setWorkspace(workspace);
      setSidebarNodes((prev) => upsertSidebarFolder(prev, workspace));
      setExpandedFolderPaths((prev) =>
        prev.some((p) => isSamePath(p, workspace.rootPath)) ? prev : [...prev, workspace.rootPath],
      );
    },
    [setWorkspace],
  );

  const requestEditorFocus = useCallback((mode: "start" | "end" | "preserve") => {
    window.requestAnimationFrame(() => {
      editorFocusNonceRef.current += 1;
      setEditorFocusRequest({
        mode,
        nonce: editorFocusNonceRef.current,
      });
    });
  }, []);

  const syncOpenedFile = useCallback(
    async (file: FileDocument, options?: { recordHistory?: boolean }) => {
      setActiveFile(file);
      setIsWorkspaceMode(isFileInsideWorkspace(file.path, rootPath));
      setSidebarNodes((prev) => upsertSidebarFile(prev, file));
      const nextSettings = await glyph.getSettings();
      setSettings(nextSettings);
      setIsPaletteOpen(false);
      if (options?.recordHistory) {
        pushHistory(file.path);
      }
      requestEditorFocus("end");
    },
    [glyph, pushHistory, requestEditorFocus, rootPath, setActiveFile],
  );

  useEffect(() => {
    const boot = async () => {
      const [nextSettings, nextAppInfo, nextUpdateState] = await Promise.all([
        glyph.getSettings(),
        glyph.getAppInfo(),
        glyph.getUpdateState(),
      ]);
      setSettings(nextSettings);
      setAppInfo(nextAppInfo);
      setUpdateState(nextUpdateState);
      applyTheme(nextSettings.themeMode);

      let nextSidebarNodes = orderSidebarNodes(
        await restoreSidebarNodes(nextSettings.sidebar.items),
        nextSettings.sidebar.items,
      );
      const nextExpandedFolders = new Set(nextSettings.sidebar.expandedFolders);
      let bootFocusMode: "start" | "end" = "start";

      const target = await glyph.getPendingExternalPath();
      if (target) {
        if (target.isDirectory) {
          const workspace = await glyph.openFolder(target.path);
          if (workspace) {
            setWorkspace(workspace);
            setIsWorkspaceMode(true);
            nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
            if (workspace.activeFile) {
              nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, workspace.activeFile);
              bootFocusMode = "end";
            }
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
          pushHistory(file.path);
          const refreshedSettings = await glyph.getSettings();
          setSettings(refreshedSettings);
          setIsWorkspaceMode(
            Boolean(workspace && isFileInsideWorkspace(file.path, workspace.rootPath)),
          );
          nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, file);
          bootFocusMode = "end";
        }
      } else {
        const workspace = await glyph.openDefaultWorkspace();
        if (workspace) {
          setWorkspace(workspace);
          setIsWorkspaceMode(true);
          nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
          if (workspace.activeFile) {
            nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, workspace.activeFile);
            bootFocusMode = "end";
          }
          nextExpandedFolders.add(workspace.rootPath);
        }
      }

      setSidebarNodes(nextSidebarNodes);
      setExpandedFolderPaths(Array.from(nextExpandedFolders));
      setHasHydratedSidebar(true);
      requestEditorFocus(bootFocusMode);
    };

    void boot();
  }, [pushHistory, requestEditorFocus, restoreSidebarNodes, setActiveFile, setWorkspace, glyph]);

  useEffect(
    () =>
      glyph.onUpdateStateChange((nextUpdateState) => {
        setUpdateState(nextUpdateState);
      }),
    [glyph],
  );

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await glyph.updateSettings(patch);
      setSettings(next);
      return next;
    },
    [glyph],
  );

  const syncTrackedPaths = useCallback(
    async (oldPath: string, nextPath?: string) => {
      if (!settings) {
        return;
      }

      const remap = (entries: string[]) =>
        Array.from(
          new Set(
            entries.flatMap((entry) => {
              if (!isSamePath(entry, oldPath)) {
                return [entry];
              }

              return nextPath ? [nextPath] : [];
            }),
          ),
        );

      await saveSettings({
        pinnedFiles: remap(settings.pinnedFiles),
      });
    },
    [saveSettings, settings],
  );

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
        await syncOpenedFile(file, { recordHistory: true });
      }
    });
  }, [syncOpenedFile, syncWorkspace, glyph]);

  useEffect(() => {
    return glyph.onWorkspaceChanged(
      async ({ rootPath: changedRootPath, tree: nextTree, changedPath }) => {
        setTree(nextTree);
        setSidebarNodes((prev) =>
          upsertSidebarFolder(prev, {
            rootPath: changedRootPath,
            tree: nextTree,
            activeFile: null,
          }),
        );

        if (changedPath === activeFile?.path && !isDirty) {
          const refreshedFile = await glyph.readFile(changedPath);
          updateActiveFile(refreshedFile);
        }
      },
    );
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
        const committedFileName = getCommittedDraftFileName(draftContent);

        if (isUntitled && committedFileName) {
          const previousPath = currentPath;
          finalFile = await glyph.renameFile(currentPath, committedFileName);
          setSidebarNodes((prev) =>
            upsertSidebarFile(renameSidebarFile(prev, currentPath, finalFile), finalFile),
          );
          currentPath = finalFile.path;
          updateActiveFile(finalFile);
          replaceHistoryPath(previousPath, finalFile.path);
          await syncTrackedPaths(previousPath, finalFile.path);
          requestEditorFocus("preserve");
        }

        const savedFile = await glyph.saveFile(currentPath, draftContent);
        markSaved(savedFile);
      } catch (saveError) {
        setSaving(false);
        setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeFile?.path,
    draftContent,
    glyph,
    isDirty,
    isSaving,
    markSaved,
    replaceHistoryPath,
    requestEditorFocus,
    setError,
    setSaving,
    syncTrackedPaths,
  ]);

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

  const togglePinnedFile = useCallback(
    async (filePath: string) => {
      const current = settings?.pinnedFiles ?? [];
      const nextPinnedFiles = current.some((entry) => isSamePath(entry, filePath))
        ? current.filter((entry) => !isSamePath(entry, filePath))
        : [filePath, ...current.filter((entry) => !isSamePath(entry, filePath))].slice(0, 12);

      await saveSettings({ pinnedFiles: nextPinnedFiles });
    },
    [saveSettings, settings?.pinnedFiles],
  );

  const toggleFocusMode = useCallback(async () => {
    await saveSettings({
      editorPreferences: {
        focusMode: !isFocusMode,
        showOutline,
      },
    });
  }, [isFocusMode, showOutline, saveSettings]);

  const toggleOutline = useCallback(async () => {
    await saveSettings({
      editorPreferences: {
        focusMode: isFocusMode,
        showOutline: !showOutline,
      },
    });
  }, [isFocusMode, showOutline, saveSettings]);

  const requestOutlineJump = useCallback((id: string) => {
    setOutlineJumpRequest({
      id,
      nonce: Date.now(),
    });
  }, []);

  const clearOutlineJumpRequest = useCallback(() => {
    setOutlineJumpRequest(null);
  }, []);

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

  const openFile = useCallback(
    async (filePath: string) => {
      const file = await glyph.readFile(filePath);
      await syncOpenedFile(file, { recordHistory: true });
    },
    [syncOpenedFile, glyph],
  );

  const createNote = useCallback(async () => {
    const baseDir = isWorkspaceMode ? rootPath : (settings?.defaultWorkspacePath ?? null);

    if (!baseDir) {
      return;
    }

    const file = await glyph.createFile(baseDir, `Untitled-${Date.now()}.md`);
    setActiveFile(file);
    setIsWorkspaceMode(true);
    setSidebarNodes((prev) => upsertSidebarFile(prev, file));
    const nextSettings = await glyph.getSettings();
    setSettings(nextSettings);
    pushHistory(file.path);
    setIsPaletteOpen(false);
    requestEditorFocus("start");
  }, [
    glyph,
    isWorkspaceMode,
    pushHistory,
    requestEditorFocus,
    rootPath,
    setActiveFile,
    settings?.defaultWorkspacePath,
  ]);

  const ensureActiveDraftFile = useCallback(
    async (draftValue: string) => {
      if (activeFile) {
        return activeFile;
      }

      if (draftFileCreationRef.current) {
        return draftFileCreationRef.current;
      }

      const baseDir = isWorkspaceMode ? rootPath : (settings?.defaultWorkspacePath ?? null);
      if (!baseDir) {
        return null;
      }

      const createPromise = (async () => {
        const committedFileName = getCommittedDraftFileName(draftValue);
        const draftFile = await glyph.createFile(baseDir, `Untitled-${Date.now()}.md`);
        let file = draftFile;

        if (committedFileName) {
          try {
            file = await glyph.renameFile(draftFile.path, committedFileName);
          } catch {
            file = draftFile;
          }
        }

        attachActiveFile(file);
        setIsWorkspaceMode(true);
        setSidebarNodes((prev) => upsertSidebarFile(prev, file));
        const nextSettings = await glyph.getSettings();
        setSettings(nextSettings);
        pushHistory(file.path);
        requestEditorFocus("preserve");
        return file;
      })();

      draftFileCreationRef.current = createPromise;

      try {
        return await createPromise;
      } finally {
        draftFileCreationRef.current = null;
      }
    },
    [
      activeFile,
      attachActiveFile,
      glyph,
      isWorkspaceMode,
      pushHistory,
      requestEditorFocus,
      rootPath,
      settings?.defaultWorkspacePath,
    ],
  );

  const handleDraftChange = useCallback(
    (nextContent: string) => {
      updateDraftContent(nextContent);

      if (!activeFile && getCommittedDraftFileName(nextContent)) {
        void ensureActiveDraftFile(nextContent).catch((error: unknown) => {
          setError(getErrorMessage(error));
        });
      }
    },
    [activeFile, ensureActiveDraftFile, setError, updateDraftContent],
  );

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

  const handleDeleteFile = useCallback(
    async (filePath: string) => {
      try {
        await glyph.deleteFile(filePath);
        setSidebarNodes((prev) => removeSidebarPath(prev, filePath));
        removeHistoryPath(filePath);
        await syncTrackedPaths(filePath);

        if (activeFile?.path === filePath) {
          setActiveFile(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete file");
      }
    },
    [activeFile?.path, glyph, removeHistoryPath, setActiveFile, setError, syncTrackedPaths],
  );

  const revealInFinder = useCallback(
    async (targetPath: string) => {
      try {
        await glyph.revealInFinder(targetPath);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Failed to ${folderRevealLabel.toLowerCase()}`,
        );
      }
    },
    [folderRevealLabel, glyph, setError],
  );

  const handleRenameFile = useCallback(
    async (filePath: string, newName: string) => {
      if (!newName.trim()) {
        return;
      }

      try {
        const renamedFile = await glyph.renameFile(filePath, newName);
        setSidebarNodes((prev) =>
          upsertSidebarFile(renameSidebarFile(prev, filePath, renamedFile), renamedFile),
        );
        replaceHistoryPath(filePath, renamedFile.path);
        await syncTrackedPaths(filePath, renamedFile.path);
        if (activeFile?.path === filePath) {
          setActiveFile(renamedFile);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename file");
      }
    },
    [activeFile?.path, glyph, replaceHistoryPath, setActiveFile, setError, syncTrackedPaths],
  );

  const handleRemoveFolder = useCallback(
    (folderPath: string) => {
      setSidebarNodes((prev) => removeSidebarPath(prev, folderPath));
      setExpandedFolderPaths((prev) => prev.filter((path) => !isPathInside(path, folderPath)));

      if (rootPath && isSamePath(rootPath, folderPath)) {
        setWorkspace({ rootPath: "", tree: [], activeFile: null });
        setIsWorkspaceMode(false);
      }
    },
    [rootPath, setWorkspace],
  );

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolderPaths((prev) =>
      prev.some((path) => isSamePath(path, folderPath))
        ? prev.filter((path) => !isSamePath(path, folderPath))
        : [...prev, folderPath],
    );
  }, []);

  const handleReorderNodes = useCallback(
    (sourcePath: string, targetPath: string, position: DragPosition) => {
      setSidebarNodes((prev) => reorderSidebarNodes(prev, sourcePath, targetPath, position));
    },
    [],
  );

  const shortcuts = useMemo(
    () => mergeShortcutSettings(settings?.shortcuts),
    [settings?.shortcuts],
  );

  // Stable commands list — only rebuilds when actions/shortcuts change, never on query change
  const baseCommands = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "new-note",
        title: "New note",
        subtitle: "Create a fresh markdown note",
        shortcut: getShortcutDisplay(shortcuts, "new-note"),
        section: "Actions",
        kind: "command",
        onSelect: () => void createNote(),
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
          if (file) await syncOpenedFile(file, { recordHistory: true });
          setIsPaletteOpen(false);
        },
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
          if (workspace) {
            syncWorkspace(workspace);
            setIsWorkspaceMode(true);
          }
          setIsPaletteOpen(false);
        },
      },
      {
        id: "settings",
        title: "Settings",
        subtitle: "Adjust workspace defaults",
        shortcut: getShortcutDisplay(shortcuts, "settings"),
        section: "Actions",
        kind: "command",
        onSelect: () => {
          setIsSettingsOpen(true);
          setIsPaletteOpen(false);
        },
      },
      {
        id: "navigate-back",
        title: "Navigate Back",
        subtitle: "Go to previous file in history",
        shortcut: getShortcutDisplay(shortcuts, "navigate-back"),
        section: "Navigation",
        kind: "command",
        onSelect: () => {
          void navigateBack();
          setIsPaletteOpen(false);
        },
      },
      {
        id: "navigate-forward",
        title: "Navigate Forward",
        subtitle: "Go to next file in history",
        shortcut: getShortcutDisplay(shortcuts, "navigate-forward"),
        section: "Navigation",
        kind: "command",
        onSelect: () => {
          void navigateForward();
          setIsPaletteOpen(false);
        },
      },
      {
        id: "toggle-focus-mode",
        title: isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode",
        shortcut: getShortcutDisplay(shortcuts, "focus-mode"),
        subtitle: "Hide navigation and keep the note centered",
        section: "View",
        kind: "command",
        onSelect: () => {
          void toggleFocusMode();
          setIsPaletteOpen(false);
        },
      },
      {
        id: "toggle-outline",
        title: showOutline ? "Hide Outline" : "Show Outline",
        subtitle: "Toggle the table of contents panel",
        section: "View",
        kind: "command",
        onSelect: () => {
          void toggleOutline();
          setIsPaletteOpen(false);
        },
      },
      ...(activeFile
        ? [
            {
              id: "pin-note",
              title: isActiveFilePinned ? "Unpin Current Note" : "Pin Current Note",
              subtitle: isActiveFilePinned
                ? "Remove it from quick access"
                : "Keep it near the top of the sidebar",
              section: "Note",
              kind: "command" as const,
              onSelect: () => {
                void togglePinnedFile(activeFile.path);
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
      {
        id: "theme-light",
        title: "Theme: Light",
        subtitle: "Switch to light mode",
        section: "Theme",
        kind: "command",
        onSelect: () => {
          void saveSettings({ themeMode: "light" });
          setIsPaletteOpen(false);
        },
      },
      {
        id: "theme-dark",
        title: "Theme: Dark",
        subtitle: "Switch to dark mode",
        section: "Theme",
        kind: "command",
        onSelect: () => {
          void saveSettings({ themeMode: "dark" });
          setIsPaletteOpen(false);
        },
      },
      {
        id: "theme-system",
        title: "Theme: System",
        subtitle: "Sync theme with system",
        section: "Theme",
        kind: "command",
        onSelect: () => {
          void saveSettings({ themeMode: "system" });
          setIsPaletteOpen(false);
        },
      },
    ],
    [
      activeFile,
      createNote,
      glyph,
      isActiveFilePinned,
      isFocusMode,
      navigateBack,
      navigateForward,
      toggleFocusMode,
      saveSettings,
      shortcuts,
      showOutline,
      syncOpenedFile,
      syncWorkspace,
      toggleFocusMode,
      toggleOutline,
      togglePinnedFile,
    ],
  );

  // Stable deduplicated file list — only rebuilds when sidebarNodes or files change, never on query change
  const allSearchableFiles = useMemo(() => {
    const seenPaths = new Set<string>();
    const result: Array<{ path: string; name: string; relativePath: string }> = [];

    const traverseSidebar = (nodes: DirectoryNode[], parentPath: string = "") => {
      for (const node of nodes) {
        if (node.type === "file") {
          const pathKey = toPathKey(node.path);
          if (!seenPaths.has(pathKey)) {
            seenPaths.add(pathKey);
            result.push({
              path: node.path,
              name: node.name,
              relativePath: parentPath ? `${parentPath}/${node.name}` : node.name,
            });
          }
        } else {
          traverseSidebar(node.children, parentPath ? `${parentPath}/${node.name}` : node.name);
        }
      }
    };
    traverseSidebar(sidebarNodes);

    for (const f of files) {
      const pathKey = toPathKey(f.path);
      if (!seenPaths.has(pathKey)) {
        seenPaths.add(pathKey);
        result.push(f);
      }
    }

    return result;
  }, [files, sidebarNodes]);

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

    // No query: show pinned notes + all commands
    if (!query) {
      return [...pinnedPaletteItems, ...baseCommands];
    }

    const items: CommandPaletteItem[] = [];

    // Match commands by title only — never subtitle (prevents false positives)
    const matchedCommands = baseCommands.filter((cmd) => cmd.title.toLowerCase().includes(query));
    items.push(...matchedCommands);
    items.push(
      ...pinnedPaletteItems.filter(
        (note) =>
          note.title.toLowerCase().includes(query) || note.subtitle?.toLowerCase().includes(query),
      ),
    );

    const pinnedPathKeys = new Set(pinnedNotes.map((note) => toPathKey(note.path)));

    // Match files by name or path
    const matchingFiles = allSearchableFiles.filter(
      (file) =>
        (file.name.toLowerCase().includes(query) ||
          file.relativePath.toLowerCase().includes(query)) &&
        !pinnedPathKeys.has(toPathKey(file.path)),
    );

    matchingFiles.slice(0, 12).forEach((file) => {
      items.push({
        id: file.path,
        title: file.name,
        subtitle: file.relativePath,
        hint: "File",
        section: "Files",
        kind: "file",
        onSelect: () => void openFile(file.path),
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
        onSelect: () => void openFile(result.path),
      });
    });

    return items;
  }, [allSearchableFiles, baseCommands, paletteQuery, openFile, pinnedNotes, searchResults]);

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
      const isEditableInput =
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable);

      if (event.key === "Escape" && !isEditableInput) {
        setIsPaletteOpen(false);
        setIsSettingsOpen(false);
        return;
      }

      // These shortcuts fire globally — even when the editor (contenteditable) is focused.
      const globalShortcutIds = new Set([
        "toggle-sidebar",
        "command-palette",
        "settings",
        "navigate-back",
        "navigate-forward",
        "focus-mode",
      ]);
      const globalShortcut = shortcuts.find(
        (entry) => globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys),
      );
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
          case "focus-mode":
            void toggleFocusMode();
            break;
        }
        return;
      }

      if (!isEditableInput) {
        const shortcut = shortcuts.find(
          (entry) => !globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys),
        );

        if (shortcut) {
          event.preventDefault();

          switch (shortcut.id) {
            case "new-note":
              void createNote();
              break;
            case "open-file": {
              const file = await glyph.openDocument();
              if (file) {
                await syncOpenedFile(file, { recordHistory: true });
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
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    shortcuts,
    activeFile,
    draftContent,
    markSaved,
    setError,
    setSaving,
    glyph,
    createNote,
    syncOpenedFile,
    syncWorkspace,
    navigateBack,
    navigateForward,
  ]);

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

      if (command === "focus-mode") {
        void toggleFocusMode();
        return;
      }

      if (command === "new-file") {
        await createNote();
        return;
      }

      if (command === "open-file") {
        const file = await glyph.openDocument();
        if (file) {
          await syncOpenedFile(file, { recordHistory: true });
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
  }, [
    activeFile,
    createNote,
    draftContent,
    markSaved,
    setError,
    setSaving,
    syncOpenedFile,
    syncWorkspace,
    glyph,
    toggleFocusMode,
  ]);

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

    const nextSettings = await saveSettings({
      defaultWorkspacePath: selection.path,
    });
    const workspace = await glyph.openFolder(nextSettings.defaultWorkspacePath);
    if (workspace) {
      syncWorkspace(workspace);
      setIsWorkspaceMode(true);
    }
  }, [saveSettings, syncWorkspace, glyph]);

  const changeThemeMode = useCallback(
    async (mode: ThemeMode) => {
      await saveSettings({ themeMode: mode });
    },
    [saveSettings],
  );

  const changeShortcuts = useCallback(
    async (nextShortcuts: AppSettings["shortcuts"]) => {
      await saveSettings({ shortcuts: nextShortcuts });
    },
    [saveSettings],
  );

  const triggerUpdateAction = useCallback(async () => {
    if (!appInfo?.updatesEnabled || !updateState) {
      return;
    }

    if (updateState.status === "downloaded") {
      await glyph.installUpdate();
      return;
    }

    if (updateState.status === "available") {
      await glyph.downloadUpdate();
      return;
    }

    if (
      updateState.status === "idle" ||
      updateState.status === "not-available" ||
      updateState.status === "error"
    ) {
      await glyph.checkForUpdates();
    }
  }, [appInfo?.updatesEnabled, glyph, updateState]);

  return {
    activeFile,
    appInfo,
    breadcrumbs,
    canGoBack,
    canGoForward,
    changeShortcuts,
    changeThemeMode,
    chooseFolderAndUpdateWorkspace,
    clearOutlineJumpRequest,
    createNote,
    draftContent,
    editorFocusRequest,
    error,
    files,
    folderRevealLabel,
    handleDeleteFile,
    handleRemoveFolder,
    handleRenameFile,
    handleReorderNodes,
    handleToggleFolder,
    isActiveFilePinned,
    isFocusMode,
    isPaletteOpen,
    isSaving,
    isSettingsOpen,
    isSidebarCollapsed,
    markSaved,
    navigateBack,
    navigateForward,
    openFile,
    outlineItems,
    outlineJumpRequest,
    paletteItems,
    paletteQuery,
    pinnedNotes,
    readingTime,
    revealInFinder,
    requestOutlineJump,
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
    showOutline,
    toggleFocusMode,
    togglePinnedFile,
    triggerUpdateAction,
    updateState,
    updateDraftContent: handleDraftChange,
    visibleSidebarNodes,
    wordCount,
  };
};
