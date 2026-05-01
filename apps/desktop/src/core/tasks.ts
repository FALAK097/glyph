export const TASK_COLUMN_COLORS = [
  "blue",
  "amber",
  "violet",
  "emerald",
  "rose",
  "slate",
  "cyan",
  "orange",
  "pink",
  "lime",
] as const;

export type TaskColumnColor = (typeof TASK_COLUMN_COLORS)[number];

/** Curated subset of visually-distinct colors shown in UI pickers.
 *  Backwards-compatible: removed colors still exist in data. */
export const TASK_COLUMN_COLORS_PICKER: TaskColumnColor[] = [
  "blue",
  "rose",
  "emerald",
  "amber",
  "cyan",
  "violet",
  "slate",
];

export type TaskColumn = {
  id: string;
  title: string;
  color: TaskColumnColor;
  collapsed: boolean;
  taskIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type WorkspaceTask = {
  id: string;
  title: string;
  columnId: string;
  labels: string[];
  dueDate: string | null;
  createdAt: number;
  updatedAt: number;
};

export type TaskSummary = {
  total: number;
  open: number;
  done: number;
  byColumn: Record<string, number>;
};

export type TaskIndexSnapshot = {
  workspaceRoot: string | null;
  columns: TaskColumn[];
  tasks: WorkspaceTask[];
  summary: TaskSummary;
  tagSuggestions: string[];
  indexedAt: number | null;
};

export type TaskMutationResult =
  | {
      ok: true;
      task?: WorkspaceTask;
      column?: TaskColumn;
      snapshot: TaskIndexSnapshot;
    }
  | {
      ok: false;
      reason: "missing-workspace" | "missing-task" | "missing-column" | "invalid-input";
      message: string;
      snapshot?: TaskIndexSnapshot;
    };

export type TaskCreateInput = {
  title: string;
  columnId: string;
  labels?: string[];
  dueDate?: string | null;
  index?: number;
};

export type TaskUpdateInput = {
  id: string;
  title?: string;
  columnId?: string;
  labels?: string[];
  dueDate?: string | null;
};

export type TaskMoveInput = {
  id: string;
  columnId: string;
  index: number;
};

export type TaskDeleteInput = {
  id: string;
};

export type TaskColumnCreateInput = {
  title: string;
  color?: TaskColumnColor;
  index?: number;
};

export type TaskColumnUpdateInput = {
  id: string;
  title?: string;
  color?: TaskColumnColor;
  collapsed?: boolean;
};

export type TaskColumnMoveInput = {
  id: string;
  index: number;
};

export type TaskColumnDeleteInput = {
  id: string;
};

export const DEFAULT_TASK_COLUMNS: Array<Pick<TaskColumn, "id" | "title" | "color">> = [
  { id: "todo", title: "Todo", color: "blue" },
  { id: "in-progress", title: "In Progress", color: "amber" },
  { id: "done", title: "Done", color: "violet" },
];

export function buildTaskSummary(columns: TaskColumn[], tasks: WorkspaceTask[]): TaskSummary {
  const byColumn = Object.fromEntries(columns.map((column) => [column.id, column.taskIds.length]));
  const doneColumn = columns.find((column) => column.title.toLowerCase().includes("done"));
  const done = doneColumn ? doneColumn.taskIds.length : 0;

  return {
    total: tasks.length,
    open: Math.max(0, tasks.length - done),
    done,
    byColumn,
  };
}

export function normalizeTaskLabels(labels: unknown) {
  if (!Array.isArray(labels)) {
    return [];
  }

  return Array.from(
    new Set(
      labels
        .map((label) => (typeof label === "string" ? label.trim().replace(/^#/, "") : ""))
        .filter((label) => /^[A-Za-z][\w/-]*$/.test(label)),
    ),
  );
}

export function isTaskColumnColor(value: unknown): value is TaskColumnColor {
  return typeof value === "string" && TASK_COLUMN_COLORS.includes(value as TaskColumnColor);
}
