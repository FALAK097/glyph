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

const getBoardPath = (workspaceRoot: string) => path.join(workspaceRoot, ".glyph", "tasks.md");

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clampIndex = (index: unknown, length: number) =>
  typeof index === "number" && Number.isFinite(index)
    ? Math.max(0, Math.min(Math.trunc(index), length))
    : length;

const parseMetaComment = (line: string, prefix: string): Record<string, string> | null => {
  const match = line.match(new RegExp(`<!--\\s*${prefix}:\\s*(.*?)\\s*-->`));
  if (!match) return null;
  const result: Record<string, string> = {};
  for (const part of match[1].split(/\s+/)) {
    const [key, value] = part.split("=");
    if (key && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

const parseTaskLine = (
  line: string,
): {
  title: string;
  labels: string[];
  dueDate: string | null;
  meta: Record<string, string>;
} | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("- [ ]") && !trimmed.startsWith("- [x]")) {
    return null;
  }

  let content = trimmed.slice(5).trim();
  let meta: Record<string, string> = {};

  const metaMatch = content.match(/<!--\s*task-meta:\s*(.*?)\s*-->$/);
  if (metaMatch) {
    meta = parseMetaComment(content, "task-meta") ?? {};
    content = content.slice(0, content.indexOf("<!--")).trim();
  }

  const dueMatch = content.match(/\s+due:(\d{4}-\d{2}-\d{2})\s*$/);
  const dueDate = dueMatch ? dueMatch[1] : null;
  if (dueMatch) {
    content = content.slice(0, dueMatch.index).trim();
  }

  const labels: string[] = [];
  const labelRegex = /#([A-Za-z][\w/-]*)/g;
  let labelMatch;
  while ((labelMatch = labelRegex.exec(content)) !== null) {
    labels.push(labelMatch[1]);
  }

  let title = content
    .replace(/#[A-Za-z][\w/-]*/g, "")
    .trim()
    .replace(/\s+/g, " ");

  return { title, labels, dueDate, meta };
};

const serializeTask = (task: WorkspaceTask): string => {
  const meta = `<!-- task-meta: id=${task.id} created=${task.createdAt} updated=${task.updatedAt} -->`;
  const labelStr = task.labels.map((l) => `#${l}`).join(" ");
  const dueStr = task.dueDate ? ` due:${task.dueDate}` : "";
  return `- [ ] ${task.title}${labelStr ? ` ${labelStr}` : ""}${dueStr} ${meta}`;
};

const serializeColumn = (column: TaskColumn): string => {
  const meta = `<!-- column-meta: id=${column.id} color=${column.color} collapsed=${column.collapsed} created=${column.createdAt} updated=${column.updatedAt} -->`;
  return `## ${column.title}\n${meta}`;
};

const createDefaultBoard = (): { columns: TaskColumn[]; tasks: WorkspaceTask[] } => {
  const now = Date.now();
  return {
    columns: DEFAULT_TASK_COLUMNS.map((column) => ({
      ...column,
      id: createId("column"),
      collapsed: false,
      taskIds: [],
      createdAt: now,
      updatedAt: now,
    })),
    tasks: [],
  };
};

const parseBoardMarkdown = (
  markdown: string,
): { columns: TaskColumn[]; tasks: WorkspaceTask[] } => {
  const lines = markdown.split("\n");
  const columns: TaskColumn[] = [];
  const tasks: WorkspaceTask[] = [];
  const columnTaskIds: string[][] = [];

  let currentColumnIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      const title = trimmed.slice(3).trim();
      let meta: Record<string, string> = {};
      if (i + 1 < lines.length) {
        const nextMeta = parseMetaComment(lines[i + 1], "column-meta");
        if (nextMeta) {
          meta = nextMeta;
          i++;
        }
      }
      const now = Date.now();
      const column: TaskColumn = {
        id: meta.id || createId("column"),
        title,
        color: isTaskColumnColor(meta.color) ? meta.color : "slate",
        collapsed: meta.collapsed === "true",
        taskIds: [],
        createdAt: meta.created ? Number(meta.created) : now,
        updatedAt: meta.updated ? Number(meta.updated) : now,
      };
      columns.push(column);
      columnTaskIds.push([]);
      currentColumnIndex = columns.length - 1;
      continue;
    }

    const taskData = parseTaskLine(line);
    if (taskData && currentColumnIndex >= 0) {
      const now = Date.now();
      const task: WorkspaceTask = {
        id: taskData.meta.id || createId("task"),
        title: taskData.title,
        columnId: columns[currentColumnIndex].id,
        labels: normalizeTaskLabels(taskData.labels),
        dueDate: taskData.dueDate,
        createdAt: taskData.meta.created ? Number(taskData.meta.created) : now,
        updatedAt: taskData.meta.updated ? Number(taskData.meta.updated) : now,
      };
      tasks.push(task);
      columnTaskIds[currentColumnIndex].push(task.id);
    }
  }

  for (let i = 0; i < columns.length; i++) {
    columns[i].taskIds = columnTaskIds[i];
  }

  return columns.length > 0 ? { columns, tasks } : createDefaultBoard();
};

