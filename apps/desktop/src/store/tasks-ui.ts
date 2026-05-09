import { create } from "zustand";

export type TasksViewMode = "board" | "table";

export const TASK_VIEW_STORAGE_KEY = "glyph.tasks.viewMode";
export const ADD_TO_TOP_STORAGE_KEY = "glyph.tasks.addToTop";

const isTasksViewMode = (value: string | null): value is TasksViewMode =>
  value === "board" || value === "table";

const getInitialViewMode = (): TasksViewMode => {
  try {
    const stored = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
    return isTasksViewMode(stored) ? stored : "board";
  } catch {
    return "board";
  }
};

const getInitialAddToTop = (): Record<string, boolean> => {
  try {
    const stored = window.localStorage.getItem(ADD_TO_TOP_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

type TasksUIState = {
  isSearching: boolean;
  searchQuery: string;
  viewMode: TasksViewMode;
  isAddingColumn: boolean;
  addToTopByColumn: Record<string, boolean>;
  setIsSearching: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  setViewMode: (mode: TasksViewMode) => void;
  setIsAddingColumn: (value: boolean) => void;
  setAddToTopForColumn: (columnId: string, addToTop: boolean) => void;
};

export const useTasksUIStore = create<TasksUIState>()((set) => ({
  isSearching: false,
  searchQuery: "",
  viewMode: getInitialViewMode(),
  isAddingColumn: false,
  addToTopByColumn: getInitialAddToTop(),
  setIsSearching: (value) => set({ isSearching: value }),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setViewMode: (mode) => {
    set({ viewMode: mode });
    try {
      window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, mode);
      window.dispatchEvent(new Event("glyph:tasks-view-changed"));
    } catch {
      // ignore storage errors
    }
  },
  setIsAddingColumn: (value) => set({ isAddingColumn: value }),
  setAddToTopForColumn: (columnId, addToTop) => {
    set((state) => {
      const next = { ...state.addToTopByColumn, [columnId]: addToTop };
      try {
        window.localStorage.setItem(ADD_TO_TOP_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return { addToTopByColumn: next };
    });
  },
}));
