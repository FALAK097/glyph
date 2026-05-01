import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useState } from "react";

import { OutlineIcon, PlusIcon, SearchIcon, TickIcon } from "@/components/icons";
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
import { TASK_COLUMN_COLORS } from "@/core/tasks";
import { cn } from "@/core/utils";
import { applyTaskMutation, groupTasksByColumn, useTasksStore } from "@/store/tasks";

import { TaskCardSurface } from "./task-card";
import { TaskColumn } from "./task-column";
import { getErrorMessage } from "./task-view-model";

type TasksViewProps = {
  glyph: NonNullable<Window["glyph"]>;
  onOpenTaskSource: (task: WorkspaceTask) => void;
};

type TasksViewMode = "board" | "list" | "table";

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

const isTasksViewMode = (value: string | null): value is TasksViewMode =>
  value === "board" || value === "list" || value === "table";

const getInitialViewMode = (): TasksViewMode => {
  const stored = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
  return isTasksViewMode(stored) ? stored : "board";
};

function getTaskColumn(task: WorkspaceTask, columns: TaskColumnModel[]) {
  return columns.find((column) => column.id === task.columnId) ?? null;
}

export function TasksView({ glyph }: TasksViewProps) {
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
  const [viewMode, setViewMode] = useState<TasksViewMode>(getInitialViewMode);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

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
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return tasks;
    }
    return tasks.filter((task) =>
      [task.title, task.dueDate ?? "", ...task.labels].join(" ").toLowerCase().includes(query),
    );
  }, [searchQuery, tasks]);
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
        const index = overType === "task" ? overTaskIndex : targetTasks.length;
        void runMutation(glyph.moveTask({ id: activeId, columnId: targetColumnId, index }));
      }
    },
    [columns, glyph, groupedTasks, runMutation, tasks],
  );

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
                    onClick={() => setIsSearching((value) => !value)}
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
                  {(["board", "list", "table"] as TasksViewMode[]).map((mode) => (
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
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragCancel={() => setActiveDragId(null)}
                onDragEnd={handleDragEnd}
              >
                <div className="scrollbar-hide flex h-full items-start gap-5 overflow-x-auto bg-background px-5 pt-16 pb-5">
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
                        onDeleteColumn={(columnId) => {
                          if (window.confirm("Delete this list and all tasks inside it?")) {
                            void runMutation(glyph.deleteTaskColumn({ id: columnId }));
                          }
                        }}
                        onDeleteTask={(taskId) =>
                          void runMutation(glyph.deleteTask({ id: taskId }))
                        }
                        onMoveTask={(taskId, columnId, index) =>
                          void runMutation(glyph.moveTask({ id: taskId, columnId, index }))
                        }
                        onUpdateColumn={(columnId, patch) =>
                          void runMutation(glyph.updateTaskColumn({ id: columnId, ...patch }))
                        }
                        onUpdateTask={(taskId, value) =>
                          void runMutation(glyph.updateTask({ id: taskId, ...value }))
                        }
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
                {viewMode === "list" ? (
                  <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-border bg-card">
                    {filteredTasks.map((task) => {
                      const column = getTaskColumn(task, columns);
                      return (
                        <div
                          key={task.id}
                          className="flex min-h-12 items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b-0"
                        >
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full border-2 bg-background",
                              column ? COLOR_DOTS[column.color] : "border-muted-foreground",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                          <span className="text-xs text-muted-foreground">{column?.title}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-border bg-card">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/35 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Task</th>
                          <th className="px-3 py-2 font-medium">List</th>
                          <th className="px-3 py-2 font-medium">Tags</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map((task) => (
                          <tr key={task.id} className="border-b border-border/60 last:border-b-0">
                            <td className="px-3 py-2 font-medium">{task.title}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {getTaskColumn(task, columns)?.title}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {task.labels.map((label) => `#${label}`).join(" ")}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{task.dueDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                <div className="mt-3 grid grid-cols-10 gap-1">
                  {TASK_COLUMN_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColumnColor(color)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 bg-background",
                        COLOR_DOTS[color],
                        newColumnColor === color ? "ring-2 ring-ring/35" : "",
                      )}
                      aria-label={`Use ${color}`}
                    />
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
