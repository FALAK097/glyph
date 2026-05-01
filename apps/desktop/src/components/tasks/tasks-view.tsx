import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  FileIcon,
  OutlineIcon,
  PlusIcon,
  SearchIcon,
  TickIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TaskColumn as TaskColumnModel, TaskColumnColor, WorkspaceTask } from "@/core/tasks";
import { TASK_COLUMN_COLORS_PICKER } from "@/core/tasks";
import { cn } from "@/core/utils";
import { applyTaskMutation, groupTasksByColumn, useTasksStore } from "@/store/tasks";

import { TaskCardSurface } from "./task-card";
import { TaskColumn } from "./task-column";
import { getErrorMessage } from "./task-view-model";

type TasksViewProps = {
  glyph: NonNullable<Window["glyph"]>;
  onOpenTaskSource: (task: WorkspaceTask) => void;
  onOpenMarkdown: () => void;
};

type TasksViewMode = "board" | "table";

type SortColumn = "task" | "list" | "date";
type SortDirection = "asc" | "desc";

const TASK_VIEW_STORAGE_KEY = "glyph.tasks.viewMode";

const COLOR_DOTS: Record<TaskColumnColor, string> = {
  amber: "border-chart-2",
  blue: "border-primary",
  cyan: "border-chart-3",
  emerald: "border-chart-5",
  lime: "border-chart-5",
  orange: "border-chart-2",
  pink: "border-chart-4",
  rose: "border-destructive",
  slate: "border-muted-foreground",
  violet: "border-chart-4",
};

const LIST_TEXT_COLORS: Record<TaskColumnColor, string> = {
  amber: "text-chart-2",
  blue: "text-primary",
  cyan: "text-chart-3",
  emerald: "text-chart-5",
  lime: "text-chart-5",
  orange: "text-chart-2",
  pink: "text-chart-4",
  rose: "text-destructive",
  slate: "text-muted-foreground",
  violet: "text-chart-4",
};

const LIST_BG_COLORS: Record<TaskColumnColor, string> = {
  amber: "bg-chart-2/10",
  blue: "bg-primary/10",
  cyan: "bg-chart-3/10",
  emerald: "bg-chart-5/10",
  lime: "bg-chart-5/10",
  orange: "bg-chart-2/10",
  pink: "bg-chart-4/10",
  rose: "bg-destructive/10",
  slate: "bg-muted",
  violet: "bg-chart-4/10",
};

const isTasksViewMode = (value: string | null): value is TasksViewMode =>
  value === "board" || value === "table";

const getInitialViewMode = (): TasksViewMode => {
  const stored = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
  return isTasksViewMode(stored) ? stored : "board";
};

function getTaskColumn(task: WorkspaceTask, columns: TaskColumnModel[]) {
  return columns.find((column) => column.id === task.columnId) ?? null;
}

function useHorizontalScrollRef<T extends HTMLElement>(isDraggingRef: React.RefObject<boolean>) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (isDraggingRef.current) return;
      if (e.deltaY === 0) return;
      const canScrollLeft = el.scrollLeft > 0;
      const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && canScrollLeft) || (e.deltaY > 0 && canScrollRight)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isDraggingRef]);
  return ref;
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      <span className="inline-flex flex-col items-center justify-center">
        <ArrowUpIcon
          size={10}
          className={cn(
            "-mb-0.5 transition-colors",
            active && direction === "asc" ? "text-foreground" : "text-muted-foreground/40",
          )}
        />
        <ArrowDownIcon
          size={10}
          className={cn(
            "-mt-0.5 transition-colors",
            active && direction === "desc" ? "text-foreground" : "text-muted-foreground/40",
          )}
        />
      </span>
    </button>
  );
}

