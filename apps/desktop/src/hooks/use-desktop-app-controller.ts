import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BreadcrumbItem, OutlineItem } from "@/types/navigation";

import { getShortcutDisplay } from "@/shared/shortcuts";
import type { DirectoryNode, FileDocument } from "@/shared/workspace";
import { useSessionStore } from "@/store/session";
import { useWorkspaceStore } from "@/store/workspace";
import { applyTheme } from "@/theme/themes";

import { getErrorMessage } from "@/lib/errors";
import { buildBreadcrumbs, extractMarkdownOutline } from "@/lib/note-navigation";
import { isFileInsideWorkspace, isSamePath, normalizePath } from "@/lib/paths";
import { getFolderRevealLabel } from "@/lib/platform";
import {
  orderSidebarNodes,
  removeSidebarPath,
  renameSidebarFile,
  upsertSidebarFile,
  upsertSidebarFolder,
} from "@/lib/sidebar-tree";
import { flattenFiles } from "@/lib/workspace-tree";

import type { CommandPaletteItem } from "@/types/command-palette";

import { useSettingsController } from "./use-settings-controller";
import { useSidebarController } from "./use-sidebar-controller";
import { usePaletteController } from "./use-palette-controller";
import { useNavigationController } from "./use-navigation-controller";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

const toPathKey = (path: string) => normalizePath(path).toLowerCase();
const EMPTY_NOTE_NAME = "Untitled";
const NOTE_NAME_SAFE_CHAR_PATTERN = /[^a-zA-Z0-9-_\s]/g;
const TITLE_PREFIX_PATTERN = /^#+\s*/;
const NOTE_NAME_MAX_LENGTH = 50;
const APP_CHANGELOG_URL = "https://github.com/FALAK097/glyph/blob/main/CHANGELOG.md";

const getDraftTitleLine = (content: string) =>
  content.split(/\r?\n/, 1)[0]?.replace(TITLE_PREFIX_PATTERN, "").trim() ?? "";

const getDraftNoteName = (content: string) => {
  const safeName = getDraftTitleLine(content)
    .replace(NOTE_NAME_SAFE_CHAR_PATTERN, "")
    .trim()
    .substring(0, NOTE_NAME_MAX_LENGTH);

  return safeName && safeName !== EMPTY_NOTE_NAME ? safeName : null;
};

const hasCommittedDraftTitle = (content: string) =>
  /\r?\n/.test(content) && Boolean(getDraftTitleLine(content));

const getCommittedDraftFileName = (content: string) => {
  if (!hasCommittedDraftTitle(content)) {
    return null;
  }

  const safeName = getDraftNoteName(content);
  if (!safeName) {
    return null;
  }

  return `${safeName}.md`;
};

type UseDesktopAppControllerOptions = {
  initialFilePath?: string | null;
  initialWorkspacePath?: string | null;
  sessionReady?: boolean;
};

