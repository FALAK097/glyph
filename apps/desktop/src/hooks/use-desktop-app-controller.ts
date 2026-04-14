import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { BreadcrumbItem, OutlineItem } from "@/types/navigation";

import {
  getAdjacentTabShortcutDisplay,
  getDirectTabShortcutDisplay,
  getDirectTabTargetIndex,
  getShortcutDisplay,
} from "@/shared/shortcuts";
import type { DirectoryNode, FileDocument, TabMovePosition } from "@/shared/workspace";
import { useLayoutStore } from "@/store/layout";
import { useSessionStore } from "@/store/session";
import { useWorkspaceStore } from "@/store/workspace";
import { applyTheme } from "@/theme/themes";

import { getErrorMessage } from "@/lib/errors";
import { buildBreadcrumbs, extractMarkdownOutline } from "@/lib/note-navigation";
import {
  getDirName,
  getRelativePath,
  isFileInsideWorkspace,
  isSamePath,
  normalizePath,
} from "@/lib/paths";
import { getFolderRevealLabel } from "@/lib/platform";
import {
  orderSidebarNodes,
  removeSidebarPath,
  renameSidebarFile,
  renameSidebarFolder,
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
const APP_RELEASES_URL = "https://github.com/FALAK097/glyph/releases";

const getRenamedFolderFilePath = (
  oldFolderPath: string,
  newFolderPath: string,
  filePath: string,
) => {
  const normalizedOldFolderPath = normalizePath(oldFolderPath).replace(/\/+$/, "");
  const normalizedNewFolderPath = normalizePath(newFolderPath).replace(/\/+$/, "");
  const suffix = normalizePath(filePath).slice(normalizedOldFolderPath.length);

  return `${normalizedNewFolderPath}${suffix}`;
};

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
  initialTabPaths?: string[];
  initialWorkspacePath?: string | null;
  sessionReady?: boolean;
};

