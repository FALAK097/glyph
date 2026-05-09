import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { normalizePath } from "@/core/paths";
import type { SkillDocumentKind } from "@/core/skills";
import type { LayoutNode, PaneState } from "@/core/workspace";

const SESSION_STORAGE_KEY = "glyph.editor-session";
const MAX_SCROLL_ENTRIES = 160;
const DEFAULT_NOTES_BROWSER_PANE_WIDTH = 320;
const DEFAULT_SKILLS_BROWSER_PANE_WIDTH = 292;
const MIN_BROWSER_PANE_WIDTH = 240;
const MAX_BROWSER_PANE_WIDTH = 520;

type ViewerMode = "note" | "skill" | "tasks";

type ScrollEntry = {
  top: number;
  updatedAt: number;
};

type SessionState = {
  hasHydrated: boolean;
  viewerMode: ViewerMode;
  isSidebarCollapsed: boolean;
  isNotesExpanded: boolean;
  isSkillsExpanded: boolean;
  selectedNoteCollectionPath: string | null;
  lastNotePathByCollection: Record<string, string>;
  noteOrderByCollection: Record<string, string[]>;
  notesBrowserSearchQuery: string;
  notesBrowserPaneWidth: number;
  skillsBrowserPaneWidth: number;
  selectedSkillCollectionId: string | null;
  noteWorkspacePath: string | null;
  noteFilePath: string | null;
  noteTabPaths: string[];
  skillDocumentPath: string | null;
  skillDocumentKind: SkillDocumentKind;
  skillDocumentKindsById: Record<string, SkillDocumentKind>;
  scrollPositions: Record<string, ScrollEntry>;
  layoutRoot: LayoutNode | null;
  layoutActivePaneId: string | null;
  layoutPanes: Record<string, PaneState> | null;
  setHasHydrated: (value: boolean) => void;
  setViewerMode: (mode: ViewerMode) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setNotesExpanded: (value: boolean) => void;
  setSkillsExpanded: (value: boolean) => void;
  setSelectedNoteCollectionPath: (value: string | null) => void;
  setLastNotePathForCollection: (collectionPath: string, notePath: string) => void;
  getLastNotePathForCollection: (collectionPath: string | null | undefined) => string | null;
  setNoteOrderForCollection: (collectionPath: string, notePaths: string[]) => void;
  getNoteOrderForCollection: (collectionPath: string | null | undefined) => string[];
  setNotesBrowserSearchQuery: (value: string) => void;
  setNotesBrowserPaneWidth: (value: number) => void;
  setSkillsBrowserPaneWidth: (value: number) => void;
  setSelectedSkillCollectionId: (value: string | null) => void;
  setNoteSession: (
    workspacePath: string | null,
    tabPaths: string[],
    activeFilePath: string | null,
  ) => void;
  setSkillSession: (documentPath: string | null, documentKind: SkillDocumentKind) => void;
  setPreferredSkillDocumentKind: (skillId: string | null, documentKind: SkillDocumentKind) => void;
  getPreferredSkillDocumentKind: (skillId: string | null | undefined) => SkillDocumentKind | null;
  clearSkillSession: () => void;
  setDocumentScroll: (targetPath: string | null, top: number) => void;
  getDocumentScroll: (targetPath: string | null | undefined) => number;
  hasDocumentScroll: (targetPath: string | null | undefined) => boolean;
  setLayoutSession: (
    root: LayoutNode,
    activePaneId: string,
    panes: Record<string, PaneState>,
  ) => void;
  getLayoutSession: () => {
    root: LayoutNode;
    activePaneId: string;
    panes: Record<string, PaneState>;
  } | null;
};

const toScrollKey = (targetPath: string) => normalizePath(targetPath).toLowerCase();

const normalizeUniquePaths = (paths: string[]) => {
  const seenKeys = new Set<string>();
  const normalizedPaths: string[] = [];

  paths.forEach((path) => {
    const normalizedPath = normalizePath(path);
    const key = normalizedPath.toLowerCase();
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    normalizedPaths.push(normalizedPath);
  });

  return normalizedPaths;
};

const arePathArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

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

