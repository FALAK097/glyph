import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { ArrowDownIcon, DotsHorizontalIcon, PlusIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TaskColumn as TaskColumnModel, TaskColumnColor, WorkspaceTask } from "@/core/tasks";
import { TASK_COLUMN_COLORS_PICKER } from "@/core/tasks";
import { cn } from "@/core/utils";

import { TaskCard } from "./task-card";
import { TaskInlineEditor } from "./task-inline-editor";

function DragGripIcon() {
  return (
    <span className="grid grid-cols-2 gap-0.5" aria-hidden="true">
      {["tl", "tr", "ml", "mr", "bl", "br"].map((dot) => (
        <span key={dot} className="h-1 w-1 rounded-full bg-current" />
      ))}
    </span>
  );
}

const COLOR_STYLES: Record<
  TaskColumnColor,
  { add: string; dot: string; count: string; header: string; resize: string }
> = {
  amber: {
    add: "hover:border-chart-2/35 hover:text-chart-2",
    count: "bg-chart-2/15 text-chart-2",
    dot: "border-chart-2",
    header: "bg-chart-2/8",
    resize: "bg-chart-2/45",
  },
  blue: {
    add: "hover:border-primary/35 hover:text-primary",
    count: "bg-primary/10 text-primary",
    dot: "border-primary",
    header: "bg-primary/5",
    resize: "bg-primary/45",
  },
  cyan: {
    add: "hover:border-chart-3/35 hover:text-chart-3",
    count: "bg-chart-3/15 text-chart-3",
    dot: "border-chart-3",
    header: "bg-chart-3/8",
    resize: "bg-chart-3/45",
  },
  emerald: {
    add: "hover:border-chart-5/35 hover:text-chart-5",
    count: "bg-chart-5/15 text-chart-5",
    dot: "border-chart-5",
    header: "bg-chart-5/8",
    resize: "bg-chart-5/45",
  },
  lime: {
    add: "hover:border-chart-5/35 hover:text-chart-5",
    count: "bg-chart-5/15 text-chart-5",
    dot: "border-chart-5",
    header: "bg-chart-5/8",
    resize: "bg-chart-5/45",
  },
  orange: {
    add: "hover:border-chart-2/35 hover:text-chart-2",
    count: "bg-chart-2/15 text-chart-2",
    dot: "border-chart-2",
    header: "bg-chart-2/8",
    resize: "bg-chart-2/45",
  },
  pink: {
    add: "hover:border-chart-4/35 hover:text-chart-4",
    count: "bg-chart-4/15 text-chart-4",
    dot: "border-chart-4",
    header: "bg-chart-4/8",
    resize: "bg-chart-4/45",
  },
  rose: {
    add: "hover:border-destructive/35 hover:text-destructive",
    count: "bg-destructive/12 text-destructive",
    dot: "border-destructive",
    header: "bg-destructive/8",
    resize: "bg-destructive/45",
  },
  slate: {
    add: "hover:border-muted-foreground/35 hover:text-foreground",
    count: "bg-muted text-muted-foreground",
    dot: "border-muted-foreground",
    header: "bg-muted/40",
    resize: "bg-muted-foreground/35",
  },
  violet: {
    add: "hover:border-chart-4/35 hover:text-chart-4",
    count: "bg-chart-4/15 text-chart-4",
    dot: "border-chart-4",
    header: "bg-chart-4/8",
    resize: "bg-chart-4/45",
  },
};

