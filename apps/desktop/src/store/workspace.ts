import { create } from "zustand";

import { getBaseName, isPathInside, isSamePath, normalizePath } from "@/lib/paths";

import type { DirectoryNode, FileDocument, NoteTab, TabMovePosition } from "../shared/workspace";

const getClosestHistoryIndex = (history: string[], currentIndex: number, filePath: string) => {
  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;

  history.forEach((entry, index) => {
    if (!isSamePath(entry, filePath)) {
      return;
    }

    const distance = Math.abs(index - currentIndex);
    if (distance < closestDistance || (distance === closestDistance && index < closestIndex)) {
      closestIndex = index;
      closestDistance = distance;
    }
  });

  return closestIndex;
};

const toTabId = (path: string) => normalizePath(path).toLowerCase();

type ActiveSurfaceSnapshot = {
  activeFile: FileDocument | null;
  draftContent: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
};

const EMPTY_ACTIVE_SURFACE: ActiveSurfaceSnapshot = {
  activeFile: null,
  draftContent: "",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
};

const createNoteTab = (
  file: FileDocument,
  overrides?: Partial<Omit<NoteTab, "file" | "id">>,
): NoteTab => ({
  id: toTabId(file.path),
  file,
  draftContent: overrides?.draftContent ?? file.content,
  isDirty: overrides?.isDirty ?? false,
  isSaving: overrides?.isSaving ?? false,
  lastSavedAt: overrides?.lastSavedAt ?? Date.now(),
});

const getNoteTabIndex = (noteTabs: NoteTab[], filePath: string) =>
  noteTabs.findIndex((tab) => tab.id === toTabId(filePath));

const getActiveSurface = (
  noteTabs: NoteTab[],
  activeTabId: string | null,
  fallback: ActiveSurfaceSnapshot,
): ActiveSurfaceSnapshot => {
  if (!activeTabId) {
    return fallback;
  }

  const activeTab = noteTabs.find((tab) => tab.id === activeTabId);
  if (!activeTab) {
    return fallback;
  }

  return {
    activeFile: activeTab.file,
    draftContent: activeTab.draftContent,
    isDirty: activeTab.isDirty,
    isSaving: activeTab.isSaving,
    lastSavedAt: activeTab.lastSavedAt,
  };
};