export const useDesktopAppController = (
  glyph: NonNullable<Window["glyph"]>,
  {
    initialFilePath = null,
    initialWorkspacePath = null,
    sessionReady = true,
  }: UseDesktopAppControllerOptions = {},
) => {
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
  } = useWorkspaceStore();
  const setNoteSession = useSessionStore((state) => state.setNoteSession);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(true);
  const [sidebarNodes, setSidebarNodes] = useState<DirectoryNode[]>([]);
  const [hasHydratedSidebar, setHasHydratedSidebar] = useState(false);
  const [editorFocusRequest, setEditorFocusRequest] = useState<{
    mode: "start" | "end" | "preserve";
    nonce: number;
  } | null>(null);
  const [hasBooted, setHasBooted] = useState(false);
  const [outlineJumpRequest, setOutlineJumpRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const editorFocusNonceRef = useRef(0);
  const draftFileCreationRef = useRef<Promise<FileDocument | null> | null>(null);

  // Settings controller
  const settingsController = useSettingsController({ glyph });
  const {
    settings,
    setSettings,
    appInfo,
    setAppInfo,
    updateState,
    setUpdateState,
    isSettingsOpen,
    setIsSettingsOpen,
    saveSettings,
    changeThemeMode,
    changeShortcuts,
    shortcuts,
  } = settingsController;

  // Sidebar controller
  const sidebarController = useSidebarController({
    glyph,
    settings,
    saveSettings,
    rootPath,
    setWorkspace,
    setIsWorkspaceMode,
    sidebarNodes,
    setSidebarNodes,
    hasHydratedSidebar,
    _setHasHydratedSidebar: setHasHydratedSidebar,
  });
  const {
    visibleSidebarNodes,
    hiddenFileKeys,
    setExpandedFolderPaths,
    restoreSidebarNodes,
    syncWorkspace,
    handleToggleFolder,
    handleReorderNodes,
    handleRemoveFolder,
  } = sidebarController;

  // Derived values
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

  const requestEditorFocus = useCallback((mode: "start" | "end" | "preserve") => {
    window.requestAnimationFrame(() => {
      editorFocusNonceRef.current += 1;
      setEditorFocusRequest({
        mode,
        nonce: editorFocusNonceRef.current,
      });
    });
  }, []);

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
        hiddenFiles: remap(settings.hiddenFiles),
        pinnedFiles: remap(settings.pinnedFiles),
      });
    },
    [saveSettings, settings],
  );

  const ensureFileVisible = useCallback(
    async (filePath: string) => {
      if (!(settings?.hiddenFiles ?? []).some((entry) => isSamePath(entry, filePath))) {
        return;
      }

      await saveSettings({
        hiddenFiles: (settings?.hiddenFiles ?? []).filter((entry) => !isSamePath(entry, filePath)),
      });
    },
    [saveSettings, settings?.hiddenFiles],
  );

  const syncOpenedFile = useCallback(
    async (file: FileDocument, options?: { recordHistory?: boolean }) => {
      await ensureFileVisible(file.path);
      const currentRootPath = useWorkspaceStore.getState().rootPath;
      const shouldPreserveFocus = useSessionStore.getState().hasDocumentScroll(file.path);
      setActiveFile(file);
      setIsWorkspaceMode(isFileInsideWorkspace(file.path, currentRootPath));
      setSidebarNodes((prev) => upsertSidebarFile(prev, file));
      if (options?.recordHistory) {
        pushHistory(file.path);
      }
      requestEditorFocus(shouldPreserveFocus ? "preserve" : "end");
      setIsPaletteOpen(false);
    },
    [ensureFileVisible, pushHistory, requestEditorFocus, setActiveFile],
  );

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

    setIsPaletteOpen(false);
    const file = await glyph.createFile(baseDir, `Untitled-${Date.now()}.md`);
    setActiveFile(file);
    setIsWorkspaceMode(true);
    setSidebarNodes((prev) => upsertSidebarFile(prev, file));
    pushHistory(file.path);
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
          } catch (renameError) {
            console.error("Failed to rename draft file to committed name.", {
              draftFilePath: draftFile.path,
              committedFileName,
              error: renameError,
            });
            file = draftFile;
          }
        }

        attachActiveFile(file);
        setIsWorkspaceMode(true);
        setSidebarNodes((prev) => upsertSidebarFile(prev, file));
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

      if (!activeFile && hasCommittedDraftTitle(nextContent)) {
        void ensureActiveDraftFile(nextContent).catch((error: unknown) => {
          setError(getErrorMessage(error));
        });
      }
    },
    [activeFile, ensureActiveDraftFile, setError, updateDraftContent],
  );

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

  const handleRemoveFileFromGlyph = useCallback(
    async (filePath: string) => {
      try {
        if (activeFile?.path && isSamePath(activeFile.path, filePath) && isDirty) {
          const savedFile = await glyph.saveFile(filePath, draftContent);
          markSaved(savedFile);
        }

        const nextHiddenFiles = [
          filePath,
          ...(settings?.hiddenFiles ?? []).filter((entry) => !isSamePath(entry, filePath)),
        ];
        const nextPinnedFiles = (settings?.pinnedFiles ?? []).filter(
          (entry) => !isSamePath(entry, filePath),
        );

        await saveSettings({
          hiddenFiles: nextHiddenFiles,
          pinnedFiles: nextPinnedFiles,
        });
        removeHistoryPath(filePath);

        if (activeFile?.path && isSamePath(activeFile.path, filePath)) {
          setActiveFile(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove note from Glyph");
      }
    },
    [
      activeFile?.path,
      draftContent,
      glyph,
      isDirty,
      markSaved,
      removeHistoryPath,
      saveSettings,
      setActiveFile,
      setError,
      settings?.hiddenFiles,
      settings?.pinnedFiles,
    ],
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

  const triggerUpdateAction = useCallback(async () => {
    if (!updateState) {
      return;
    }

    const shouldOpenChangelog =
      Boolean(updateState.recentlyInstalledVersion) &&
      (updateState.status === "idle" || updateState.status === "not-available");
    if (shouldOpenChangelog) {
      await glyph.openExternal(APP_CHANGELOG_URL);
      return;
    }

    if (!appInfo?.updatesEnabled || appInfo.updatesMode === "none") {
      return;
    }

    if (appInfo.updatesMode === "manual") {
      if (updateState.status === "available" && updateState.releasePageUrl) {
        await glyph.openExternal(updateState.releasePageUrl);
        return;
      }

      if (
        updateState.status === "idle" ||
        updateState.status === "not-available" ||
        updateState.status === "error"
      ) {
        await glyph.checkForUpdates();
      }

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
  }, [appInfo?.updatesEnabled, appInfo?.updatesMode, glyph, updateState]);

  const updateActionConfig = useMemo(() => {
    if (!appInfo?.updatesEnabled || !updateState) {
      return null;
    }

    const shouldOpenChangelog =
      Boolean(updateState.recentlyInstalledVersion) &&
      (updateState.status === "idle" || updateState.status === "not-available");
    if (shouldOpenChangelog) {
      return {
        title: "View Changelog",
        subtitle: `See what's new in Glyph ${updateState.recentlyInstalledVersion ?? ""}`.trim(),
        isDisabled: false,
      };
    }

    const isManualReleaseAction =
      appInfo.updatesMode === "manual" &&
      updateState.status === "available" &&
      Boolean(updateState.releasePageUrl);
    if (isManualReleaseAction) {
      return {
        title: "Download Latest Release",
        subtitle: "Open GitHub Releases to download and install manually",
        isDisabled: false,
      };
    }

    if (updateState.status === "downloaded") {
      return {
        title: "Restart to Update",
        subtitle: updateState.errorMessage
          ? `Restart Glyph to retry the update. ${updateState.errorMessage}`
          : "Restart Glyph to install the downloaded release",
        isDisabled: false,
      };
    }

    if (updateState.status === "downloading") {
      return {
        title: `Downloading ${Math.round(updateState.progressPercent ?? 0)}%`,
        subtitle: "Glyph is downloading the latest release in the background",
        isDisabled: true,
      };
    }

    if (updateState.status === "checking") {
      return {
        title: "Checking for Updates",
        subtitle: "Glyph is checking whether a newer release is available",
        isDisabled: true,
      };
    }

    if (updateState.status === "available") {
      return {
        title: updateState.errorMessage ? "Retry Update" : "Update Available",
        subtitle: updateState.errorMessage
          ? `Glyph hit an update error. ${updateState.errorMessage}`
          : "Download the available Glyph update",
        isDisabled: false,
      };
    }

    if (updateState.status === "error") {
      return {
        title: "Retry Update",
        subtitle: updateState.errorMessage ?? "Retry checking for updates",
        isDisabled: false,
      };
    }

    return {
      title: "Check for Updates",
      subtitle: "Check whether a new Glyph release is available",
      isDisabled: false,
    };
  }, [appInfo?.updatesEnabled, appInfo?.updatesMode, updateState]);

  // All searchable files for palette
  const allSearchableFiles = useMemo(() => {
    const seenPaths = new Set<string>();
    const result: Array<{ path: string; name: string; relativePath: string }> = [];

    const traverseSidebar = (nodes: DirectoryNode[], parentPath: string = "") => {
      for (const node of nodes) {
        if (node.type === "file") {
          const pathKey = toPathKey(node.path);
          if (!hiddenFileKeys.has(pathKey) && !seenPaths.has(pathKey)) {
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
      if (!hiddenFileKeys.has(pathKey) && !seenPaths.has(pathKey)) {
        seenPaths.add(pathKey);
        result.push(f);
      }
    }

    return result;
  }, [files, hiddenFileKeys, sidebarNodes]);

  // Navigation controller
  const navigationController = useNavigationController({
    glyph,
    syncOpenedFile,
  });
  const { canGoBack, canGoForward, navigateBack, navigateForward } = navigationController;

  // Base commands — only rebuilds when actions/shortcuts change
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
      ...(updateActionConfig
        ? [
            {
              id: "check-updates",
              title: updateActionConfig.title,
              subtitle: updateActionConfig.subtitle,
              shortcut: getShortcutDisplay(shortcuts, "check-updates"),
              section: "Actions",
              kind: "command" as const,
              onSelect: () => {
                if (!updateActionConfig.isDisabled) {
                  void triggerUpdateAction();
                }
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
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
      saveSettings,
      shortcuts,
      showOutline,
      triggerUpdateAction,
      syncOpenedFile,
      syncWorkspace,
      toggleFocusMode,
      toggleOutline,
      togglePinnedFile,
      updateActionConfig,
    ],
  );

  // Palette controller
  const paletteController = usePaletteController({
    glyph,
    settings,
    shortcuts,
    isPaletteOpen,
    isWorkspaceMode,
    sidebarNodes,
    hiddenFileKeys,
    allSearchableFiles,
    activeFile,
    baseCommands,
    openFile,
    setIsPaletteOpen,
  });
  const { paletteQuery, setPaletteQuery, paletteItems, pinnedNotes } = paletteController;

  // Keyboard shortcuts
  useKeyboardShortcuts({
    glyph,
    shortcuts,
    activeFile,
    draftContent,
    markSaved,
    setError,
    setSaving,
    createNote,
    syncOpenedFile,
    syncWorkspace,
    setIsWorkspaceMode,
    navigateBack,
    navigateForward,
    triggerUpdateAction,
    isPaletteOpen,
    isSettingsOpen,
    setIsPaletteOpen,
    setIsSettingsOpen,
    setIsSidebarCollapsed,
    toggleFocusMode,
  });

  // Boot sequence
  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    let isCancelled = false;

    const boot = async () => {
      setHasBooted(false);
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
      let bootFocusMode: "start" | "end" | "preserve" = "start";
      const tryOpenWorkspace = async (targetPath: string | null) => {
        if (targetPath) {
          try {
            const existingWorkspace = await glyph.getSidebarNode("directory", targetPath);
            if (existingWorkspace) {
              return await glyph.openFolder(targetPath);
            }
          } catch {
            // Fall back to the default workspace if the persisted root is no longer available.
          }
        }

        try {
          return await glyph.openDefaultWorkspace();
        } catch {
          return null;
        }
      };
      const tryReadPersistedFile = async (targetPath: string | null) => {
        if (!targetPath) {
          return null;
        }

        try {
          return await glyph.readFile(targetPath);
        } catch {
          return null;
        }
      };

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
          const workspace = await tryOpenWorkspace(null);
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
        const workspace = await tryOpenWorkspace(initialWorkspacePath);
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

        const restoredFile = await tryReadPersistedFile(initialFilePath);
        if (restoredFile) {
          setActiveFile(restoredFile);
          setIsWorkspaceMode(
            Boolean(workspace && isFileInsideWorkspace(restoredFile.path, workspace.rootPath)),
          );
          nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, restoredFile);
          bootFocusMode = "preserve";
        }
      }

      if (isCancelled) {
        return;
      }

      setSidebarNodes(nextSidebarNodes);
      setExpandedFolderPaths(Array.from(nextExpandedFolders));
      setHasHydratedSidebar(true);
      requestEditorFocus(bootFocusMode);
      setHasBooted(true);
    };

    void boot();

    return () => {
      isCancelled = true;
    };
  }, [
    glyph,
    initialFilePath,
    initialWorkspacePath,
    pushHistory,
    requestEditorFocus,
    restoreSidebarNodes,
    sessionReady,
    setActiveFile,
    setWorkspace,
    setSettings,
    setAppInfo,
    setUpdateState,
    setExpandedFolderPaths,
  ]);

  // External file handler
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

  // Workspace change handler
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

  // Auto-save draft content
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
        setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
      } finally {
        setSaving(false);
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

  // Session sync
  useEffect(() => {
    if (!sessionReady || !hasBooted) {
      return;
    }

    setNoteSession(rootPath || null, activeFile?.path ?? null);
  }, [activeFile?.path, hasBooted, rootPath, sessionReady, setNoteSession]);

  const requestOutlineJump = useCallback((id: string) => {
    setOutlineJumpRequest({
      id,
      nonce: Date.now(),
    });
  }, []);

  const clearOutlineJumpRequest = useCallback(() => {
    setOutlineJumpRequest(null);
  }, []);

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

  const saveStateLabel = useMemo(
    () =>
      isSaving
        ? "Saving..."
        : isDirty
          ? "Unsaved"
          : lastSavedAt
            ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "Ready",
    [isSaving, isDirty, lastSavedAt],
  );

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

  // Command IPC handler
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

      if (command === "check-updates") {
        await triggerUpdateAction();
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
    triggerUpdateAction,
    setIsPaletteOpen,
    setIsSidebarCollapsed,
  ]);

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
    handleRemoveFileFromGlyph,
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
    setIsPaletteOpen,
    setIsSettingsOpen,
    setIsSidebarCollapsed,
    setPaletteQuery,
    settings,
    shortcuts,
    showOutline,
    toggleFocusMode,
    toggleOutline,
    togglePinnedFile,
    triggerUpdateAction,
    updateState,
    updateDraftContent: handleDraftChange,
    visibleSidebarNodes,
    wordCount,
    hasBooted,
  };
};
