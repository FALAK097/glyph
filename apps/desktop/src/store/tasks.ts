import { create } from "zustand";

import type {
  TaskColumn,
  TaskIndexSnapshot,
  TaskMutationResult,
  WorkspaceTask,
} from "@/core/tasks";
import { buildTaskSummary } from "@/core/tasks";

type TasksState = {
  columns: TaskColumn[];
  tasks: WorkspaceTask[];
  summary: TaskIndexSnapshot["summary"];
  tagSuggestions: string[];
  workspaceRoot: string | null;
  indexedAt: number | null;
  isLoading: boolean;
  error: string | null;
  selectedTaskId: string | null;
  setSnapshot: (snapshot: TaskIndexSnapshot) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedTaskId: (taskId: string | null) => void;
};

const emptySummary = buildTaskSummary([], []);

export const useTasksStore = create<TasksState>()((set) => ({
  columns: [],
  tasks: [],
  summary: emptySummary,
  tagSuggestions: [],
  workspaceRoot: null,
  indexedAt: null,
  isLoading: false,
  error: null,
  selectedTaskId: null,
  setSnapshot: (snapshot) => {
    set({
      columns: snapshot.columns,
      tasks: snapshot.tasks,
      summary: snapshot.summary,
      tagSuggestions: snapshot.tagSuggestions,
      workspaceRoot: snapshot.workspaceRoot,
      indexedAt: snapshot.indexedAt,
      isLoading: false,
      error: null,
    });
  },
  setLoading: (isLoading) => {
    set({ isLoading });
  },
  setError: (error) => {
    set({ error, isLoading: false });
  },
  setSelectedTaskId: (selectedTaskId) => {
    set({ selectedTaskId });
  },
}));

export function groupTasksByColumn(columns: TaskColumn[], tasks: WorkspaceTask[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return Object.fromEntries(
    columns.map((column) => [
      column.id,
      column.taskIds
        .map((taskId) => taskById.get(taskId))
        .filter((task): task is WorkspaceTask => Boolean(task)),
    ]),
  );
}

export async function applyTaskMutation(
  mutation: Promise<TaskMutationResult>,
  setSnapshot: (snapshot: TaskIndexSnapshot) => void,
) {
  const result = await mutation;
  if (result.snapshot) {
    setSnapshot(result.snapshot);
  }
  return result;
}