type WorkspaceState = {
  rootPath: string | null;
  tree: DirectoryNode[];
  noteTabs: NoteTab[];
  activeTabId: string | null;
  activeFile: FileDocument | null;
  draftContent: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  error: string | null;
  navigationHistory: string[];
  navigationIndex: number;
  setWorkspace: (payload: {
    rootPath: string;
    tree: DirectoryNode[];
    activeFile: FileDocument | null;
  }) => void;
  setTree: (tree: DirectoryNode[]) => void;
  setActiveFile: (file: FileDocument | null) => void;
  attachActiveFile: (file: FileDocument) => void;
  updateActiveFile: (file: FileDocument) => void;
  updateDraftContent: (content: string) => void;
  updateTabDraftContent: (tabId: string, content: string) => void;
  markSaved: (file: FileDocument) => void;
  markTabSaved: (filePath: string, file: FileDocument) => void;
  setSaving: (isSaving: boolean) => void;
  setTabSaving: (filePath: string, isSaving: boolean) => void;
  setError: (message: string | null) => void;
  activateTab: (filePath: string) => void;
  closeTab: (filePath: string) => string | null;
  closeOtherTabs: (filePath: string) => void;
  moveTab: (sourcePath: string, targetPath: string, position: TabMovePosition) => void;
  removeTab: (filePath: string) => void;
  removeTabsInFolder: (folderPath: string) => void;
  replaceTabPath: (oldPath: string, file: FileDocument) => void;
  remapTabsForFolderRename: (oldFolderPath: string, newFolderPath: string) => void;
  getActiveTab: () => NoteTab | null;
  getTabByPath: (filePath: string) => NoteTab | null;
  pushHistory: (filePath: string) => void;
  replaceHistoryPath: (oldPath: string, newPath: string) => void;
  removeHistoryPath: (targetPath: string) => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => string | null;
  goForward: () => string | null;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPath: null,
  tree: [],
  noteTabs: [],
  activeTabId: null,
  activeFile: null,
  draftContent: "",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  error: null,
  navigationHistory: [],
  navigationIndex: -1,
  setWorkspace: ({ rootPath, tree, activeFile }) =>
    set((state) => {
      if (!activeFile) {
        return {
          rootPath,
          tree,
          error: null,
        };
      }

      const existingIndex = getNoteTabIndex(state.noteTabs, activeFile.path);
      const noteTabs =
        existingIndex >= 0
          ? state.noteTabs.map((tab, index) => {
              if (index !== existingIndex) {
                return tab;
              }

              return {
                ...tab,
                file: activeFile,
                draftContent: tab.isDirty ? tab.draftContent : activeFile.content,
              };
            })
          : [...state.noteTabs, createNoteTab(activeFile)];
      const activeTabId = toTabId(activeFile.path);

      return {
        rootPath,
        tree,
        error: null,
        noteTabs,
        activeTabId,
        ...getActiveSurface(noteTabs, activeTabId, EMPTY_ACTIVE_SURFACE),
      };
    }),
  setTree: (tree) => set({ tree }),
  setActiveFile: (activeFile) =>
    set((state) => {
      if (!activeFile) {
        return {
          activeTabId: null,
          ...EMPTY_ACTIVE_SURFACE,
        };
      }

      const existingIndex = getNoteTabIndex(state.noteTabs, activeFile.path);
      const noteTabs =
        existingIndex >= 0
          ? state.noteTabs.map((tab, index) => {
              if (index !== existingIndex) {
                return tab;
              }

              return {
                ...tab,
                file: activeFile,
                draftContent: tab.isDirty ? tab.draftContent : activeFile.content,
              };
            })
          : [...state.noteTabs, createNoteTab(activeFile)];
      const activeTabId = toTabId(activeFile.path);

      return {
        noteTabs,
        activeTabId,
        ...getActiveSurface(noteTabs, activeTabId, EMPTY_ACTIVE_SURFACE),
      };
    }),
  attachActiveFile: (activeFile) =>
    set((state) => {
      const activeDraftContent = state.activeTabId ? activeFile.content : state.draftContent;
      const activeIsDirty = state.activeTabId ? false : state.isDirty;
      const activeIsSaving = state.activeTabId ? false : state.isSaving;
      const activeLastSavedAt = state.activeTabId ? Date.now() : state.lastSavedAt;
      const existingIndex = getNoteTabIndex(state.noteTabs, activeFile.path);
      const nextTab = createNoteTab(activeFile, {
        draftContent: activeDraftContent,
        isDirty: activeIsDirty,
        isSaving: activeIsSaving,
        lastSavedAt: activeLastSavedAt,
      });
      const noteTabs =
        existingIndex >= 0
          ? state.noteTabs.map((tab, index) => (index === existingIndex ? nextTab : tab))
          : [...state.noteTabs, nextTab];

      return {
        noteTabs,
        activeTabId: nextTab.id,
        activeFile,
        draftContent: nextTab.draftContent,
        isDirty: nextTab.isDirty,
        isSaving: nextTab.isSaving,
        lastSavedAt: nextTab.lastSavedAt,
      };
    }),
  updateActiveFile: (activeFile) =>
    set((state) => {
      const tabIndex = getNoteTabIndex(state.noteTabs, activeFile.path);
      const noteTabs =
        tabIndex >= 0
          ? state.noteTabs.map((tab, index) => {
              if (index !== tabIndex) {
                return tab;
              }

              return {
                ...tab,
                file: activeFile,
                draftContent: tab.isDirty ? tab.draftContent : activeFile.content,
              };
            })
          : state.noteTabs;
      const activeTabId = state.activeTabId;

      return {
        noteTabs,
        ...getActiveSurface(noteTabs, activeTabId, {
          activeFile: state.activeFile,
          draftContent: state.draftContent,
          isDirty: state.isDirty,
          isSaving: state.isSaving,
          lastSavedAt: state.lastSavedAt,
        }),
      };
    }),
  updateDraftContent: (draftContent) =>
    set((state) => {
      if (!state.activeTabId) {
        return { draftContent, isDirty: true };
      }

      const noteTabs = state.noteTabs.map((tab) =>
        tab.id === state.activeTabId
          ? {
              ...tab,
              draftContent,
              isDirty: true,
            }
          : tab,
      );

      return {
        noteTabs,
        draftContent,
        isDirty: true,
      };
    }),
  updateTabDraftContent: (tabId, content) =>
    set((state) => {
      const tab = state.noteTabs.find((t) => t.id === tabId);
      if (!tab) {
        return state;
      }

      const noteTabs = state.noteTabs.map((t) =>
        t.id === tabId ? { ...t, draftContent: content, isDirty: true } : t,
      );

      // If this is the active tab, also update top-level derived state
      if (state.activeTabId === tabId) {
        return { noteTabs, draftContent: content, isDirty: true };
      }

      return { noteTabs };
    }),
  markSaved: (activeFile) =>
    set((state) => {
      const currentActiveTab = state.activeTabId
        ? (state.noteTabs.find((tab) => tab.id === state.activeTabId) ?? null)
        : null;
      const shouldRemainDirty =
        (currentActiveTab?.draftContent ?? state.draftContent) !== activeFile.content;

      if (!state.activeTabId) {
        return {
          activeFile,
          draftContent: shouldRemainDirty ? state.draftContent : activeFile.content,
          isDirty: shouldRemainDirty,
          isSaving: false,
          lastSavedAt: Date.now(),
        };
      }

      const noteTabs = state.noteTabs.map((tab) =>
        tab.id === state.activeTabId
          ? {
              ...tab,
              file: activeFile,
              draftContent: shouldRemainDirty ? tab.draftContent : activeFile.content,
              isDirty: shouldRemainDirty,
              isSaving: false,
              lastSavedAt: Date.now(),
            }
          : tab,
      );

      return {
        noteTabs,
        activeFile,
        draftContent: shouldRemainDirty ? state.draftContent : activeFile.content,
        isDirty: shouldRemainDirty,
        isSaving: false,
        lastSavedAt: Date.now(),
      };
    }),
  markTabSaved: (filePath, file) =>
    set((state) => {
      const tabIndex = getNoteTabIndex(state.noteTabs, filePath);
      if (tabIndex < 0) {
        return state;
      }

      const noteTabs = state.noteTabs.map((tab, index) =>
        index === tabIndex
          ? {
              ...tab,
              id: toTabId(file.path),
              file,
              draftContent: file.content,
              isDirty: false,
              isSaving: false,
              lastSavedAt: Date.now(),
            }
          : tab,
      );
      const nextActiveTabId =
        state.activeTabId === toTabId(filePath) ? toTabId(file.path) : state.activeTabId;

      return {
        noteTabs,
        activeTabId: nextActiveTabId,
        ...getActiveSurface(noteTabs, nextActiveTabId, {
          activeFile: state.activeFile,
          draftContent: state.draftContent,
          isDirty: state.isDirty,
          isSaving: state.isSaving,
          lastSavedAt: state.lastSavedAt,
        }),
      };
    }),
  setSaving: (isSaving) =>
    set((state) => {
      if (!state.activeTabId) {
        return { isSaving };
      }

      return {
        noteTabs: state.noteTabs.map((tab) =>
          tab.id === state.activeTabId
            ? {
                ...tab,
                isSaving,
              }
            : tab,
        ),
        isSaving,
      };
    }),
  setTabSaving: (filePath, isSaving) =>
    set((state) => {
      const tabIndex = getNoteTabIndex(state.noteTabs, filePath);
      if (tabIndex < 0) {
        return state;
      }

      const noteTabs = state.noteTabs.map((tab, index) =>
        index === tabIndex
          ? {
              ...tab,
              isSaving,
            }
          : tab,
      );

      return {
        noteTabs,
        ...getActiveSurface(noteTabs, state.activeTabId, {
          activeFile: state.activeFile,
          draftContent: state.draftContent,
          isDirty: state.isDirty,
          isSaving: state.isSaving,
          lastSavedAt: state.lastSavedAt,
        }),
      };
    }),
  setError: (error) => set({ error }),
  activateTab: (filePath) =>
    set((state) => {
      const nextActiveTabId = toTabId(filePath);
      if (state.activeTabId === nextActiveTabId) {
        return state;
      }

      const tab = state.noteTabs.find((entry) => entry.id === nextActiveTabId);
      if (!tab) {
        return state;
      }

      return {
        activeTabId: nextActiveTabId,
        ...getActiveSurface(state.noteTabs, nextActiveTabId, EMPTY_ACTIVE_SURFACE),
      };
    }),
  closeTab: (filePath) => {
    const state = get();
    const tabIndex = getNoteTabIndex(state.noteTabs, filePath);
    if (tabIndex < 0) {
      return state.activeFile?.path ?? null;
    }

    const targetTabId = state.noteTabs[tabIndex]?.id ?? null;
    const noteTabs = state.noteTabs.filter((tab) => tab.id !== targetTabId);
    let nextActiveTabId = state.activeTabId;

    if (targetTabId && state.activeTabId === targetTabId) {
      const previousTab = state.noteTabs[tabIndex - 1] ?? null;
      const nextTab = state.noteTabs[tabIndex + 1] ?? null;
      nextActiveTabId = previousTab?.id ?? nextTab?.id ?? null;
    }

    set({
      noteTabs,
      activeTabId: nextActiveTabId,
      ...getActiveSurface(noteTabs, nextActiveTabId, EMPTY_ACTIVE_SURFACE),
    });

    const nextActiveTab = noteTabs.find((tab) => tab.id === nextActiveTabId) ?? null;
    return nextActiveTab?.file.path ?? null;
  },
  closeOtherTabs: (filePath) =>
    set((state) => {
      const tabIndex = getNoteTabIndex(state.noteTabs, filePath);
      if (tabIndex < 0) {
        return state;
      }

      const nextTab = state.noteTabs[tabIndex]!;
      const noteTabs = [nextTab];

      return {
        noteTabs,
        activeTabId: nextTab.id,
        ...getActiveSurface(noteTabs, nextTab.id, EMPTY_ACTIVE_SURFACE),
      };
    }),
  moveTab: (sourcePath, targetPath, position) =>
    set((state) => {
      const sourceIndex = getNoteTabIndex(state.noteTabs, sourcePath);
      const targetIndex = getNoteTabIndex(state.noteTabs, targetPath);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return state;
      }

      const sourceTab = state.noteTabs[sourceIndex];
      const targetTab = state.noteTabs[targetIndex];
      if (!sourceTab || !targetTab) {
        return state;
      }

      const remainingTabs = state.noteTabs.filter((tab) => tab.id !== sourceTab.id);
      const nextTargetIndex = remainingTabs.findIndex((tab) => tab.id === targetTab.id);
      if (nextTargetIndex < 0) {
        return state;
      }

      const insertionIndex = position === "before" ? nextTargetIndex : nextTargetIndex + 1;
      const noteTabs = [
        ...remainingTabs.slice(0, insertionIndex),
        sourceTab,
        ...remainingTabs.slice(insertionIndex),
      ];

      return {
        noteTabs,
        ...getActiveSurface(noteTabs, state.activeTabId, {
          activeFile: state.activeFile,
          draftContent: state.draftContent,
          isDirty: state.isDirty,
          isSaving: state.isSaving,
          lastSavedAt: state.lastSavedAt,
        }),
      };
    }),
  removeTab: (filePath) =>
    set((state) => {
      const nextTabs = state.noteTabs.filter((tab) => !isSamePath(tab.file.path, filePath));
      const nextActiveTabId =
        state.activeTabId && isSamePath(filePath, state.activeFile?.path)
          ? (nextTabs.at(-1)?.id ?? null)
          : state.activeTabId;

      return {
        noteTabs: nextTabs,
        activeTabId: nextActiveTabId,
        ...getActiveSurface(nextTabs, nextActiveTabId, EMPTY_ACTIVE_SURFACE),
      };
    }),
  removeTabsInFolder: (folderPath) =>
    set((state) => {
      const nextTabs = state.noteTabs.filter((tab) => !isPathInside(tab.file.path, folderPath));
      const nextActiveTabId =
        state.activeTabId && isPathInside(state.activeFile?.path ?? "", folderPath)
          ? (nextTabs.at(-1)?.id ?? null)
          : state.activeTabId;

      return {
        noteTabs: nextTabs,
        activeTabId: nextActiveTabId,
        ...getActiveSurface(nextTabs, nextActiveTabId, EMPTY_ACTIVE_SURFACE),
      };
    }),
  replaceTabPath: (oldPath, file) =>
    set((state) => {
      const tabIndex = getNoteTabIndex(state.noteTabs, oldPath);
      if (tabIndex < 0) {
        return state;
      }

      const previousTab = state.noteTabs[tabIndex]!;
      const nextTab: NoteTab = {
        ...previousTab,
        id: toTabId(file.path),
        file,
      };
      const noteTabs = state.noteTabs.map((tab, index) => (index === tabIndex ? nextTab : tab));
      const nextActiveTabId = state.activeTabId === previousTab.id ? nextTab.id : state.activeTabId;

      return {
        noteTabs,
        activeTabId: nextActiveTabId,
        ...getActiveSurface(noteTabs, nextActiveTabId, {
          activeFile: state.activeFile,
          draftContent: state.draftContent,
          isDirty: state.isDirty,
          isSaving: state.isSaving,
          lastSavedAt: state.lastSavedAt,
        }),
      };
    }),
  remapTabsForFolderRename: (oldFolderPath, newFolderPath) =>
    set((state) => {
      let nextActiveTabId = state.activeTabId;
      const noteTabs = state.noteTabs.map((tab) => {
        if (!isPathInside(tab.file.path, oldFolderPath)) {
          return tab;
        }

        const normalizedOldFolderPath = normalizePath(oldFolderPath).replace(/\/+$/, "");
        const normalizedNewFolderPath = normalizePath(newFolderPath).replace(/\/+$/, "");
        const suffix = normalizePath(tab.file.path).slice(normalizedOldFolderPath.length);
        const nextPath = `${normalizedNewFolderPath}${suffix}`;
        const nextTab: NoteTab = {
          ...tab,
          id: toTabId(nextPath),
          file: {
            ...tab.file,
            path: nextPath,
            name: getBaseName(nextPath),
          },
        };

        if (state.activeTabId === tab.id) {
          nextActiveTabId = nextTab.id;
        }

        return nextTab;
      });

      return {
        noteTabs,
        activeTabId: nextActiveTabId,
        ...getActiveSurface(noteTabs, nextActiveTabId, {
          activeFile: state.activeFile,
          draftContent: state.draftContent,
          isDirty: state.isDirty,
          isSaving: state.isSaving,
          lastSavedAt: state.lastSavedAt,
        }),
      };
    }),
  getActiveTab: () => {
    const state = get();
    if (!state.activeTabId) {
      return null;
    }

    return state.noteTabs.find((tab) => tab.id === state.activeTabId) ?? null;
  },
  getTabByPath: (filePath) => {
    const state = get();
    return state.noteTabs.find((tab) => isSamePath(tab.file.path, filePath)) ?? null;
  },
  pushHistory: (filePath) => {
    set((state) => {
      const currentPath =
        state.navigationIndex >= 0
          ? (state.navigationHistory[state.navigationIndex] ?? null)
          : null;

      if (currentPath && isSamePath(currentPath, filePath)) {
        return state;
      }

      const existingIndex = getClosestHistoryIndex(
        state.navigationHistory,
        state.navigationIndex,
        filePath,
      );
      if (existingIndex >= 0) {
        return {
          navigationHistory: state.navigationHistory,
          navigationIndex: existingIndex,
        };
      }

      const newHistory = state.navigationHistory.slice(0, state.navigationIndex + 1);
      if (isSamePath(newHistory[newHistory.length - 1], filePath)) {
        return state;
      }

      newHistory.push(filePath);

      if (newHistory.length > 50) {
        newHistory.shift();
      }

      return {
        navigationHistory: newHistory,
        navigationIndex: newHistory.length - 1,
      };
    });
  },
  replaceHistoryPath: (oldPath, newPath) => {
    set((state) => ({
      navigationHistory: state.navigationHistory.map((entry) =>
        isSamePath(entry, oldPath) ? newPath : entry,
      ),
    }));
  },
  removeHistoryPath: (targetPath) => {
    set((state) => {
      const removedIndices: number[] = [];
      const nextHistory = state.navigationHistory.filter((entry, index) => {
        if (isSamePath(entry, targetPath)) {
          removedIndices.push(index);
          return false;
        }

        return true;
      });

      if (nextHistory.length === state.navigationHistory.length) {
        return state;
      }

      if (nextHistory.length === 0) {
        return {
          navigationHistory: [],
          navigationIndex: -1,
        };
      }

      const removedBeforeCurrent = removedIndices.filter(
        (index) => index < state.navigationIndex,
      ).length;
      const removedCurrentEntry = removedIndices.includes(state.navigationIndex);
      const nextNavigationIndex = removedCurrentEntry
        ? state.navigationIndex - removedBeforeCurrent - 1
        : state.navigationIndex - removedBeforeCurrent;

      return {
        navigationHistory: nextHistory,
        navigationIndex: Math.max(0, Math.min(nextNavigationIndex, nextHistory.length - 1)),
      };
    });
  },
  canGoBack: () => {
    const state = get();
    return state.navigationIndex > 0;
  },
  canGoForward: () => {
    const state = get();
    return state.navigationIndex < state.navigationHistory.length - 1;
  },
  goBack: () => {
    const state = get();
    if (state.navigationIndex > 0) {
      const newIndex = state.navigationIndex - 1;
      set({ navigationIndex: newIndex });
      return state.navigationHistory[newIndex];
    }
    return null;
  },
  goForward: () => {
    const state = get();
    if (state.navigationIndex < state.navigationHistory.length - 1) {
      const newIndex = state.navigationIndex + 1;
      set({ navigationIndex: newIndex });
      return state.navigationHistory[newIndex];
    }
    return null;
  },
}));
