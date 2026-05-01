import fs from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_TASK_COLUMNS,
  buildTaskSummary,
  isTaskColumnColor,
  normalizeTaskLabels,
} from "../src/core/tasks.js";
import type {
  TaskColumn,
  TaskColumnCreateInput,
  TaskColumnDeleteInput,
  TaskColumnMoveInput,
  TaskColumnUpdateInput,
  TaskCreateInput,
  TaskDeleteInput,
  TaskIndexSnapshot,
  TaskMoveInput,
  TaskMutationResult,
  TaskUpdateInput,
  WorkspaceTask,
} from "../src/core/tasks.js";

type TaskBoardFile = {
  version: 1;
  columns: TaskColumn[];
  tasks: WorkspaceTask[];
};

const getBoardPath = (workspaceRoot: string) =>
  path.join(workspaceRoot, ".glyph", "tasks-board.json");

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clampIndex = (index: unknown, length: number) =>
  typeof index === "number" && Number.isFinite(index)
    ? Math.max(0, Math.min(Math.trunc(index), length))
    : length;

const createDefaultBoard = (): TaskBoardFile => {
  const now = Date.now();
  return {
    version: 1,
    columns: DEFAULT_TASK_COLUMNS.map((column) => ({
      ...column,
      collapsed: false,
      taskIds: [],
      createdAt: now,
      updatedAt: now,
    })),
    tasks: [],
  };
};

const normalizeBoard = (input: unknown): TaskBoardFile => {
  if (!input || typeof input !== "object") {
    return createDefaultBoard();
  }

  const raw = input as Partial<TaskBoardFile>;
  const now = Date.now();
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .filter((task): task is WorkspaceTask => Boolean(task?.id && task.title && task.columnId))
        .map((task) => ({
          id: task.id,
          title: String(task.title),
          columnId: String(task.columnId),
          labels: normalizeTaskLabels(task.labels),
          dueDate: typeof task.dueDate === "string" && task.dueDate ? task.dueDate : null,
          createdAt: typeof task.createdAt === "number" ? task.createdAt : now,
          updatedAt: typeof task.updatedAt === "number" ? task.updatedAt : now,
        }))
    : [];
  const taskIds = new Set(tasks.map((task) => task.id));
  const columns = Array.isArray(raw.columns)
    ? raw.columns
        .filter((column): column is TaskColumn => Boolean(column?.id && column.title))
        .map((column) => ({
          id: String(column.id),
          title: String(column.title),
          color: isTaskColumnColor(column.color) ? column.color : "slate",
          collapsed: Boolean(column.collapsed),
          taskIds: Array.isArray(column.taskIds)
            ? column.taskIds.filter((id): id is string => typeof id === "string" && taskIds.has(id))
            : [],
          createdAt: typeof column.createdAt === "number" ? column.createdAt : now,
          updatedAt: typeof column.updatedAt === "number" ? column.updatedAt : now,
        }))
    : [];

  return columns.length > 0 ? { version: 1, columns, tasks } : createDefaultBoard();
};

