import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { normalizePath } from "@/lib/paths";
import type { SkillDocumentKind } from "@/shared/skills";

const SESSION_STORAGE_KEY = "glyph.editor-session";
const MAX_SCROLL_ENTRIES = 160;

type ViewerMode = "note" | "skill";

type ScrollEntry = {
  top: number;
  updatedAt: number;
};

type SessionState = {
  hasHydrated: boolean;
  viewerMode: ViewerMode;
  isNotesExpanded: boolean;
  isSkillsExpanded: boolean;
  selectedSkillCollectionId: string | null;
  noteWorkspacePath: string | null;
  noteFilePath: string | null;
  skillDocumentPath: string | null;
  skillDocumentKind: SkillDocumentKind;
  skillDocumentKindsById: Record<string, SkillDocumentKind>;
  scrollPositions: Record<string, ScrollEntry>;
  setHasHydrated: (value: boolean) => void;
  setViewerMode: (mode: ViewerMode) => void;
  setNotesExpanded: (value: boolean) => void;
  setSkillsExpanded: (value: boolean) => void;
  setSelectedSkillCollectionId: (value: string | null) => void;
  setNoteSession: (workspacePath: string | null, filePath: string | null) => void;
  setSkillSession: (documentPath: string | null, documentKind: SkillDocumentKind) => void;
  setPreferredSkillDocumentKind: (skillId: string | null, documentKind: SkillDocumentKind) => void;
  getPreferredSkillDocumentKind: (skillId: string | null | undefined) => SkillDocumentKind | null;
  clearSkillSession: () => void;
  setDocumentScroll: (targetPath: string | null, top: number) => void;
  getDocumentScroll: (targetPath: string | null | undefined) => number;
  hasDocumentScroll: (targetPath: string | null | undefined) => boolean;
};

const toScrollKey = (targetPath: string) => normalizePath(targetPath).toLowerCase();

const trimScrollPositions = (positions: Record<string, ScrollEntry>) => {
  const entries = Object.entries(positions);
  if (entries.length <= MAX_SCROLL_ENTRIES) {
    return positions;
  }

  return Object.fromEntries(
    entries
      .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
      .slice(0, MAX_SCROLL_ENTRIES),
  );
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      viewerMode: "note",
      isNotesExpanded: true,
      isSkillsExpanded: false,
      selectedSkillCollectionId: null,
      noteWorkspacePath: null,
      noteFilePath: null,
      skillDocumentPath: null,
      skillDocumentKind: "skill",
      skillDocumentKindsById: {},
      scrollPositions: {},
      setHasHydrated: (value) => {
        set({ hasHydrated: value });
      },
      setViewerMode: (viewerMode) => {
        set({ viewerMode });
      },
      setNotesExpanded: (isNotesExpanded) => {
        set({ isNotesExpanded });
      },
      setSkillsExpanded: (isSkillsExpanded) => {
        set({ isSkillsExpanded });
      },
      setSelectedSkillCollectionId: (selectedSkillCollectionId) => {
        set({ selectedSkillCollectionId });
      },
      setNoteSession: (noteWorkspacePath, noteFilePath) => {
        set({
          noteWorkspacePath: noteWorkspacePath ? normalizePath(noteWorkspacePath) : null,
          noteFilePath: noteFilePath ? normalizePath(noteFilePath) : null,
        });
      },
      setSkillSession: (skillDocumentPath, skillDocumentKind) => {
        set({
          skillDocumentPath: skillDocumentPath ? normalizePath(skillDocumentPath) : null,
          skillDocumentKind,
        });
      },
      setPreferredSkillDocumentKind: (skillId, documentKind) => {
        if (!skillId) {
          return;
        }

        set((state) => ({
          skillDocumentKindsById: {
            ...state.skillDocumentKindsById,
            [skillId]: documentKind,
          },
        }));
      },
      getPreferredSkillDocumentKind: (skillId) => {
        if (!skillId) {
          return null;
        }

        return get().skillDocumentKindsById[skillId] ?? null;
      },
      clearSkillSession: () => {
        set({
          skillDocumentPath: null,
          skillDocumentKind: "skill",
        });
      },
      setDocumentScroll: (targetPath, top) => {
        if (!targetPath) {
          return;
        }

        const clampedTop = Math.max(0, Math.round(top));
        const nextKey = toScrollKey(targetPath);

        set((state) => ({
          scrollPositions: trimScrollPositions({
            ...state.scrollPositions,
            [nextKey]: {
              top: clampedTop,
              updatedAt: Date.now(),
            },
          }),
        }));
      },
      getDocumentScroll: (targetPath) => {
        if (!targetPath) {
          return 0;
        }

        return get().scrollPositions[toScrollKey(targetPath)]?.top ?? 0;
      },
      hasDocumentScroll: (targetPath) => {
        if (!targetPath) {
          return false;
        }

        return Object.hasOwn(get().scrollPositions, toScrollKey(targetPath));
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        viewerMode: state.viewerMode,
        isNotesExpanded: state.isNotesExpanded,
        isSkillsExpanded: state.isSkillsExpanded,
        selectedSkillCollectionId: state.selectedSkillCollectionId,
        noteWorkspacePath: state.noteWorkspacePath,
        noteFilePath: state.noteFilePath,
        skillDocumentPath: state.skillDocumentPath,
        skillDocumentKind: state.skillDocumentKind,
        skillDocumentKindsById: state.skillDocumentKindsById,
        scrollPositions: state.scrollPositions,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export type { ViewerMode };