const clampBrowserPaneWidth = (value: number, fallback: number) =>
  Number.isFinite(value)
    ? Math.min(MAX_BROWSER_PANE_WIDTH, Math.max(MIN_BROWSER_PANE_WIDTH, Math.round(value)))
    : fallback;

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      viewerMode: "note",
      isSidebarCollapsed: false,
      isNotesExpanded: true,
      isSkillsExpanded: false,
      selectedNoteCollectionPath: null,
      lastNotePathByCollection: {},
      noteOrderByCollection: {},
      notesBrowserSearchQuery: "",
      notesBrowserPaneWidth: DEFAULT_NOTES_BROWSER_PANE_WIDTH,
      skillsBrowserPaneWidth: DEFAULT_SKILLS_BROWSER_PANE_WIDTH,
      selectedSkillCollectionId: null,
      noteWorkspacePath: null,
      noteFilePath: null,
      noteTabPaths: [],
      skillDocumentPath: null,
      skillDocumentKind: "skill",
      skillDocumentKindsById: {},
      scrollPositions: {},
      layoutRoot: null,
      layoutActivePaneId: null,
      layoutPanes: null,
      setHasHydrated: (value) => {
        set({ hasHydrated: value });
      },
      setViewerMode: (viewerMode) => {
        set({ viewerMode });
      },
      setSidebarCollapsed: (isSidebarCollapsed) => {
        set({ isSidebarCollapsed });
      },
      setNotesExpanded: (isNotesExpanded) => {
        set({ isNotesExpanded });
      },
      setSkillsExpanded: (isSkillsExpanded) => {
        set({ isSkillsExpanded });
      },
      setSelectedNoteCollectionPath: (selectedNoteCollectionPath) => {
        set({
          selectedNoteCollectionPath: selectedNoteCollectionPath
            ? normalizePath(selectedNoteCollectionPath)
            : null,
        });
      },
      setLastNotePathForCollection: (collectionPath, notePath) => {
        const normalizedCollectionPath = normalizePath(collectionPath);
        const normalizedNotePath = normalizePath(notePath);
        set((state) => ({
          lastNotePathByCollection: {
            ...state.lastNotePathByCollection,
            [normalizedCollectionPath.toLowerCase()]: normalizedNotePath,
          },
        }));
      },
      getLastNotePathForCollection: (collectionPath) => {
        if (!collectionPath) {
          return null;
        }

        return get().lastNotePathByCollection[normalizePath(collectionPath).toLowerCase()] ?? null;
      },
      setNoteOrderForCollection: (collectionPath, notePaths) => {
        const normalizedCollectionPath = normalizePath(collectionPath);
        set((state) => ({
          noteOrderByCollection: {
            ...state.noteOrderByCollection,
            [normalizedCollectionPath.toLowerCase()]: normalizeUniquePaths(notePaths),
          },
        }));
      },
      getNoteOrderForCollection: (collectionPath) => {
        if (!collectionPath) {
          return [];
        }

        return get().noteOrderByCollection[normalizePath(collectionPath).toLowerCase()] ?? [];
      },
      setNotesBrowserSearchQuery: (notesBrowserSearchQuery) => {
        set({ notesBrowserSearchQuery });
      },
      setNotesBrowserPaneWidth: (notesBrowserPaneWidth) => {
        set((state) => ({
          notesBrowserPaneWidth: clampBrowserPaneWidth(
            notesBrowserPaneWidth,
            state.notesBrowserPaneWidth,
          ),
        }));
      },
      setSkillsBrowserPaneWidth: (skillsBrowserPaneWidth) => {
        set((state) => ({
          skillsBrowserPaneWidth: clampBrowserPaneWidth(
            skillsBrowserPaneWidth,
            state.skillsBrowserPaneWidth,
          ),
        }));
      },
      setSelectedSkillCollectionId: (selectedSkillCollectionId) => {
        set({ selectedSkillCollectionId });
      },
      setNoteSession: (noteWorkspacePath, tabPaths, activeFilePath) => {
        const normalizedWorkspacePath = noteWorkspacePath ? normalizePath(noteWorkspacePath) : null;
        const normalizedTabPaths = normalizeUniquePaths(tabPaths);
        const normalizedActivePath = activeFilePath ? normalizePath(activeFilePath) : null;
        const currentState = get();

        if (
          currentState.noteWorkspacePath === normalizedWorkspacePath &&
          currentState.noteFilePath === normalizedActivePath &&
          arePathArraysEqual(currentState.noteTabPaths, normalizedTabPaths)
        ) {
          return;
        }

        set({
          noteWorkspacePath: normalizedWorkspacePath,
          noteFilePath: normalizedActivePath,
          noteTabPaths: normalizedTabPaths,
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
      setLayoutSession: (root, activePaneId, panes) => {
        set({
          layoutRoot: root,
          layoutActivePaneId: activePaneId,
          layoutPanes: panes,
        });
      },
      getLayoutSession: () => {
        const state = get();
        if (!state.layoutRoot || !state.layoutActivePaneId || !state.layoutPanes) {
          return null;
        }
        return {
          root: state.layoutRoot,
          activePaneId: state.layoutActivePaneId,
          panes: state.layoutPanes,
        };
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        viewerMode: state.viewerMode,
        isSidebarCollapsed: state.isSidebarCollapsed,
        isNotesExpanded: state.isNotesExpanded,
        isSkillsExpanded: state.isSkillsExpanded,
        selectedNoteCollectionPath: state.selectedNoteCollectionPath,
        lastNotePathByCollection: state.lastNotePathByCollection,
        noteOrderByCollection: state.noteOrderByCollection,
        notesBrowserSearchQuery: state.notesBrowserSearchQuery,
        notesBrowserPaneWidth: state.notesBrowserPaneWidth,
        skillsBrowserPaneWidth: state.skillsBrowserPaneWidth,
        selectedSkillCollectionId: state.selectedSkillCollectionId,
        noteWorkspacePath: state.noteWorkspacePath,
        noteFilePath: state.noteFilePath,
        noteTabPaths: state.noteTabPaths,
        skillDocumentPath: state.skillDocumentPath,
        skillDocumentKind: state.skillDocumentKind,
        skillDocumentKindsById: state.skillDocumentKindsById,
        scrollPositions: state.scrollPositions,
        layoutRoot: state.layoutRoot,
        layoutActivePaneId: state.layoutActivePaneId,
        layoutPanes: state.layoutPanes,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export type { ViewerMode };
