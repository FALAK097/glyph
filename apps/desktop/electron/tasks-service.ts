import fs from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_TASK_COLUMNS,
  buildTaskSummary,
  isTaskColumnColor,
  normalizeTaskLabels,
} from "../src/core/tasks.js";
import type {
  ArchivedTaskEntry,
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
  TaskUnarchiveInput,
  TaskUpdateInput,
  WorkspaceTask,
} from "../src/core/tasks.js";

const getBoardPath = (workspaceRoot: string) => path.join(workspaceRoot, "Tasks.md");

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

// NOTE: $ anchor removed so archive lines with trailing <!-- list: ... --> comments parse correctly.
const parseTaskLine = (
  line: string,
): {
  title: string;
  labels: string[];
  dueDate: string | null;
  completed: boolean;
  meta: Record<string, string>;
} | null => {
  const trimmed = line.trim();
  const isChecked = trimmed.startsWith("- [x]");
  if (!isChecked && !trimmed.startsWith("- [ ]")) {
    return null;
  }

  let content = trimmed.slice(5).trim();
  let meta: Record<string, string> = {};

  const metaMatch = content.match(/<!--\s*task-meta:\s*(.*?)\s*-->/);
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

  const title = content
    .replace(/#[A-Za-z][\w/-]*/g, "")
    .trim()
    .replace(/\s+/g, " ");

  return { title, labels, dueDate, completed: isChecked, meta };
};

const serializeTask = (task: WorkspaceTask, columnIsDone = false): string => {
  const meta = `<!-- task-meta: id=${task.id} created=${task.createdAt} updated=${task.updatedAt} -->`;
  const labelStr = task.labels.map((l) => `#${l}`).join(" ");
  const dueStr = task.dueDate ? ` due:${task.dueDate}` : "";
  // Render [x] if the column is a "done" column OR if the task itself is marked completed.
  const checkbox = columnIsDone || task.completed ? "- [x]" : "- [ ]";
  return `${checkbox} ${task.title}${labelStr ? ` ${labelStr}` : ""}${dueStr} ${meta}`;
};

const serializeArchivedEntry = (entry: ArchivedTaskEntry): string => {
  const meta = `<!-- task-meta: id=${entry.id} created=${entry.createdAt} updated=${entry.updatedAt} -->`;
  const labelStr = entry.labels.map((l) => `#${l}`).join(" ");
  const dueStr = entry.dueDate ? ` due:${entry.dueDate}` : "";
  const listComment = entry.sourceColumnTitle ? ` <!-- list: ${entry.sourceColumnTitle} -->` : "";
  // Archived tasks are always rendered as checked — they are done by definition.
  return `- [x] ${entry.title}${labelStr ? ` ${labelStr}` : ""}${dueStr} ${meta}${listComment}`;
};

const serializeColumn = (column: TaskColumn): string => {
  const meta = `<!-- column-meta: id=${column.id} color=${column.color} collapsed=${column.collapsed} isDone=${column.isDone} created=${column.createdAt} updated=${column.updatedAt} -->`;
  return `## ${column.title}\n${meta}`;
};

type ArchiveSection = {
  dateLabel: string;
  entries: ArchivedTaskEntry[];
};

const createDefaultBoard = (): { columns: TaskColumn[]; tasks: WorkspaceTask[] } => {
  const now = Date.now();
  return {
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

const parseBoardMarkdown = (
  markdown: string,
): { columns: TaskColumn[]; tasks: WorkspaceTask[]; archiveSections: ArchiveSection[] } => {
  const lines = markdown.split("\n");
  const columns: TaskColumn[] = [];
  const tasks: WorkspaceTask[] = [];
  const columnTaskIds: string[][] = [];
  const archiveSections: ArchiveSection[] = [];

  let currentColumnIndex = -1;
  let inArchive = false;
  let currentArchiveSectionIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Top-level "# Archive" heading marks start of archive section — stop board parsing
    if (trimmed === "# Archive") {
      inArchive = true;
      currentColumnIndex = -1;
      continue;
    }

    if (inArchive) {
      // Archive date subsections like "## Archived 2024-01-15"
      if (trimmed.startsWith("## Archived ")) {
        const dateLabel = trimmed.slice("## Archived ".length).trim();
        archiveSections.push({ dateLabel, entries: [] });
        currentArchiveSectionIndex = archiveSections.length - 1;
        continue;
      }

      // Parse archived task lines
      if (currentArchiveSectionIndex >= 0) {
        const taskData = parseTaskLine(line);
        if (taskData) {
          // Extract <!-- list: ColumnName --> comment from the original line
          const listMatch = line.match(/<!--\s*list:\s*(.*?)\s*-->/);
          const sourceColumnTitle = listMatch ? listMatch[1].trim() : "";
          const now = Date.now();
          const entry: ArchivedTaskEntry = {
            id: taskData.meta.id || createId("task"),
            title: taskData.title,
            labels: normalizeTaskLabels(taskData.labels),
            dueDate: taskData.dueDate,
            completed: taskData.completed,
            createdAt: taskData.meta.created ? Number(taskData.meta.created) : now,
            updatedAt: taskData.meta.updated ? Number(taskData.meta.updated) : now,
            archivedAt: archiveSections[currentArchiveSectionIndex]?.dateLabel ?? "",
            sourceColumnTitle,
          };
          archiveSections[currentArchiveSectionIndex]!.entries.push(entry);
        }
      }
      continue;
    }

    // Active board: parse column headers
    if (trimmed.startsWith("## ")) {
      const title = trimmed.slice(3).trim();
      let meta: Record<string, string> = {};
      // Look past any blank lines for the column-meta comment. Markdown editors
      // sometimes insert an empty line between the heading and the comment.
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.trim() === "") continue;
        const nextMeta = parseMetaComment(nextLine, "column-meta");
        if (nextMeta) {
          meta = nextMeta;
          i = j;
        }
        break; // stop at the first non-blank line regardless of whether it was meta
      }
      const now = Date.now();

      // Auto-migrate: columns titled "Done" (case-insensitive) with no explicit isDone in meta
      // get isDone=true for backward compatibility with pre-isDone workspaces.
      const hasExplicitIsDone = meta.isDone !== undefined;
      const isDoneByTitle = !hasExplicitIsDone && title.toLowerCase() === "done";
      const isDone = hasExplicitIsDone ? meta.isDone === "true" : isDoneByTitle;

      const column: TaskColumn = {
        id: meta.id || createId("column"),
        title,
        color: isTaskColumnColor(meta.color) ? meta.color : "slate",
        collapsed: meta.collapsed === "true",
        isDone,
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
        columnId: columns[currentColumnIndex]!.id,
        labels: normalizeTaskLabels(taskData.labels),
        dueDate: taskData.dueDate,
        completed: taskData.completed,
        createdAt: taskData.meta.created ? Number(taskData.meta.created) : now,
        updatedAt: taskData.meta.updated ? Number(taskData.meta.updated) : now,
      };
      tasks.push(task);
      columnTaskIds[currentColumnIndex]!.push(task.id);
    }
  }

  for (let i = 0; i < columns.length; i++) {
    columns[i]!.taskIds = columnTaskIds[i]!;
  }

  if (columns.length === 0) {
    const defaultBoard = createDefaultBoard();
    return { ...defaultBoard, archiveSections };
  }

  return { columns, tasks, archiveSections };
};

