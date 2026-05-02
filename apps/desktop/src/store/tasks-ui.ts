import { create } from "zustand";

export type TasksViewMode = "board" | "table";

export const TASK_VIEW_STORAGE_KEY = "glyph.tasks.viewMode";

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

type TasksUIState = {
  isSearching: boolean;
  searchQuery: string;
  viewMode: TasksViewMode;
  isAddingColumn: boolean;
  setIsSearching: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  setViewMode: (mode: TasksViewMode) => void;
  setIsAddingColumn: (value: boolean) => void;
};

export const useTasksUIStore = create<TasksUIState>()((set) => ({
  isSearching: false,
  searchQuery: "",
  viewMode: getInitialViewMode(),
  isAddingColumn: false,
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
}));