export const useDesktopAppController = (
  glyph: NonNullable<Window["glyph"]>,
  {
    initialFilePath = null,
    initialTabPaths = [],
    initialWorkspacePath = null,
    sessionReady = true,
  }: UseDesktopAppControllerOptions = {},
) => {
  const {
    rootPath,
    tree,
    noteTabs,
    activeTabId,
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
    markTabSaved,
    setSaving,
    setTabSaving,
    setError,
    navigationHistory,
    activateTab,
    closeTab,
    closeOtherTabs,
    moveTab,
    removeTabsInFolder,
    replaceTabPath,
    remapTabsForFolderRename,
    getActiveTab,
    getTabByPath,
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
  const [findRequest, setFindRequest] = useState<{
    nonce: number;
  } | null>(null);
  const [hasBooted, setHasBooted] = useState(false);
  const [outlineJumpRequest, setOutlineJumpRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const editorFocusNonceRef = useRef(0);
  const draftFileCreationRef = useRef<Promise<FileDocument | null> | null>(null);
  const lastCreatedFolderPathRef = useRef<string | null>(null);

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
    syncWorkspace: _syncWorkspace,
    handleToggleFolder,
    handleReorderNodes,
    handleRemoveFolder,
  } = sidebarController;

  // Wrap syncWorkspace to clear the stale lastCreatedFolderPath whenever the
  // active workspace changes. Without this, creating a folder in workspace A
  // then switching to workspace B would make the next note land in workspace A.
  const syncWorkspace = useCallback(
    (workspace: Parameters<typeof _syncWorkspace>[0]) => {
      lastCreatedFolderPathRef.current = null;
      _syncWorkspace(workspace);
    },
    [_syncWorkspace],
  );

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
  const editorScale = editorPreferences?.editorScale ?? 100;
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

  const requestFindInNote = useCallback(() => {
    if (!activeFile) {
      return;
    }

    setIsPaletteOpen(false);
    setIsSettingsOpen(false);
    setFindRequest({
      nonce: Date.now(),
    });
  }, [activeFile, setIsPaletteOpen, setIsSettingsOpen]);

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

  const persistNoteDraft = useCallback(
    async (
      target: {
        draftContent: string;
        file: FileDocument;
        isDirty: boolean;
      },
      options?: {
        isActive?: boolean;
        restoreFocus?: boolean;
      },
    ) => {
      if (!target.isDirty) {
        return target.file.path;
      }

      let currentPath = target.file.path;
      setTabSaving(currentPath, true);
      if (options?.isActive) {
        setSaving(true);
      }

      try {
        let nextFile = target.file;
        const committedFileName = getCommittedDraftFileName(target.draftContent);

        if (target.file.name.startsWith("Untitled-") && committedFileName) {
          const previousPath = currentPath;
          nextFile = await glyph.renameFile(currentPath, committedFileName);
          setSidebarNodes((prev) =>
            upsertSidebarFile(renameSidebarFile(prev, currentPath, nextFile), nextFile),
          );
          replaceTabPath(previousPath, nextFile);
          replaceHistoryPath(previousPath, nextFile.path);
          await syncTrackedPaths(previousPath, nextFile.path);
          useLayoutStore.getState().replaceTabId(toPathKey(previousPath), toPathKey(nextFile.path));
          currentPath = nextFile.path;

          if (options?.restoreFocus) {
            requestEditorFocus("preserve");
          }
        }

        const savedFile = await glyph.saveFile(currentPath, target.draftContent);
        if (
          options?.isActive &&
          isSamePath(useWorkspaceStore.getState().activeFile?.path, currentPath)
        ) {
          markSaved(savedFile);
        } else {
          markTabSaved(currentPath, savedFile);
        }

        return currentPath;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
        return null;
      } finally {
        setTabSaving(currentPath, false);
        if (options?.isActive) {
          setSaving(false);
        }
      }
    },
    [
      glyph,
      markSaved,
      markTabSaved,
      replaceHistoryPath,
      replaceTabPath,
      requestEditorFocus,
      setError,
      setSaving,
      setTabSaving,
      syncTrackedPaths,
    ],
  );

  const syncOpenedFile = useCallback(
    async (file: FileDocument, options?: { recordHistory?: boolean }) => {
      const currentActiveTab = getActiveTab();
      if (currentActiveTab && !isSamePath(currentActiveTab.file.path, file.path)) {
        void persistNoteDraft(
          {
            draftContent: currentActiveTab.draftContent,
            file: currentActiveTab.file,
            isDirty: currentActiveTab.isDirty,
          },
          {
            isActive: true,
          },
        );
      }

      await ensureFileVisible(file.path);
      const currentRootPath = useWorkspaceStore.getState().rootPath;
      const shouldPreserveFocus = useSessionStore.getState().hasDocumentScroll(file.path);
      setActiveFile(file);
      useLayoutStore
        .getState()
        .addTabToPane(useLayoutStore.getState().activePaneId, toPathKey(file.path));
      setIsWorkspaceMode(isFileInsideWorkspace(file.path, currentRootPath));
      setSidebarNodes((prev) => upsertSidebarFile(prev, file));
      if (options?.recordHistory) {
        pushHistory(file.path);
      }
      requestEditorFocus(shouldPreserveFocus ? "preserve" : "end");
      setIsPaletteOpen(false);
      // Clear the last-created folder so the next note goes next to the opened file
      lastCreatedFolderPathRef.current = null;
    },
    [
      ensureFileVisible,
      getActiveTab,
      persistNoteDraft,
      pushHistory,
      requestEditorFocus,
      setActiveFile,
    ],
  );

  const activateNoteTab = useCallback(
    async (filePath: string, options?: { recordHistory?: boolean }) => {
      const targetTab = getTabByPath(filePath);
      if (!targetTab) {
        return;
      }

      const currentActiveTab = getActiveTab();
      if (currentActiveTab && !isSamePath(currentActiveTab.file.path, filePath)) {
        void persistNoteDraft(
          {
            draftContent: currentActiveTab.draftContent,
            file: currentActiveTab.file,
            isDirty: currentActiveTab.isDirty,
          },
          {
            isActive: true,
          },
        );
      }

      const currentRootPath = useWorkspaceStore.getState().rootPath;
      const shouldPreserveFocus = useSessionStore.getState().hasDocumentScroll(filePath);
      activateTab(filePath);
      useLayoutStore
        .getState()
        .activateTabInPane(useLayoutStore.getState().activePaneId, toPathKey(filePath));
      setIsWorkspaceMode(isFileInsideWorkspace(filePath, currentRootPath));
      if (options?.recordHistory) {
        pushHistory(filePath);
      }
      requestEditorFocus(shouldPreserveFocus ? "preserve" : "end");
      setIsPaletteOpen(false);
      lastCreatedFolderPathRef.current = null;
    },
    [activateTab, getActiveTab, getTabByPath, persistNoteDraft, pushHistory, requestEditorFocus],
  );

  const closeNoteTab = useCallback(
    async (filePath: string) => {
      const targetTab = getTabByPath(filePath);
      if (!targetTab) {
        return;
      }

      const isClosingActiveTab = isSamePath(activeFile?.path, filePath);
      let targetPath = filePath;
      if (targetTab.isDirty) {
        const savedPath = await persistNoteDraft(
          {
            draftContent: targetTab.draftContent,
            file: targetTab.file,
            isDirty: targetTab.isDirty,
          },
          {
            isActive: isClosingActiveTab,
            restoreFocus: isClosingActiveTab,
          },
        );

        if (!savedPath) {
          return;
        }

        targetPath = savedPath;
      }

      const nextActivePath = closeTab(targetPath);
      if (nextActivePath) {
        const currentRootPath = useWorkspaceStore.getState().rootPath;
        const shouldPreserveFocus = useSessionStore.getState().hasDocumentScroll(nextActivePath);
        setIsWorkspaceMode(isFileInsideWorkspace(nextActivePath, currentRootPath));
        requestEditorFocus(shouldPreserveFocus ? "preserve" : "end");
      }
    },
    [activeFile?.path, closeTab, getTabByPath, persistNoteDraft, requestEditorFocus],
  );

  const closeOtherNoteTabs = useCallback(
    async (filePath: string) => {
      const otherTabs = useWorkspaceStore
        .getState()
        .noteTabs.filter((tab) => !isSamePath(tab.file.path, filePath));
      for (const tab of otherTabs) {
        if (!tab.isDirty) {
          continue;
        }

        const savedPath = await persistNoteDraft(
          {
            draftContent: tab.draftContent,
            file: tab.file,
            isDirty: tab.isDirty,
          },
          {
            isActive: isSamePath(activeFile?.path, tab.file.path),
          },
        );

        if (!savedPath) {
          return;
        }
      }
      closeOtherTabs(filePath);
    },
    [activeFile?.path, closeOtherTabs, persistNoteDraft],
  );

  const moveNoteTab = useCallback(
    (sourcePath: string, targetPath: string, position: TabMovePosition) => {
      moveTab(sourcePath, targetPath, position);
    },
    [moveTab],
  );

  // ── Split view methods ───────────────────────────────────────────

  const closeTabFromActivePane = useCallback(
    async (filePath: string) => {
      const tabId = toPathKey(filePath);
      const layoutState = useLayoutStore.getState();
      const paneState = layoutState.panes[layoutState.activePaneId];
      if (!paneState || !paneState.tabIds.includes(tabId)) {
        return;
      }

      // Save dirty tab first
      const targetTab = getTabByPath(filePath);
      if (targetTab?.isDirty) {
        const isClosingActiveTab = isSamePath(activeFile?.path, filePath);
        const savedPath = await persistNoteDraft(
          {
            draftContent: targetTab.draftContent,
            file: targetTab.file,
            isDirty: targetTab.isDirty,
          },
          {
            isActive: isClosingActiveTab,
            restoreFocus: isClosingActiveTab,
          },
        );
        if (!savedPath) return;
      }

      // Remove from layout pane
      useLayoutStore.getState().removeTabFromPane(layoutState.activePaneId, tabId);

      // Check if tab still exists in another pane
      const updatedLayout = useLayoutStore.getState();
      const tabStillInOtherPane = Object.entries(updatedLayout.panes).some(
        ([paneId, ps]) => paneId !== layoutState.activePaneId && ps.tabIds.includes(tabId),
      );

      if (!tabStillInOtherPane) {
        // Tab not in any other pane — close from workspace store too
        closeTab(filePath);
      }

      // Sync workspace active tab to the pane's new active tab
      const currentPaneState = updatedLayout.panes[layoutState.activePaneId];
      if (currentPaneState?.activeTabId) {
        const nextTab = useWorkspaceStore
          .getState()
          .noteTabs.find((t) => t.id === currentPaneState.activeTabId);
        if (nextTab) {
          activateTab(nextTab.file.path);
          const currentRootPath = useWorkspaceStore.getState().rootPath;
          setIsWorkspaceMode(isFileInsideWorkspace(nextTab.file.path, currentRootPath));
          const shouldPreserveFocus = useSessionStore
            .getState()
            .hasDocumentScroll(nextTab.file.path);
          requestEditorFocus(shouldPreserveFocus ? "preserve" : "end");
        }
      }
    },
    [activeFile?.path, activateTab, closeTab, getTabByPath, persistNoteDraft, requestEditorFocus],
  );

  const splitRight = useCallback(() => {
    const layoutState = useLayoutStore.getState();
    const paneState = layoutState.panes[layoutState.activePaneId];
    if (!paneState?.activeTabId) return;
    useLayoutStore.getState().splitPane("horizontal");
  }, []);

  const splitDown = useCallback(() => {
    const layoutState = useLayoutStore.getState();
    const paneState = layoutState.panes[layoutState.activePaneId];
    if (!paneState?.activeTabId) return;
    useLayoutStore.getState().splitPane("vertical");
  }, []);

  const closeActivePane = useCallback(() => {
    const layoutState = useLayoutStore.getState();
    // Don't close the last pane
    if (Object.keys(layoutState.panes).length <= 1) return;

    const closingPaneId = layoutState.activePaneId;
    const closingPaneState = layoutState.panes[closingPaneId];

    useLayoutStore.getState().closePane(closingPaneId);

    // Clean up tabs that are no longer in any pane
    if (closingPaneState) {
      const updatedLayout = useLayoutStore.getState();
      for (const tabId of closingPaneState.tabIds) {
        const stillExists = Object.values(updatedLayout.panes).some((ps) =>
          ps.tabIds.includes(tabId),
        );
        if (!stillExists) {
          // Find the tab by ID and close it from workspace
          const tab = useWorkspaceStore.getState().noteTabs.find((t) => t.id === tabId);
          if (tab) {
            closeTab(tab.file.path);
          }
        }
      }
    }

    // Sync workspace active tab to new active pane
    const updatedLayout = useLayoutStore.getState();
    const newPaneState = updatedLayout.panes[updatedLayout.activePaneId];
    if (newPaneState?.activeTabId) {
      const nextTab = useWorkspaceStore
        .getState()
        .noteTabs.find((t) => t.id === newPaneState.activeTabId);
      if (nextTab) {
        activateTab(nextTab.file.path);
        requestEditorFocus("preserve");
      }
    }
  }, [activateTab, closeTab, requestEditorFocus]);

  const focusNextPane = useCallback(() => {
    useLayoutStore.getState().focusNextPane();
    const updatedLayout = useLayoutStore.getState();
    const paneState = updatedLayout.panes[updatedLayout.activePaneId];
    if (paneState?.activeTabId) {
      const nextTab = useWorkspaceStore
        .getState()
        .noteTabs.find((t) => t.id === paneState.activeTabId);
      if (nextTab) {
        activateTab(nextTab.file.path);
        requestEditorFocus("preserve");
      }
    }
  }, [activateTab, requestEditorFocus]);

  const focusPreviousPane = useCallback(() => {
    useLayoutStore.getState().focusPreviousPane();
    const updatedLayout = useLayoutStore.getState();
    const paneState = updatedLayout.panes[updatedLayout.activePaneId];
    if (paneState?.activeTabId) {
      const nextTab = useWorkspaceStore
        .getState()
        .noteTabs.find((t) => t.id === paneState.activeTabId);
      if (nextTab) {
        activateTab(nextTab.file.path);
        requestEditorFocus("preserve");
      }
    }
  }, [activateTab, requestEditorFocus]);

  const activateTabByIndex = useCallback(
    async (index: number) => {
      const layoutState = useLayoutStore.getState();
      const paneState = layoutState.panes[layoutState.activePaneId];
      if (!paneState) return;

      const paneTabs = paneState.tabIds
        .map((id) => useWorkspaceStore.getState().noteTabs.find((t) => t.id === id))
        .filter(Boolean);
      const targetIndex = getDirectTabTargetIndex(index, paneTabs.length);
      if (targetIndex === null) {
        return;
      }

      const targetTab = paneTabs[targetIndex];
      if (!targetTab) {
        return;
      }

      await activateNoteTab(targetTab.file.path, { recordHistory: true });
    },
    [activateNoteTab],
  );

  const activateAdjacentNoteTab = useCallback(
    async (direction: -1 | 1) => {
      const layoutState = useLayoutStore.getState();
      const paneState = layoutState.panes[layoutState.activePaneId];
      if (!paneState || paneState.tabIds.length <= 1 || !paneState.activeTabId) {
        return;
      }

      const currentIndex = paneState.tabIds.indexOf(paneState.activeTabId);
      if (currentIndex < 0) {
        return;
      }

      const targetIndex =
        (currentIndex + direction + paneState.tabIds.length) % paneState.tabIds.length;
      const targetTabId = paneState.tabIds[targetIndex];
      if (!targetTabId) {
        return;
      }

      const targetTab = useWorkspaceStore.getState().noteTabs.find((t) => t.id === targetTabId);
      if (!targetTab) {
        return;
      }

      await activateNoteTab(targetTab.file.path, { recordHistory: true });
    },
    [activateNoteTab],
  );

  const openFile = useCallback(
    async (filePath: string) => {
      const existingTab = getTabByPath(filePath);
      if (existingTab) {
        await activateNoteTab(existingTab.file.path, { recordHistory: true });
        return;
      }

      const file = await glyph.readFile(filePath);
      await syncOpenedFile(file, { recordHistory: true });
    },
    [activateNoteTab, getTabByPath, syncOpenedFile, glyph],
  );

  const createNote = useCallback(async () => {
    let baseDir: string | null = null;

    // Prefer the last created folder so a new note lands inside it.
    // This works regardless of workspace mode — the folder path is always valid.
    const lastFolder = lastCreatedFolderPathRef.current;
    if (lastFolder) {
      baseDir = lastFolder;
    } else if (isWorkspaceMode && rootPath) {
      const activeFileDir = activeFile ? getDirName(activeFile.path) : null;
      baseDir =
        activeFileDir && isFileInsideWorkspace(activeFileDir, rootPath) ? activeFileDir : rootPath;
    } else if (activeFile) {
      baseDir = getDirName(activeFile.path);
    } else if (settings?.defaultWorkspacePath) {
      baseDir = settings.defaultWorkspacePath;
    }

    if (!baseDir) {
      return;
    }

    const currentActiveTab = getActiveTab();
    if (currentActiveTab) {
      void persistNoteDraft(
        {
          draftContent: currentActiveTab.draftContent,
          file: currentActiveTab.file,
          isDirty: currentActiveTab.isDirty,
        },
        {
          isActive: true,
        },
      );
    }

    setIsPaletteOpen(false);
    const file = await glyph.createFile(baseDir, `Untitled-${Date.now()}.md`);
    setActiveFile(file);
    useLayoutStore
      .getState()
      .addTabToPane(useLayoutStore.getState().activePaneId, toPathKey(file.path));
    setIsWorkspaceMode(true);

    // Find which top-level workspace directory node owns the new file.
    // Using sidebarNodes rather than rootPath correctly handles the case where
    // multiple workspaces are open and the file lands in a non-default one.
    const ownerNode = sidebarNodes.find(
      (node) => node.type === "directory" && isFileInsideWorkspace(file.path, node.path),
    );

    if (ownerNode?.type === "directory") {
      const workspaceNode = await glyph.getSidebarNode("directory", ownerNode.path);
      if (workspaceNode?.type === "directory") {
        setSidebarNodes((prev) =>
          upsertSidebarFolder(prev, {
            rootPath: ownerNode.path,
            tree: workspaceNode.children,
            activeFile: null,
          }),
        );
      }
    } else {
      setSidebarNodes((prev) => upsertSidebarFile(prev, file));
    }

    pushHistory(file.path);
    requestEditorFocus("start");
  }, [
    activeFile,
    getActiveTab,
    glyph,
    isWorkspaceMode,
    persistNoteDraft,
    pushHistory,
    requestEditorFocus,
    rootPath,
    setActiveFile,
    settings?.defaultWorkspacePath,
    setIsPaletteOpen,
    setSidebarNodes,
    sidebarNodes,
  ]);

  const createFolder = useCallback(async () => {
    let baseDir: string | null = null;

    if (isWorkspaceMode && rootPath) {
      const activeFileDir = activeFile ? getDirName(activeFile.path) : null;
      baseDir =
        activeFileDir && isFileInsideWorkspace(activeFileDir, rootPath) ? activeFileDir : rootPath;
    } else if (activeFile) {
      baseDir = getDirName(activeFile.path);
    } else if (settings?.defaultWorkspacePath) {
      baseDir = settings.defaultWorkspacePath;
    }

    if (!baseDir) {
      return;
    }

    setIsPaletteOpen(false);
    const folderName = `New Folder-${Date.now()}`;
    const nextTree = await glyph.createFolder(baseDir, folderName);

    // Track the created folder path so the next createNote uses it as its parent
    lastCreatedFolderPathRef.current = `${baseDir}/${folderName}`.replace(/\\/g, "/");

    if (nextTree !== null) {
      // Folder is inside the active workspace — use the returned tree directly.
      if (rootPath) {
        setSidebarNodes((prev) =>
          upsertSidebarFolder(prev, { rootPath, tree: nextTree, activeFile: null }),
        );
      } else {
        setSidebarNodes(nextTree);
      }
    } else {
      // Folder is outside the active workspace — find which top-level directory
      // node owns the new folder and refresh its subtree via IPC.
      const ownerNode = sidebarNodes.find(
        (node) => node.type === "directory" && isFileInsideWorkspace(baseDir, node.path),
      );

      if (ownerNode?.type === "directory") {
        const workspaceNode = await glyph.getSidebarNode("directory", ownerNode.path);
        if (workspaceNode?.type === "directory") {
          setSidebarNodes((prev) =>
            upsertSidebarFolder(prev, {
              rootPath: ownerNode.path,
              tree: workspaceNode.children,
              activeFile: null,
            }),
          );
        }
      }
    }
  }, [
    activeFile,
    glyph,
    isWorkspaceMode,
    rootPath,
    settings?.defaultWorkspacePath,
    setIsPaletteOpen,
    setSidebarNodes,
    sidebarNodes,
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
        const draftFile = await glyph.createFile(baseDir!, `Untitled-${Date.now()}.md`);
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
      setIsPaletteOpen,
      setSidebarNodes,
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
        useLayoutStore.getState().removeTabFromAllPanes(toPathKey(filePath));
        const nextActivePath = closeTab(filePath);
        if (nextActivePath) {
          const currentRootPath = useWorkspaceStore.getState().rootPath;
          setIsWorkspaceMode(isFileInsideWorkspace(nextActivePath, currentRootPath));
          requestEditorFocus(
            useSessionStore.getState().hasDocumentScroll(nextActivePath) ? "preserve" : "end",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete file");
      }
    },
    [closeTab, glyph, removeHistoryPath, requestEditorFocus, setError, syncTrackedPaths],
  );

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      try {
        await glyph.deleteFolder(folderPath);
        setSidebarNodes((prev) => removeSidebarPath(prev, folderPath));
        Array.from(
          new Set(navigationHistory.filter((entry) => isFileInsideWorkspace(entry, folderPath))),
        ).forEach((entry) => {
          removeHistoryPath(entry);
        });
        removeTabsInFolder(folderPath);

        if (rootPath && isSamePath(rootPath, folderPath)) {
          setWorkspace({ rootPath: "", tree: [], activeFile: null });
          setIsWorkspaceMode(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete folder");
      }
    },
    [
      glyph,
      navigationHistory,
      removeHistoryPath,
      removeTabsInFolder,
      rootPath,
      setError,
      setWorkspace,
    ],
  );

  const handleRemoveFileFromGlyph = useCallback(
    async (filePath: string) => {
      try {
        const targetTab = getTabByPath(filePath);
        let targetPath = filePath;
        if (targetTab?.isDirty) {
          const savedPath = await persistNoteDraft(
            {
              draftContent: targetTab.draftContent,
              file: targetTab.file,
              isDirty: targetTab.isDirty,
            },
            {
              isActive: isSamePath(activeFile?.path, filePath),
              restoreFocus: isSamePath(activeFile?.path, filePath),
            },
          );

          if (!savedPath) {
            return;
          }

          targetPath = savedPath;
        }

        const nextHiddenFiles = [
          targetPath,
          ...(settings?.hiddenFiles ?? []).filter((entry) => !isSamePath(entry, targetPath)),
        ];
        const nextPinnedFiles = (settings?.pinnedFiles ?? []).filter(
          (entry) => !isSamePath(entry, targetPath),
        );

        await saveSettings({
          hiddenFiles: nextHiddenFiles,
          pinnedFiles: nextPinnedFiles,
        });
        removeHistoryPath(targetPath);
        useLayoutStore.getState().removeTabFromAllPanes(toPathKey(targetPath));
        const nextActivePath = closeTab(targetPath);
        if (nextActivePath) {
          const currentRootPath = useWorkspaceStore.getState().rootPath;
          setIsWorkspaceMode(isFileInsideWorkspace(nextActivePath, currentRootPath));
          requestEditorFocus(
            useSessionStore.getState().hasDocumentScroll(nextActivePath) ? "preserve" : "end",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove note from Glyph");
      }
    },
    [
      activeFile?.path,
      closeTab,
      getTabByPath,
      persistNoteDraft,
      removeHistoryPath,
      requestEditorFocus,
      saveSettings,
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
        if (getTabByPath(filePath)) {
          replaceTabPath(filePath, renamedFile);
          useLayoutStore.getState().replaceTabId(toPathKey(filePath), toPathKey(renamedFile.path));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename file");
      }
    },
    [getTabByPath, glyph, replaceHistoryPath, replaceTabPath, setError, syncTrackedPaths],
  );

  const handleRenameFolder = useCallback(
    async (folderPath: string, newName: string) => {
      if (!newName.trim()) {
        return;
      }

      try {
        const { oldPath, newPath } = await glyph.renameFolder(folderPath, newName);
        setSidebarNodes((prev) => renameSidebarFolder(prev, oldPath, newPath, newName));
        Array.from(
          new Set(navigationHistory.filter((entry) => isFileInsideWorkspace(entry, oldPath))),
        ).forEach((entry) => {
          replaceHistoryPath(entry, getRenamedFolderFilePath(oldPath, newPath, entry));
        });
        remapTabsForFolderRename(oldPath, newPath);

        // If the renamed folder was the workspace root, reopen to restart the watcher
        if (rootPath && isSamePath(rootPath, oldPath)) {
          const workspace = await glyph.openFolder(newPath);
          if (workspace) {
            syncWorkspace(workspace);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename folder");
      }
    },
    [
      glyph,
      navigationHistory,
      replaceHistoryPath,
      remapTabsForFolderRename,
      rootPath,
      setError,
      syncWorkspace,
    ],
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
        editorScale,
      },
    });
  }, [isFocusMode, showOutline, editorScale, saveSettings]);

  const toggleOutline = useCallback(async () => {
    await saveSettings({
      editorPreferences: {
        focusMode: isFocusMode,
        showOutline: !showOutline,
        editorScale,
      },
    });
  }, [isFocusMode, showOutline, editorScale, saveSettings]);

  const setEditorScale = useCallback(
    async (nextScale: number) => {
      const clampedScale = Math.min(200, Math.max(50, nextScale));
      await saveSettings({
        editorPreferences: {
          focusMode: isFocusMode,
          showOutline,
          editorScale: clampedScale,
        },
      });
    },
    [isFocusMode, showOutline, saveSettings],
  );

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
      if (
        updateState.status === "available" ||
        updateState.status === "downloading" ||
        updateState.status === "downloaded"
      ) {
        if (updateState.availableVersion) {
          void saveSettings({ dismissedUpdateVersion: updateState.availableVersion });
        }
        await glyph.openExternal(updateState.releasePageUrl ?? APP_RELEASES_URL);
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
  }, [appInfo?.updatesEnabled, appInfo?.updatesMode, glyph, updateState, saveSettings]);

  const dismissUpdateNotification = useCallback(async () => {
    if (!updateState?.availableVersion) {
      return;
    }
    await saveSettings({ dismissedUpdateVersion: updateState.availableVersion });
  }, [updateState?.availableVersion, saveSettings]);

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
      (updateState.status === "available" ||
        updateState.status === "downloading" ||
        updateState.status === "downloaded");
    if (isManualReleaseAction) {
      return {
        title: "Download Latest Release",
        subtitle: updateState.availableVersion
          ? `Open GitHub Releases to download Glyph ${updateState.availableVersion} manually`
          : "Open GitHub Releases to download and install manually",
        isDisabled: false,
        isManualRelease: true,
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
        shortcut: getShortcutDisplay(shortcuts, "new-note", appInfo?.platform),
        section: "Actions",
        kind: "command",
        onSelect: () => void createNote(),
      },
      {
        id: "new-folder",
        title: "New folder",
        subtitle: "Create a new folder in the current directory",
        shortcut: getShortcutDisplay(shortcuts, "new-folder", appInfo?.platform),
        section: "Actions",
        kind: "command",
        onSelect: () => void createFolder(),
      },
      {
        id: "open-file",
        title: "Open File",
        subtitle: "Open an existing markdown file",
        shortcut: getShortcutDisplay(shortcuts, "open-file", appInfo?.platform),
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
        shortcut: getShortcutDisplay(shortcuts, "open-folder", appInfo?.platform),
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
              shortcut: getShortcutDisplay(shortcuts, "check-updates", appInfo?.platform),
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
      ...(updateActionConfig?.isManualRelease
        ? [
            {
              id: "dismiss-update",
              title: "Dismiss Update Notification",
              subtitle: "Hide the update banner for this version",
              section: "Actions",
              kind: "command" as const,
              onSelect: () => {
                void dismissUpdateNotification();
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
      {
        id: "settings",
        title: "Settings",
        subtitle: "Adjust workspace defaults",
        shortcut: getShortcutDisplay(shortcuts, "settings", appInfo?.platform),
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
        shortcut: getShortcutDisplay(shortcuts, "navigate-back", appInfo?.platform),
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
        shortcut: getShortcutDisplay(shortcuts, "navigate-forward", appInfo?.platform),
        section: "Navigation",
        kind: "command",
        onSelect: () => {
          void navigateForward();
          setIsPaletteOpen(false);
        },
      },
      ...(noteTabs.length > 1
        ? [
            {
              id: "previous-tab",
              title: "Previous Tab",
              subtitle: "Move to the previous open note tab",
              shortcut: getAdjacentTabShortcutDisplay("previous", appInfo?.platform),
              section: "Tabs",
              kind: "command" as const,
              onSelect: () => {
                void activateAdjacentNoteTab(-1);
                setIsPaletteOpen(false);
              },
            },
            {
              id: "next-tab",
              title: "Next Tab",
              subtitle: "Move to the next open note tab",
              shortcut: getAdjacentTabShortcutDisplay("next", appInfo?.platform),
              section: "Tabs",
              kind: "command" as const,
              onSelect: () => {
                void activateAdjacentNoteTab(1);
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
      ...(activeFile
        ? [
            {
              id: "close-tab",
              title: "Close Current Tab",
              subtitle: "Close the current note tab",
              shortcut: getShortcutDisplay(shortcuts, "close-tab", appInfo?.platform),
              section: "Tabs",
              kind: "command" as const,
              onSelect: () => {
                const currentActiveTab = useWorkspaceStore.getState().getActiveTab();
                if (currentActiveTab) {
                  void closeTabFromActivePane(currentActiveTab.file.path);
                }
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
      ...(activeFile && noteTabs.length > 1
        ? [
            {
              id: "close-other-tabs",
              title: "Close Other Tabs",
              subtitle: "Keep only the current note open",
              shortcut: getShortcutDisplay(shortcuts, "close-other-tabs", appInfo?.platform),
              section: "Tabs",
              kind: "command" as const,
              onSelect: () => {
                const currentActiveTab = useWorkspaceStore.getState().getActiveTab();
                if (currentActiveTab) {
                  void closeOtherNoteTabs(currentActiveTab.file.path);
                }
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
      ...(activeFile
        ? [
            {
              id: "split-right",
              title: "Split Right",
              subtitle: "Open a split pane to the right",
              shortcut: getShortcutDisplay(shortcuts, "split-right", appInfo?.platform),
              section: "View",
              kind: "command" as const,
              onSelect: () => {
                splitRight();
                setIsPaletteOpen(false);
              },
            },
            {
              id: "split-down",
              title: "Split Down",
              subtitle: "Open a split pane below",
              shortcut: getShortcutDisplay(shortcuts, "split-down", appInfo?.platform),
              section: "View",
              kind: "command" as const,
              onSelect: () => {
                splitDown();
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
      ...(Object.keys(useLayoutStore.getState().panes).length > 1
        ? [
            {
              id: "close-pane",
              title: "Close Pane",
              subtitle: "Close the active split pane",
              shortcut: getShortcutDisplay(shortcuts, "close-pane", appInfo?.platform),
              section: "View",
              kind: "command" as const,
              onSelect: () => {
                closeActivePane();
                setIsPaletteOpen(false);
              },
            },
            {
              id: "focus-next-pane",
              title: "Focus Next Pane",
              subtitle: "Move focus to the next split pane",
              shortcut: getShortcutDisplay(shortcuts, "focus-next-pane", appInfo?.platform),
              section: "View",
              kind: "command" as const,
              onSelect: () => {
                focusNextPane();
                setIsPaletteOpen(false);
              },
            },
            {
              id: "focus-previous-pane",
              title: "Focus Previous Pane",
              subtitle: "Move focus to the previous split pane",
              shortcut: getShortcutDisplay(shortcuts, "focus-previous-pane", appInfo?.platform),
              section: "View",
              kind: "command" as const,
              onSelect: () => {
                focusPreviousPane();
                setIsPaletteOpen(false);
              },
            },
          ]
        : []),
      {
        id: "toggle-focus-mode",
        title: isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode",
        shortcut: getShortcutDisplay(shortcuts, "focus-mode", appInfo?.platform),
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
      ...noteTabs.map((tab, index) => ({
        id: `open-tab-${tab.id}`,
        title: isSamePath(tab.file.path, activeFile?.path)
          ? `${tab.file.name} (current)`
          : tab.file.name,
        subtitle: getRelativePath(tab.file.path, rootPath),
        shortcut: getDirectTabShortcutDisplay(index, noteTabs.length, appInfo?.platform),
        section: "Open Tabs",
        kind: "command" as const,
        onSelect: () => {
          void activateNoteTab(tab.file.path, { recordHistory: true });
        },
      })),
    ],
    [
      activeFile,
      activateAdjacentNoteTab,
      activateNoteTab,
      appInfo?.platform,
      closeNoteTab,
      closeOtherNoteTabs,
      createNote,
      createFolder,
      dismissUpdateNotification,
      glyph,
      isActiveFilePinned,
      isFocusMode,
      navigateBack,
      navigateForward,
      noteTabs,
      rootPath,
      saveSettings,
      shortcuts,
      showOutline,
      splitRight,
      splitDown,
      closeActivePane,
      closeTabFromActivePane,
      focusNextPane,
      focusPreviousPane,
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
    platform: appInfo?.platform ?? navigator.platform,
    activeFile,
    saveActiveNote: async () => {
      const activeTab = getActiveTab();
      if (!activeTab) {
        return;
      }

      await persistNoteDraft(
        {
          draftContent: activeTab.draftContent,
          file: activeTab.file,
          isDirty: activeTab.isDirty,
        },
        {
          isActive: true,
          restoreFocus: true,
        },
      );
    },
    createNote,
    createFolder,
    closeActiveTab: async () => {
      const currentActiveTab = useWorkspaceStore.getState().getActiveTab();
      if (!currentActiveTab) {
        return;
      }

      await closeTabFromActivePane(currentActiveTab.file.path);
    },
    closeOtherTabs: async () => {
      const currentActiveTab = useWorkspaceStore.getState().getActiveTab();
      if (!currentActiveTab) {
        return;
      }

      await closeOtherNoteTabs(currentActiveTab.file.path);
    },
    activateTabByIndex,
    activateNextTab: async () => {
      await activateAdjacentNoteTab(1);
    },
    activatePreviousTab: async () => {
      await activateAdjacentNoteTab(-1);
    },
    syncOpenedFile,
    syncWorkspace,
    setIsWorkspaceMode,
    navigateBack,
    navigateForward,
    requestFindInNote,
    triggerUpdateAction,
    splitRight,
    splitDown,
    closeActivePane,
    focusNextPane,
    focusPreviousPane,
    isPaletteOpen,
    isSettingsOpen,
    setIsPaletteOpen,
    setIsSettingsOpen,
    setIsSidebarCollapsed,
    toggleFocusMode,
    setEditorScale,
    editorScale,
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
          if (isSamePath(targetPath, nextSettings.defaultWorkspacePath)) {
            try {
              return await glyph.openDefaultWorkspace();
            } catch {
              // If welcome-note setup fails, still try opening the folder directly.
            }
          }

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
      const restoredTabPaths = Array.from(
        new Set(
          (initialTabPaths.length > 0
            ? initialTabPaths
            : initialFilePath
              ? [initialFilePath]
              : []
          ).map((path) => normalizePath(path)),
        ),
      );
      const restoredActivePath = initialFilePath ? normalizePath(initialFilePath) : null;

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
            setWorkspace({
              rootPath: workspace.rootPath,
              tree: workspace.tree,
              activeFile: null,
            });
            nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
            nextExpandedFolders.add(workspace.rootPath);
          }
          try {
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
          } catch {
            // External file is stale or inaccessible — skip file-specific
            // state updates but continue boot so hasBooted flips to true.
          }
        }
      } else {
        const workspace = await tryOpenWorkspace(initialWorkspacePath);
        if (workspace) {
          setWorkspace({
            rootPath: workspace.rootPath,
            tree: workspace.tree,
            activeFile: restoredTabPaths.length > 0 ? null : workspace.activeFile,
          });
          setIsWorkspaceMode(true);
          nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
          if (restoredTabPaths.length === 0 && workspace.activeFile) {
            nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, workspace.activeFile);
            pushHistory(workspace.activeFile.path);
            bootFocusMode = "end";
          }
          nextExpandedFolders.add(workspace.rootPath);
        }

        if (restoredTabPaths.length > 0) {
          const orderedRestorePaths = restoredTabPaths;
          let firstRestoredFile: FileDocument | null = null;
          let restoredActiveFile: FileDocument | null = null;

          for (const restorePath of orderedRestorePaths) {
            const restoredFile = await tryReadPersistedFile(restorePath);
            if (!restoredFile) {
              continue;
            }

            if (!firstRestoredFile) {
              firstRestoredFile = restoredFile;
            }

            setActiveFile(restoredFile);
            setIsWorkspaceMode(
              Boolean(workspace && isFileInsideWorkspace(restoredFile.path, workspace.rootPath)),
            );
            nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, restoredFile);

            if (restoredActivePath && isSamePath(restoredFile.path, restoredActivePath)) {
              restoredActiveFile = restoredFile;
            }
          }

          const nextActiveRestoredFile = restoredActiveFile ?? firstRestoredFile;
          if (nextActiveRestoredFile) {
            setActiveFile(nextActiveRestoredFile);
            setIsWorkspaceMode(
              Boolean(
                workspace && isFileInsideWorkspace(nextActiveRestoredFile.path, workspace.rootPath),
              ),
            );
            pushHistory(nextActiveRestoredFile.path);
            bootFocusMode = "preserve";
          } else if (workspace?.activeFile) {
            setActiveFile(workspace.activeFile);
            setIsWorkspaceMode(
              isFileInsideWorkspace(workspace.activeFile.path, workspace.rootPath),
            );
            nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, workspace.activeFile);
            pushHistory(workspace.activeFile.path);
            bootFocusMode = "end";
          }
        }
      }

      if (isCancelled) {
        return;
      }

      setSidebarNodes(nextSidebarNodes);
      setExpandedFolderPaths(Array.from(nextExpandedFolders));
      setHasHydratedSidebar(true);

      // Initialize layout store with current tabs
      const bootTabs = useWorkspaceStore.getState().noteTabs;
      const bootActiveTabId = useWorkspaceStore.getState().activeTabId;
      if (bootTabs.length > 0) {
        useLayoutStore.getState().initializePane(
          bootTabs.map((t) => t.id),
          bootActiveTabId,
        );
      }

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
        try {
          const file = await glyph.readFile(target.path);
          await syncOpenedFile(file, { recordHistory: true });
        } catch {
          // File may no longer exist or be inaccessible — silently ignore
          // so the app continues in its current state.
        }
      }
    });
  }, [syncOpenedFile, syncWorkspace, glyph]);

  // Workspace change handler
  useEffect(() => {
    return glyph.onWorkspaceChanged(
      async ({ rootPath: changedRootPath, tree: nextTree, changedPaths }) => {
        setTree(nextTree);
        setSidebarNodes((prev) =>
          upsertSidebarFolder(prev, {
            rootPath: changedRootPath,
            tree: nextTree,
            activeFile: null,
          }),
        );

        const changedOpenTabs = noteTabs.filter((tab) =>
          changedPaths.some((changedPath) => isSamePath(changedPath, tab.file.path)),
        );
        await Promise.all(
          changedOpenTabs.map(async (tab) => {
            if (tab.isDirty) {
              return;
            }

            try {
              const refreshedFile = await glyph.readFile(tab.file.path);
              updateActiveFile(refreshedFile);
            } catch {
              // Ignore transient external FS races (file renamed/deleted).
            }
          }),
        );
      },
    );
  }, [glyph, noteTabs, updateActiveFile, setTree]);

  // Auto-save draft content
  useEffect(() => {
    if (!activeFile || !isDirty || isSaving) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const activeTab = getActiveTab();
      if (!activeTab || !activeTab.isDirty || activeTab.isSaving) {
        return;
      }

      await persistNoteDraft(
        {
          draftContent: activeTab.draftContent,
          file: activeTab.file,
          isDirty: activeTab.isDirty,
        },
        {
          isActive: true,
          restoreFocus: true,
        },
      );
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeFile?.path, draftContent, getActiveTab, isDirty, isSaving, persistNoteDraft]);

  // Session sync
  useLayoutEffect(() => {
    if (!sessionReady || !hasBooted) {
      return;
    }

    setNoteSession(
      rootPath || null,
      noteTabs.map((tab) => tab.file.path),
      activeFile?.path ?? null,
    );
  }, [activeFile?.path, hasBooted, noteTabs, rootPath, sessionReady, setNoteSession]);

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
            ? `Saved ${new Date(lastSavedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
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

      if (command === "find-in-note") {
        requestFindInNote();
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

      if (command === "zoom-in") {
        const nextScale = Math.min(200, editorScale + 10);
        await setEditorScale(nextScale);
        return;
      }

      if (command === "zoom-out") {
        const nextScale = Math.max(50, editorScale - 10);
        await setEditorScale(nextScale);
        return;
      }

      if (command === "zoom-reset") {
        await setEditorScale(100);
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

      if (command === "close-tab") {
        const currentActiveTab = useWorkspaceStore.getState().getActiveTab();
        if (!currentActiveTab) {
          return;
        }

        await closeTabFromActivePane(currentActiveTab.file.path);
        return;
      }

      if (command === "split-right") {
        splitRight();
        return;
      }

      if (command === "split-down") {
        splitDown();
        return;
      }

      if (command === "close-pane") {
        closeActivePane();
        return;
      }

      if (command === "focus-next-pane") {
        focusNextPane();
        return;
      }

      if (command === "focus-previous-pane") {
        focusPreviousPane();
        return;
      }

      if (command === "next-tab") {
        await activateAdjacentNoteTab(1);
        return;
      }

      if (command === "previous-tab") {
        await activateAdjacentNoteTab(-1);
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
        const activeTab = getActiveTab();
        if (!activeTab) {
          return;
        }

        await persistNoteDraft(
          {
            draftContent: activeTab.draftContent,
            file: activeTab.file,
            isDirty: activeTab.isDirty,
          },
          {
            isActive: true,
            restoreFocus: true,
          },
        );
      }
    });
  }, [
    activeFile,
    closeTabFromActivePane,
    activateAdjacentNoteTab,
    createNote,
    draftContent,
    getActiveTab,
    persistNoteDraft,
    setError,
    splitRight,
    splitDown,
    closeActivePane,
    focusNextPane,
    focusPreviousPane,
    syncOpenedFile,
    syncWorkspace,
    glyph,
    requestFindInNote,
    toggleFocusMode,
    triggerUpdateAction,
    setIsPaletteOpen,
    setIsSidebarCollapsed,
    setEditorScale,
    editorScale,
  ]);

  return {
    activeFile,
    appInfo,
    activeTabId,
    breadcrumbs,
    canGoBack,
    canGoForward,
    changeShortcuts,
    changeThemeMode,
    chooseFolderAndUpdateWorkspace,
    clearOutlineJumpRequest,
    closeNoteTab,
    closeOtherNoteTabs,
    closeTabFromActivePane,
    splitRight,
    splitDown,
    closeActivePane,
    focusNextPane,
    focusPreviousPane,
    createNote,
    createFolder,
    draftContent,
    editorFocusRequest,
    findRequest,
    error,
    files,
    folderRevealLabel,
    handleDeleteFile,
    handleDeleteFolder,
    handleRemoveFileFromGlyph,
    handleRemoveFolder,
    handleRenameFile,
    handleRenameFolder,
    handleReorderNodes,
    handleToggleFolder,
    isActiveFilePinned,
    isFocusMode,
    isPaletteOpen,
    isSaving,
    isSettingsOpen,
    isSidebarCollapsed,
    markSaved,
    moveNoteTab,
    noteTabs,
    navigateBack,
    navigateForward,
    activateNoteTab,
    activateTabByIndex,
    openFile,
    outlineItems,
    outlineJumpRequest,
    paletteItems,
    paletteQuery,
    pinnedNotes,
    readingTime,
    revealInFinder,
    requestFindInNote,
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
    dismissUpdateNotification,
    updateState,
    updateDraftContent: handleDraftChange,
    visibleSidebarNodes,
    wordCount,
    hasBooted,
    editorScale,
    setEditorScale,
  };
};