const serializeBoardMarkdown = (
  columns: TaskColumn[],
  tasks: WorkspaceTask[],
  archiveSections: ArchiveSection[],
): string => {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const lines: string[] = ["# Tasks", ""];

  for (const column of columns) {
    lines.push(serializeColumn(column));
    lines.push("");
    for (const taskId of column.taskIds) {
      const task = taskById.get(taskId);
      if (task) {
        lines.push(serializeTask(task, column.isDone));
      }
    }
    lines.push("");
  }

  // Append archive sections if any exist
  if (archiveSections.length > 0) {
    lines.push("# Archive", "");
    for (const section of archiveSections) {
      lines.push(`## Archived ${section.dateLabel}`, "");
      for (const entry of section.entries) {
        lines.push(serializeArchivedEntry(entry));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
};

export function createTasksService() {
  let workspaceRoot: string | null = null;
  let columns: TaskColumn[] = [];
  let tasks: WorkspaceTask[] = [];
  let archiveSections: ArchiveSection[] = [];
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
    const data = serializeBoardMarkdown(columns, tasks, archiveSections);
    const nextSnapshot = createSnapshot();

    const write = async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, data, "utf8");
      snapshot = nextSnapshot;
    };

    pendingSave = (pendingSave ?? Promise.resolve()).then(write, write);
    await pendingSave;
  };

  const rebuild = async () => {
    if (!workspaceRoot) {
      const board = createDefaultBoard();
      columns = board.columns;
      tasks = board.tasks;
      archiveSections = [];
      snapshot = createSnapshot();
      return snapshot;
    }

    const filePath = getBoardPath(workspaceRoot);
    try {
      const parsed = parseBoardMarkdown(await fs.readFile(filePath, "utf8"));
      columns = parsed.columns;
      tasks = parsed.tasks;
      archiveSections = parsed.archiveSections;
    } catch (readError) {
      const code =
        typeof readError === "object" && readError && "code" in readError
          ? String((readError as { code?: unknown }).code)
          : "";
      if (code === "ENOENT") {
        const board = createDefaultBoard();
        columns = board.columns;
        tasks = board.tasks;
        archiveSections = [];
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
      completed: false,
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
    if (typeof input.completed === "boolean") {
      task.completed = input.completed;
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
      isDone: typeof input.isDone === "boolean" ? input.isDone : false,
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
    if (typeof input.isDone === "boolean") {
      column.isDone = input.isDone;
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
    columns.splice(clampIndex(input.index, columns.length), 0, column!);
    column!.updatedAt = Date.now();
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

  /**
   * Archives all tasks from columns marked isDone=true into a dated section
   * inside Tasks.md under the "# Archive" heading. Tasks are removed from the
   * active board after archiving.
   */
  const archiveCompletedTasks = async (): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before archiving tasks.");
    }

    const doneColumns = columns.filter((column) => column.isDone);
    const tasksToArchive = tasks.filter((task) =>
      doneColumns.some((column) => column.id === task.columnId),
    );

    if (tasksToArchive.length === 0) {
      return { ok: true, snapshot };
    }

    const columnById = new Map(columns.map((c) => [c.id, c]));
    const dateLabel = new Date().toISOString().slice(0, 10);

    const newEntries: ArchivedTaskEntry[] = tasksToArchive.map((task) => ({
      id: task.id,
      title: task.title,
      labels: task.labels,
      dueDate: task.dueDate,
      completed: task.completed,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      archivedAt: dateLabel,
      sourceColumnTitle: columnById.get(task.columnId)?.title ?? "",
    }));

    // Find or create today's archive section
    const existingSection = archiveSections.find((s) => s.dateLabel === dateLabel);
    if (existingSection) {
      existingSection.entries.push(...newEntries);
    } else {
      archiveSections.push({ dateLabel, entries: newEntries });
    }

    // Remove archived tasks from the active board
    const archivedIds = new Set(tasksToArchive.map((t) => t.id));
    tasks = tasks.filter((t) => !archivedIds.has(t.id));
    for (const column of columns) {
      column.taskIds = column.taskIds.filter((id) => !archivedIds.has(id));
    }

    await save();
    return { ok: true, snapshot };
  };

  const getArchivedTasks = (): ArchivedTaskEntry[] => {
    return archiveSections.flatMap((section) => section.entries);
  };

  const unarchiveTask = async (input: TaskUnarchiveInput): Promise<TaskMutationResult> => {
    if (!workspaceRoot) {
      return mutationError("missing-workspace", "Open a workspace before restoring tasks.");
    }

    const targetColumn = getColumn(input.columnId);
    if (!targetColumn) {
      return mutationError("missing-column", "Target list no longer exists.");
    }

    // Find the archived entry across all sections
    let foundEntry: ArchivedTaskEntry | null = null;
    let foundSectionIndex = -1;
    for (let i = 0; i < archiveSections.length; i++) {
      const entry = archiveSections[i]!.entries.find((e) => e.id === input.taskId);
      if (entry) {
        foundEntry = entry;
        foundSectionIndex = i;
        break;
      }
    }

    if (!foundEntry) {
      return mutationError("missing-task", "Archived task not found.");
    }

    // Restore as a WorkspaceTask
    const now = Date.now();
    const restoredTask: WorkspaceTask = {
      id: foundEntry.id,
      title: foundEntry.title,
      columnId: targetColumn.id,
      labels: foundEntry.labels,
      dueDate: foundEntry.dueDate,
      completed: foundEntry.completed,
      createdAt: foundEntry.createdAt,
      updatedAt: now,
    };

    tasks.push(restoredTask);
    targetColumn.taskIds.push(restoredTask.id);
    targetColumn.updatedAt = now;

    // Remove from archive section
    archiveSections[foundSectionIndex]!.entries = archiveSections[
      foundSectionIndex
    ]!.entries.filter((e) => e.id !== input.taskId);
    // Prune empty sections
    archiveSections = archiveSections.filter((s) => s.entries.length > 0);

    await save();
    snapshot = createSnapshot();
    return { ok: true, task: restoredTask, snapshot };
  };

  return {
    archiveCompletedTasks,
    createColumn,
    createTask,
    deleteColumn,
    deleteTask,
    getArchivedTasks,
    getSnapshot: () => snapshot,
    moveColumn,
    moveTask,
    rebuild,
    refreshChanged: async () => (workspaceRoot ? rebuild() : snapshot),
    setWorkspace(nextWorkspaceRoot: string | null) {
      workspaceRoot = nextWorkspaceRoot;
    },
    unarchiveTask,
    updateColumn,
    updateTask,
  };
}
