import { create } from "zustand";
import type { DirectoryNode, FileDocument } from "../shared/workspace";

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
      navigationIndex: activeFile ? 0 : -1
    }),
  setTree: (tree) => set({ tree }),
  setActiveFile: (activeFile) =>
    set({
      activeFile,
      draftContent: activeFile?.content ?? "",
      isDirty: false,
      lastSavedAt: activeFile ? Date.now() : null
    }),
  attachActiveFile: (activeFile) =>
    set((state) => ({
      activeFile,
      draftContent: state.draftContent,
      isDirty: state.isDirty,
      lastSavedAt: state.lastSavedAt
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
      lastSavedAt: Date.now()
    })),
  setSaving: (isSaving) => set({ isSaving }),
  setError: (error) => set({ error }),
  pushHistory: (filePath) => {
    set((state) => {
      // If we're not at the end of history, remove forward entries
      const newHistory = state.navigationHistory.slice(0, state.navigationIndex + 1);
      
      // Don't add duplicate consecutive entries
      if (newHistory[newHistory.length - 1] === filePath) {
        return state;
      }
      
      newHistory.push(filePath);
      
      // Limit history to 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      
      return {
        navigationHistory: newHistory,
        navigationIndex: newHistory.length - 1
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
  }
}));