type TaskColumnProps = {
  column: TaskColumnModel;
  columns: TaskColumnModel[];
  tasks: WorkspaceTask[];
  isCreating: boolean;
  tagSuggestions: string[];
  onCreate: (columnId: string) => void;
  onCreateTask: (title: string, columnId: string, labels: string[], dueDate: string | null) => void;
  onCancelCreate: () => void;
  onDeleteColumn: (columnId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onMoveTask: (taskId: string, columnId: string, index: number) => void;
  onUpdateColumn: (
    columnId: string,
    patch: {
      title?: string;
      color?: TaskColumnColor;
      collapsed?: boolean;
      width?: number | null;
      isDone?: boolean;
    },
  ) => void;
  onUpdateTask: (
    taskId: string,
    value: { title: string; labels: string[]; dueDate: string | null },
  ) => void;
};

export const TaskColumn = memo(function TaskColumn({
  column,
  columns,
  tasks,
  isCreating,
  tagSuggestions,
  onCreate,
  onCreateTask,
  onCancelCreate,
  onDeleteColumn,
  onDeleteTask,
  onMoveTask,
  onUpdateColumn,
  onUpdateTask,
}: TaskColumnProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(column.title);
  const resizeStateRef = useRef<{ startX: number; startWidth: number; width: number } | null>(null);
  const [liveWidth, setLiveWidth] = useState(column.width ?? 340);

  useEffect(() => {
    if (!isRenaming) {
      setDraftTitle(column.title);
    }
  }, [column.title, isRenaming]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { columnId: column.id, type: "column" },
  });
  const color = COLOR_STYLES[column.color];
  const columnWidth = liveWidth;

  useEffect(() => {
    setLiveWidth(column.width ?? 340);
  }, [column.width]);

  useEffect(() => {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    return () => {
      if (resizeStateRef.current) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    onUpdateColumn(column.id, { collapsed: !column.collapsed });
  }, [column.collapsed, column.id, onUpdateColumn]);

  const handleCreateTask = useCallback(
    (value: { title: string; labels: string[]; dueDate: string | null }) => {
      onCreateTask(value.title, column.id, value.labels, value.dueDate);
    },
    [column.id, onCreateTask],
  );

  const commitRename = useCallback(() => {
    if (draftTitle.trim() && draftTitle.trim() !== column.title) {
      onUpdateColumn(column.id, { title: draftTitle.trim() });
    }
    setIsRenaming(false);
  }, [column.id, column.title, draftTitle, onUpdateColumn]);

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startWidth = liveWidth;
      resizeStateRef.current = { startX: event.clientX, startWidth, width: startWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
    },
    [liveWidth],
  );

  const handleResizePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = resizeStateRef.current;
    if (!state) {
      return;
    }

    const nextWidth = Math.max(260, Math.min(560, state.startWidth + event.clientX - state.startX));
    state.width = nextWidth;
    setLiveWidth(nextWidth);
  }, []);

  const handleResizePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }

      resizeStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      document.body.style.userSelect = "";
      onUpdateColumn(column.id, { width: Math.round(state.width) });
    },
    [column.id, onUpdateColumn],
  );

  const handleResizePointerCancel = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = resizeStateRef.current;
    if (!state) {
      return;
    }

    resizeStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.userSelect = "";
    setLiveWidth(state.startWidth);
  }, []);

  if (column.collapsed) {
    return (
      <section
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn(
          "flex h-[calc(100vh-132px)] min-h-[520px] w-20 shrink-0 flex-col items-center gap-3 rounded-lg border border-border bg-muted/25 py-3 shadow-xs",
          isDragging ? "opacity-55 shadow-md" : "",
        )}
        aria-label={`${column.title} tasks`}
      >
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="cursor-grab rounded p-1.5 text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${column.title} list`}
        >
          <DragGripIcon />
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded p-1.5 text-muted-foreground/70 hover:text-foreground"
          aria-label={`Expand ${column.title}`}
        >
          <ArrowDownIcon size={15} className="-rotate-90" />
        </button>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <span className="rotate-180 text-base font-semibold tracking-wide text-foreground [writing-mode:vertical-rl]">
            {column.title}
          </span>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-sm font-semibold", color.count)}>
          {tasks.length}
        </span>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, width: columnWidth }}
      className={cn(
        "relative flex h-[calc(100vh-132px)] min-h-[520px] shrink-0 flex-col rounded-lg border border-border bg-muted/25 shadow-xs",
        isDragging ? "opacity-55 shadow-md" : "",
      )}
      aria-label={`${column.title} tasks`}
    >
      <div className={cn("flex h-14 items-center border-b border-border px-3", color.header)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="cursor-grab rounded p-1 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            aria-label={`Reorder ${column.title} list`}
          >
            <DragGripIcon />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rounded p-1 text-muted-foreground/70 hover:text-foreground"
            aria-label={`Collapse ${column.title}`}
          >
            <ArrowDownIcon size={15} />
          </button>
          <span className={cn("h-3.5 w-3.5 rounded-full border-2 bg-background", color.dot)} />
          {isRenaming ? (
            <Input
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitRename();
                }
                if (event.key === "Escape") {
                  setDraftTitle(column.title);
                  setIsRenaming(false);
                }
              }}
              className="h-8"
            />
          ) : (
            <h2 className="truncate text-base font-semibold text-foreground">{column.title}</h2>
          )}
        </div>
        <span className={cn("mr-2 rounded-full px-2 py-0.5 text-sm font-semibold", color.count)}>
          {tasks.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground"
                aria-label={`${column.title} options`}
              />
            }
          >
            <DotsHorizontalIcon size={15} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover text-popover-foreground">
            <DropdownMenuItem onClick={() => onCreate(column.id)}>Add task</DropdownMenuItem>
            <DropdownMenuItem onClick={toggleCollapsed}>Collapse list</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>Edit list</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span
                  className={cn("mr-2 h-3 w-3 rounded-full border-2 bg-background", color.dot)}
                />
                Color
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="grid w-auto grid-cols-7 gap-2 p-2">
                {TASK_COLUMN_COLORS_PICKER.map((nextColor) => (
                  <Tooltip key={nextColor}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onUpdateColumn(column.id, { color: nextColor })}
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-md border border-transparent transition-transform hover:border-border hover:scale-110",
                          column.color === nextColor ? "bg-muted" : "",
                        )}
                        aria-label={`Use ${nextColor}`}
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded-full border-2 bg-background",
                            COLOR_STYLES[nextColor].dot,
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {nextColor[0].toUpperCase() + nextColor.slice(1)}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onUpdateColumn(column.id, { isDone: !column.isDone })}>
              {column.isDone ? "Unmark as done list" : "Mark as done list"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDeleteColumn(column.id)}>
              Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              columns={columns}
              task={task}
              tagSuggestions={tagSuggestions}
              onDelete={onDeleteTask}
              onMove={onMoveTask}
              onUpdate={onUpdateTask}
            />
          ))}
        </SortableContext>
      </div>
      <div className="shrink-0 border-t border-border bg-muted/20 p-3">
        {isCreating ? (
          <div className="mb-2">
            <TaskInlineEditor
              autoFocus
              color={column.color}
              submitLabel="Add"
              tagSuggestions={tagSuggestions}
              onCancel={onCancelCreate}
              onSubmit={handleCreateTask}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onCreate(column.id)}
          className={cn(
            "flex h-10 w-full items-center justify-center gap-1 rounded-md border border-border bg-background text-sm font-medium text-muted-foreground shadow-xs transition-[border-color,color,transform] duration-100 ease-out active:scale-[0.99]",
            color.add,
          )}
        >
          <PlusIcon size={14} />
          Add a Task
        </button>
      </div>
      <button
        type="button"
        aria-label={`Resize ${column.title} list`}
        className="group/resize absolute top-2 right-[-4px] bottom-2 z-10 flex w-2 cursor-col-resize items-center justify-center rounded-full outline-none"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerCancel}
      >
        <span
          className={cn(
            "h-10 w-1 rounded-full opacity-0 transition-opacity duration-100 ease-out group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 group-active/resize:opacity-100",
            color.resize,
          )}
        />
      </button>
    </section>
  );
});
