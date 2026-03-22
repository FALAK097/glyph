import { create } from "zustand";

import { isSamePath } from "@/lib/paths";

import type { DirectoryNode, FileDocument } from "../shared/workspace";

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

type WorkspaceState = {
  rootPath: string | null;
  tree: DirectoryNode[];
  activeFile: FileDocument | null;
  draftContent: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  error: string | null;
  // Navigation history
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
  markSaved: (file: FileDocument) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (message: string | null) => void;
  // Navigation history methods
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
  activeFile: null,
  draftContent: "",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  error: null,
  navigationHistory: [],
  navigationIndex: -1,
  setWorkspace: ({ rootPath, tree, activeFile }) =>
    set({
      rootPath,
      tree,
      activeFile,
      draftContent: activeFile?.content ?? "",
      isDirty: false,
      lastSavedAt: activeFile ? Date.now() : null,
      error: null,
      navigationHistory: activeFile ? [activeFile.path] : [],
      navigationIndex: activeFile ? 0 : -1,
    }),
  setTree: (tree) => set({ tree }),
  setActiveFile: (activeFile) =>
    set({
      activeFile,
      draftContent: activeFile?.content ?? "",
      isDirty: false,
      lastSavedAt: activeFile ? Date.now() : null,
    }),
  attachActiveFile: (activeFile) =>
    set((state) => ({
      activeFile,
      draftContent: state.draftContent,
      isDirty: state.isDirty,
      lastSavedAt: state.lastSavedAt,
    })),
  updateActiveFile: (activeFile) => set({ activeFile }),
  updateDraftContent: (draftContent) => set({ draftContent, isDirty: true }),
  markSaved: (activeFile) =>
    set((state) => ({
      activeFile,
      // Only update draft content if it's not currently dirty.
      // This prevents the editor from resetting the cursor if the user is typing while it saves.
      draftContent: state.isDirty ? state.draftContent : activeFile.content,
      isDirty: false,
      isSaving: false,
      lastSavedAt: Date.now(),
    })),
  setSaving: (isSaving) => set({ isSaving }),
  setError: (error) => set({ error }),
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

      // If we're not at the end of history, remove forward entries
      const newHistory = state.navigationHistory.slice(0, state.navigationIndex + 1);

      // Don't add duplicate consecutive entries
      if (isSamePath(newHistory[newHistory.length - 1], filePath)) {
        return state;
      }

      newHistory.push(filePath);

      // Limit history to 50 entries
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