const TableRow = memo(function TableRow({
  task,
  column,
  allColumns,
  index,
  onUpdateTask,
  onMoveTask,
}: {
  task: WorkspaceTask;
  column: TaskColumnModel | null;
  allColumns: TaskColumnModel[];
  index: number;
  onUpdateTask: (
    taskId: string,
    value: { title: string; labels: string[]; dueDate: string | null },
  ) => void;
  onMoveTask: (taskId: string, columnId: string, index: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftLabels, setDraftLabels] = useState(task.labels.join(", "));
  const [draftDate, setDraftDate] = useState(task.dueDate ?? "");

  const commitEdit = useCallback(() => {
    const normalizedDate = draftDate.trim();
    if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return;
    }
    const labels = draftLabels
      .split(/[,\s]+/)
      .map((l) => l.trim().replace(/^#/, ""))
      .filter(Boolean);
    onUpdateTask(task.id, {
      title: draftTitle.trim() || task.title,
      labels,
      dueDate: normalizedDate || null,
    });
    setIsEditing(false);
  }, [draftTitle, draftLabels, draftDate, onUpdateTask, task.id, task.title]);

  return (
    <tr
      className={cn(
        "group border-b border-border/40 transition-colors hover:bg-muted/30",
        index % 2 === 0 ? "bg-background" : "bg-muted/15",
      )}
    >
      {/* Task */}
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="h-8"
              placeholder="Task title"
            />
            <div className="flex gap-2">
              <Input
                value={draftLabels}
                onChange={(e) => setDraftLabels(e.target.value)}
                className="h-7 text-xs"
                placeholder="Tags (comma separated)"
              />
              <Input
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="h-7 w-32 text-xs"
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftTitle(task.title);
              setDraftLabels(task.labels.join(", "));
              setDraftDate(task.dueDate ?? "");
              setIsEditing(true);
            }}
            className="block w-full text-left"
          >
            <span className="block text-sm font-medium text-foreground">{task.title}</span>
            {task.labels.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    #{label}
                  </span>
                ))}
              </span>
            )}
          </button>
        )}
      </td>

      {/* List */}
      <td className="px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                  column ? LIST_BG_COLORS[column.color] : "bg-muted",
                  column ? LIST_TEXT_COLORS[column.color] : "text-muted-foreground",
                  "hover:opacity-80",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full border-2 bg-background",
                    column ? COLOR_DOTS[column.color] : "border-muted-foreground",
                  )}
                />
                {column?.title ?? "—"}
              </button>
            }
          />
          <DropdownMenuContent
            align="start"
            className="w-48 text-popover-foreground shadow-lg ring-1 ring-border"
          >
            {allColumns.map((col) => (
              <DropdownMenuItem
                key={col.id}
                onClick={() => onMoveTask(task.id, col.id, Number.MAX_SAFE_INTEGER)}
                className={cn("flex items-center gap-2", col.id === task.columnId && "bg-muted/50")}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full border-2 bg-background",
                    COLOR_DOTS[col.color],
                  )}
                />
                <span className={cn("text-sm", LIST_TEXT_COLORS[col.color])}>{col.title}</span>
                {col.id === task.columnId && (
                  <TickIcon size={14} className="ml-auto text-foreground" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>

      {/* Date */}
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              {task.dueDate}
            </span>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </span>
      </td>
    </tr>
  );
});