const serializeBoardMarkdown = (columns: TaskColumn[], tasks: WorkspaceTask[]): string => {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const lines: string[] = ["# Tasks", ""];

  for (const column of columns) {
    lines.push(serializeColumn(column));
    lines.push("");
    for (const taskId of column.taskIds) {
      const task = taskById.get(taskId);
      if (task) {
        lines.push(serializeTask(task));
      }
    }
    lines.push("");
  }

  return lines.join("\n");
};

export function createTasksService() {
  let workspaceRoot: string | null = null;
  let columns: TaskColumn[] = [];
  let tasks: WorkspaceTask[] = [];
  let pendingSave: Promise<void> | null = null;
  let snapshot: TaskIndexSnapshot = {
    workspaceRoot: null,
    columns: [],
    tasks: [],
    summary: buildTaskSummary([], []),
    tagSuggestions: [],
    indexedAt: null,
  };

  const createSnapshot = (): TaskIndexSnapshot => {
    const labels = new Set<string>();
    for (const task of tasks) {
      for (const label of task.labels) {
        labels.add(label);
      }
    }

    return {
      workspaceRoot,
      columns,
      tasks,
      summary: buildTaskSummary(columns, tasks),
      tagSuggestions: Array.from(labels).sort((a, b) => a.localeCompare(b)),
      indexedAt: Date.now(),
    };
  };

  const save = async () => {
    if (!workspaceRoot) {
      return;
    }

    const filePath = getBoardPath(workspaceRoot);
    const data = serializeBoardMarkdown(columns, tasks);
    const nextSnapshot = createSnapshot();

    pendingSave = (pendingSave ?? Promise.resolve()).then(async () => {
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, data, "utf8");
      } catch (writeError) {
        console.error("Failed to save tasks board:", writeError);
      }
    });
    snapshot = nextSnapshot;
    await pendingSave;
  };

  const rebuild = async () => {
    if (!workspaceRoot) {
      const board = createDefaultBoard();
      columns = board.columns;
      tasks = board.tasks;
      snapshot = createSnapshot();
      return snapshot;
    }

    const filePath = getBoardPath(workspaceRoot);
    try {
      const parsed = parseBoardMarkdown(await fs.readFile(filePath, "utf8"));
      columns = parsed.columns;
      tasks = parsed.tasks;
    } catch (readError) {
      const code =
        typeof readError === "object" && readError && "code" in readError
          ? String((readError as { code?: unknown }).code)
          : "";
      if (code === "ENOENT") {
        const board = createDefaultBoard();
        columns = board.columns;
        tasks = board.tasks;
        await save();
      } else {
        throw readError;
      }
    }
    snapshot = createSnapshot();
    return snapshot;
  };

  const getColumn = (columnId: string) => columns.find((column) => column.id === columnId);
  const getTask = (taskId: string) => tasks.find((task) => task.id === taskId);

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

    for (const column of columns) {
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
    tasks.push(task);
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
    tasks = tasks.filter((entry) => entry.id !== task.id);
    for (const column of columns) {
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
    columns.splice(clampIndex(input.index, columns.length), 0, column);
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
    const from = columns.findIndex((column) => column.id === input.id);
    if (from < 0) {
      return mutationError("missing-column", "Task list no longer exists.");
    }
    const [column] = columns.splice(from, 1);
    columns.splice(clampIndex(input.index, columns.length), 0, column);
    column.updatedAt = Date.now();
    await save();
    return { ok: true, column, snapshot };
  };

  const deleteColumn = async (input: TaskColumnDeleteInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before deleting lists.");
    }
    if (columns.length <= 1) {
      return mutationError("invalid-input", "Keep at least one list.");
    }
    const column = getColumn(input.id);
    if (!column) {
      return mutationError("missing-column", "Task list no longer exists.");
    }
    const deletingTaskIds = new Set(column.taskIds);
    columns = columns.filter((entry) => entry.id !== column.id);
    tasks = tasks.filter((task) => !deletingTaskIds.has(task.id));
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
