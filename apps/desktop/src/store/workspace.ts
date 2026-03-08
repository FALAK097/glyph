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
  setWorkspace: (payload: {
    rootPath: string;
    tree: DirectoryNode[];
    activeFile: FileDocument | null;
  }) => void;
  setTree: (tree: DirectoryNode[]) => void;
  setActiveFile: (file: FileDocument | null) => void;
  updateActiveFile: (file: FileDocument) => void;
  updateDraftContent: (content: string) => void;
  markSaved: (file: FileDocument) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (message: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  rootPath: null,
  tree: [],
  activeFile: null,
  draftContent: "",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  error: null,
  setWorkspace: ({ rootPath, tree, activeFile }) =>
    set({
      rootPath,
      tree,
      activeFile,
      draftContent: activeFile?.content ?? "",
      isDirty: false,
      lastSavedAt: activeFile ? Date.now() : null,
      error: null
    }),
  setTree: (tree) => set({ tree }),
  setActiveFile: (activeFile) =>
    set({
      activeFile,
      draftContent: activeFile?.content ?? "",
      isDirty: false,
      lastSavedAt: activeFile ? Date.now() : null
    }),
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
  setError: (error) => set({ error })
}));