export function TasksView({ glyph, onOpenMarkdown }: TasksViewProps) {
  const columns = useTasksStore((state) => state.columns);
  const tasks = useTasksStore((state) => state.tasks);
  const tagSuggestions = useTasksStore((state) => state.tagSuggestions);
  const isLoading = useTasksStore((state) => state.isLoading);
  const error = useTasksStore((state) => state.error);
  const setSnapshot = useTasksStore((state) => state.setSnapshot);
  const setLoading = useTasksStore((state) => state.setLoading);
  const setError = useTasksStore((state) => state.setError);
  const [creatingColumnId, setCreatingColumnId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnColor, setNewColumnColor] = useState<TaskColumnColor>("blue");
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [viewMode, setViewMode] = useState<TasksViewMode>(getInitialViewMode);
  const [sortColumn, setSortColumn] = useState<SortColumn>("task");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const isDraggingRef = useRef(false);
  const boardScrollRef = useHorizontalScrollRef<HTMLDivElement>(isDraggingRef);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    isDraggingRef.current = Boolean(activeDragId);
  }, [activeDragId]);

  useEffect(() => {
    const handleAddColumn = () => setIsAddingColumn(true);
    const handleViewChanged = () => {
      const stored = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
      if (isTasksViewMode(stored)) {
        setViewMode(stored);
      }
    };
    window.addEventListener("glyph:tasks-add-column", handleAddColumn);
    window.addEventListener("glyph:tasks-view-changed", handleViewChanged);
    return () => {
      window.removeEventListener("glyph:tasks-add-column", handleAddColumn);
      window.removeEventListener("glyph:tasks-view-changed", handleViewChanged);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    void glyph
      .listTasks()
      .then(setSnapshot)
      .catch((taskError) => setError(getErrorMessage(taskError)));

    return glyph.onTasksChanged(setSnapshot);
  }, [glyph, setError, setLoading, setSnapshot]);

  const groupedTasks = useMemo(() => groupTasksByColumn(columns, tasks), [columns, tasks]);
  const filteredTasks = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) {
      return tasks;
    }
    return tasks.filter((task) =>
      [task.title, task.dueDate ?? "", ...task.labels].join(" ").toLowerCase().includes(query),
    );
  }, [deferredSearchQuery, tasks]);
  const filteredTaskIds = useMemo(
    () => new Set(filteredTasks.map((task) => task.id)),
    [filteredTasks],
  );
  const visibleGroupedTasks = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.id,
          (groupedTasks[column.id] ?? []).filter((task) => filteredTaskIds.has(task.id)),
        ]),
      ),
    [columns, filteredTaskIds, groupedTasks],
  );
  const activeDragTask = useMemo(
    () => tasks.find((task) => task.id === activeDragId) ?? null,
    [activeDragId, tasks],
  );

  const handleChangeViewMode = useCallback((nextMode: TasksViewMode) => {
    setViewMode(nextMode);
    window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, nextMode);
  }, []);

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn],
  );

  const sortedFilteredTasks = useMemo(() => {
    const list = [...filteredTasks];
    list.sort((a, b) => {
      const colA = getTaskColumn(a, columns);
      const colB = getTaskColumn(b, columns);
      let cmp = 0;
      if (sortColumn === "task") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortColumn === "list") {
        cmp = (colA?.title ?? "").localeCompare(colB?.title ?? "");
      } else if (sortColumn === "date") {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        cmp = dateA - dateB;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filteredTasks, columns, sortColumn, sortDirection]);

  const runMutation = useCallback(
    async (mutation: Promise<Awaited<ReturnType<typeof glyph.createTask>>>) => {
      const result = await applyTaskMutation(mutation, setSnapshot);
      if (!result.ok) {
        setError(result.message);
      }
      return result;
    },
    [setError, setSnapshot],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      if (window.confirm("Delete this list and all tasks inside it?")) {
        void runMutation(glyph.deleteTaskColumn({ id: columnId }));
      }
    },
    [glyph, runMutation],
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      void runMutation(glyph.deleteTask({ id: taskId }));
    },
    [glyph, runMutation],
  );

  const handleMoveTask = useCallback(
    (taskId: string, columnId: string, index: number) => {
      void runMutation(glyph.moveTask({ id: taskId, columnId, index }));
    },
    [glyph, runMutation],
  );

  const handleUpdateColumn = useCallback(
    (columnId: string, patch: { title?: string; color?: TaskColumnColor; collapsed?: boolean }) => {
      void runMutation(glyph.updateTaskColumn({ id: columnId, ...patch }));
    },
    [glyph, runMutation],
  );

  const handleUpdateTask = useCallback(
    (taskId: string, value: { title: string; labels: string[]; dueDate: string | null }) => {
      void runMutation(glyph.updateTask({ id: taskId, ...value }));
    },
    [glyph, runMutation],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      const activeType = event.active.data.current?.type;
      const overType = event.over?.data.current?.type;
      setActiveDragId(null);
      if (!overId || activeId === overId) {
        return;
      }

      if (activeType === "column") {
        const targetIndex = columns.findIndex((column) => column.id === overId);
        if (targetIndex >= 0) {
          void runMutation(glyph.moveTaskColumn({ id: activeId, index: targetIndex }));
        }
        return;
      }

      if (activeType === "task") {
        const targetColumnId =
          overType === "task"
            ? tasks.find((task) => task.id === overId)?.columnId
            : columns.find((column) => column.id === overId)?.id;
        if (!targetColumnId) {
          return;
        }
        const targetTasks = groupedTasks[targetColumnId] ?? [];
        const overTaskIndex = targetTasks.findIndex((task) => task.id === overId);
        const index = overType === "task" ? Math.max(0, overTaskIndex) : targetTasks.length;
        void runMutation(glyph.moveTask({ id: activeId, columnId: targetColumnId, index }));
      }
    },
    [columns, glyph, groupedTasks, runMutation, tasks],
  );

  const collisionDetection = useCallback((args: Parameters<typeof closestCorners>[0]) => {
    if (args.active.data.current?.type === "column") {
      return closestCorners(args);
    }
    return pointerWithin(args);
  }, []);

  const handleCreateTask = useCallback(
    async (title: string, columnId: string, labels: string[], dueDate: string | null) => {
      const result = await runMutation(glyph.createTask({ title, columnId, labels, dueDate }));
      if (result.ok) {
        setCreatingColumnId(null);
      }
    },
    [glyph, runMutation],
  );

  const handleCreateColumn = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const title = newColumnTitle.trim();
      if (!title) {
        return;
      }
      const result = await runMutation(
        glyph.createTaskColumn({ title, color: newColumnColor, index: columns.length }),
      );
      if (result.ok) {
        setIsAddingColumn(false);
        setNewColumnTitle("");
        setNewColumnColor("blue");
      }
    },
    [columns.length, glyph, newColumnColor, newColumnTitle, runMutation],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {error ? (
        <div className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-hidden">
        {isLoading && tasks.length === 0 && columns.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading tasks...
          </div>
        ) : (
          <div className="relative h-full min-h-0">
            <div className="absolute top-3 right-5 z-30 flex items-center gap-1.5">
              {isSearching ? (
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsSearching(false);
                      setSearchQuery("");
                    }
                  }}
                  placeholder="Search tasks"
                  className="h-8 w-52 bg-background"
                />
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenMarkdown}
                    className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-foreground"
                    aria-label="Open as Markdown"
                  >
                    <FileIcon size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open as Markdown</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsAddingColumn(true)}
                    className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-foreground"
                    aria-label="Add a list"
                  >
                    <PlusIcon size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Add a list</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      setIsSearching((value) => {
                        const next = !value;
                        if (!next) {
                          setSearchQuery("");
                        }
                        return next;
                      })
                    }
                    className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-foreground"
                    aria-label="Search tasks"
                  >
                    <SearchIcon size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Search tasks</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-foreground"
                          aria-label="Change tasks view"
                        />
                      }
                    >
                      <OutlineIcon size={16} />
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">View options</TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="end"
                  className="w-44 bg-popover text-popover-foreground"
                >
                  {(["board", "table"] as TasksViewMode[]).map((mode) => (
                    <DropdownMenuItem key={mode} onClick={() => handleChangeViewMode(mode)}>
                      <span className="mr-2 grid h-4 w-4 place-items-center">
                        {viewMode === mode ? <TickIcon size={14} /> : null}
                      </span>
                      View as {mode[0].toUpperCase()}
                      {mode.slice(1)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {viewMode === "board" ? (
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetection}
                onDragStart={handleDragStart}
                onDragCancel={() => setActiveDragId(null)}
                onDragEnd={handleDragEnd}
              >
                <div
                  ref={boardScrollRef}
                  className="scrollbar-hide flex h-full items-start gap-5 overflow-x-auto bg-background px-5 pt-16 pb-5"
                >
                  <SortableContext
                    items={columns.map((column) => column.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {columns.map((column) => (
                      <TaskColumn
                        key={column.id}
                        column={column}
                        columns={columns}
                        tasks={visibleGroupedTasks[column.id] ?? []}
                        isCreating={creatingColumnId === column.id}
                        tagSuggestions={tagSuggestions}
                        onCreate={setCreatingColumnId}
                        onCreateTask={handleCreateTask}
                        onCancelCreate={() => setCreatingColumnId(null)}
                        onDeleteColumn={handleDeleteColumn}
                        onDeleteTask={handleDeleteTask}
                        onMoveTask={handleMoveTask}
                        onUpdateColumn={handleUpdateColumn}
                        onUpdateTask={handleUpdateTask}
                      />
                    ))}
                  </SortableContext>
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeDragTask ? (
                    <div className="w-[306px]">
                      <TaskCardSurface task={activeDragTask} isDragging />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div className="h-full overflow-auto px-5 pt-16 pb-5">
                <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                  <table className="w-full text-left">
                    <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">
                          <SortHeader
                            label="Tasks"
                            active={sortColumn === "task"}
                            direction={sortDirection}
                            onClick={() => handleSort("task")}
                          />
                        </th>
                        <th className="px-4 py-3">
                          <SortHeader
                            label="List"
                            active={sortColumn === "list"}
                            direction={sortDirection}
                            onClick={() => handleSort("list")}
                          />
                        </th>
                        <th className="px-4 py-3">
                          <SortHeader
                            label="Date"
                            active={sortColumn === "date"}
                            direction={sortDirection}
                            onClick={() => handleSort("date")}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredTasks.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-12 text-center text-sm text-muted-foreground"
                          >
                            No tasks match current filters.
                          </td>
                        </tr>
                      ) : (
                        sortedFilteredTasks.map((task, index) => (
                          <TableRow
                            key={task.id}
                            task={task}
                            column={getTaskColumn(task, columns)}
                            allColumns={columns}
                            index={index}
                            onUpdateTask={handleUpdateTask}
                            onMoveTask={handleMoveTask}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {isAddingColumn ? (
              <form
                onSubmit={handleCreateColumn}
                className="absolute top-14 right-5 z-40 w-[280px] rounded-lg border border-border bg-popover p-3 shadow-xl"
              >
                <Input
                  autoFocus
                  value={newColumnTitle}
                  onChange={(event) => setNewColumnTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsAddingColumn(false);
                    }
                  }}
                  placeholder="List name"
                  className="h-9"
                />
                <div className="mt-3 grid grid-cols-7 gap-2">
                  {TASK_COLUMN_COLORS_PICKER.map((color) => (
                    <Tooltip key={color}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setNewColumnColor(color)}
                          className={cn(
                            "h-7 w-7 rounded-full border-2 bg-background transition-transform hover:scale-110",
                            COLOR_DOTS[color],
                            newColumnColor === color ? "ring-2 ring-ring/40" : "",
                          )}
                          aria-label={`Use ${color}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {color[0].toUpperCase() + color.slice(1)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAddingColumn(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!newColumnTitle.trim()}>
                    Add
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