export function createTasksService() {
  let workspaceRoot: string | null = null;
  let board = createDefaultBoard();
  let snapshot: TaskIndexSnapshot = {
    workspaceRoot: null,
    columns: board.columns,
    tasks: [],
    summary: buildTaskSummary(board.columns, []),
    tagSuggestions: [],
    indexedAt: null,
  };

  const createSnapshot = (): TaskIndexSnapshot => {
    const labels = new Set<string>();
    for (const task of board.tasks) {
      for (const label of task.labels) {
        labels.add(label);
      }
    }

    return {
      workspaceRoot,
      columns: board.columns,
      tasks: board.tasks,
      summary: buildTaskSummary(board.columns, board.tasks),
      tagSuggestions: Array.from(labels).sort((a, b) => a.localeCompare(b)),
      indexedAt: Date.now(),
    };
  };

  const save = async () => {
    if (!workspaceRoot) {
      return;
    }

    const filePath = getBoardPath(workspaceRoot);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
    snapshot = createSnapshot();
  };

  const rebuild = async () => {
    if (!workspaceRoot) {
      board = createDefaultBoard();
      snapshot = createSnapshot();
      return snapshot;
    }

    const filePath = getBoardPath(workspaceRoot);
    try {
      board = normalizeBoard(JSON.parse(await fs.readFile(filePath, "utf8")));
    } catch {
      board = createDefaultBoard();
      await save();
    }
    snapshot = createSnapshot();
    return snapshot;
  };

  const getColumn = (columnId: string) => board.columns.find((column) => column.id === columnId);
  const getTask = (taskId: string) => board.tasks.find((task) => task.id === taskId);

  const mutationError = (
    reason: Extract<TaskMutationResult, { ok: false }>["reason"],
    message: string,
  ): TaskMutationResult => ({ ok: false, reason, message, snapshot });

  const moveTask = async (input: TaskMoveInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before editing tasks.");
    }

    const task = getTask(input.id);
    const targetColumn = getColumn(input.columnId);
    if (!task) {
      return mutationError("missing-task", "Task no longer exists.");
    }
    if (!targetColumn) {
      return mutationError("missing-column", "Task list no longer exists.");
    }

    for (const column of board.columns) {
      column.taskIds = column.taskIds.filter((taskId) => taskId !== task.id);
    }
    const targetIndex = clampIndex(input.index, targetColumn.taskIds.length);
    targetColumn.taskIds.splice(targetIndex, 0, task.id);
    task.columnId = targetColumn.id;
    task.updatedAt = Date.now();
    targetColumn.updatedAt = task.updatedAt;
    await save();
    return { ok: true, task, snapshot };
  };

  const createTask = async (input: TaskCreateInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before creating tasks.");
    }

    const column = getColumn(input.columnId);
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!column) {
      return mutationError("missing-column", "Choose a valid list for this task.");
    }
    if (!title) {
      return mutationError("invalid-input", "Task title cannot be empty.");
    }

    const now = Date.now();
    const task: WorkspaceTask = {
      id: createId("task"),
      title,
      columnId: column.id,
      labels: normalizeTaskLabels(input.labels),
      dueDate:
        typeof input.dueDate === "string" && input.dueDate.trim() ? input.dueDate.trim() : null,
      createdAt: now,
      updatedAt: now,
    };
    board.tasks.push(task);
    column.taskIds.splice(clampIndex(input.index, column.taskIds.length), 0, task.id);
    column.updatedAt = now;
    await save();
    return { ok: true, task, snapshot };
  };

  const updateTask = async (input: TaskUpdateInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before editing tasks.");
    }

    const task = getTask(input.id);
    if (!task) {
      return mutationError("missing-task", "Task no longer exists.");
    }

    if (input.columnId && input.columnId !== task.columnId) {
      return moveTask({ id: task.id, columnId: input.columnId, index: Number.MAX_SAFE_INTEGER });
    }

    if (typeof input.title === "string" && input.title.trim()) {
      task.title = input.title.trim();
    }
    if (input.labels !== undefined) {
      task.labels = normalizeTaskLabels(input.labels);
    }
    if (input.dueDate !== undefined) {
      task.dueDate =
        typeof input.dueDate === "string" && input.dueDate.trim() ? input.dueDate.trim() : null;
    }
    task.updatedAt = Date.now();
    await save();
    return { ok: true, task, snapshot };
  };

  const deleteTask = async (input: TaskDeleteInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before deleting tasks.");
    }
    const task = getTask(input.id);
    if (!task) {
      return mutationError("missing-task", "Task no longer exists.");
    }
    board.tasks = board.tasks.filter((entry) => entry.id !== task.id);
    for (const column of board.columns) {
      column.taskIds = column.taskIds.filter((taskId) => taskId !== task.id);
    }
    await save();
    return { ok: true, task, snapshot };
  };

  const createColumn = async (input: TaskColumnCreateInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before creating lists.");
    }
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) {
      return mutationError("invalid-input", "List name cannot be empty.");
    }
    const now = Date.now();
    const column: TaskColumn = {
      id: createId("column"),
      title,
      color: isTaskColumnColor(input.color) ? input.color : "blue",
      collapsed: false,
      taskIds: [],
      createdAt: now,
      updatedAt: now,
    };
    board.columns.splice(clampIndex(input.index, board.columns.length), 0, column);
    await save();
    return { ok: true, column, snapshot };
  };

  const updateColumn = async (input: TaskColumnUpdateInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before editing lists.");
    }
    const column = getColumn(input.id);
    if (!column) {
      return mutationError("missing-column", "Task list no longer exists.");
    }
    if (typeof input.title === "string" && input.title.trim()) {
      column.title = input.title.trim();
    }
    if (isTaskColumnColor(input.color)) {
      column.color = input.color;
    }
    if (typeof input.collapsed === "boolean") {
      column.collapsed = input.collapsed;
    }
    column.updatedAt = Date.now();
    await save();
    return { ok: true, column, snapshot };
  };

  const moveColumn = async (input: TaskColumnMoveInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before moving lists.");
    }
    const from = board.columns.findIndex((column) => column.id === input.id);
    if (from < 0) {
      return mutationError("missing-column", "Task list no longer exists.");
    }
    const [column] = board.columns.splice(from, 1);
    board.columns.splice(clampIndex(input.index, board.columns.length), 0, column);
    column.updatedAt = Date.now();
    await save();
    return { ok: true, column, snapshot };
  };

  const deleteColumn = async (input: TaskColumnDeleteInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before deleting lists.");
    }
    if (board.columns.length <= 1) {
      return mutationError("invalid-input", "Keep at least one list.");
    }
    const column = getColumn(input.id);
    if (!column) {
      return mutationError("missing-column", "Task list no longer exists.");
    }
    const deletingTaskIds = new Set(column.taskIds);
    board.columns = board.columns.filter((entry) => entry.id !== column.id);
    board.tasks = board.tasks.filter((task) => !deletingTaskIds.has(task.id));
    await save();
    return { ok: true, column, snapshot };
  };

  return {
    createColumn,
    createTask,
    deleteColumn,
    deleteTask,
    getSnapshot: () => snapshot,
    moveColumn,
    moveTask,
    rebuild,
    refreshChanged: async () => snapshot,
    setWorkspace(nextWorkspaceRoot: string | null) {
      workspaceRoot = nextWorkspaceRoot;
    },
    updateColumn,
    updateTask,
  };
}
