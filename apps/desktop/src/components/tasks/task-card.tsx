import { CSS } from "@dnd-kit/utilities";
import { memo, useCallback, useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";

import { DotsHorizontalIcon } from "@/components/icons";
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
import type { TaskColumn, WorkspaceTask } from "@/core/tasks";
import { cn } from "@/core/utils";

import { TaskInlineEditor } from "./task-inline-editor";

type TaskCardProps = {
  columns: TaskColumn[];
  task: WorkspaceTask;
  tagSuggestions: string[];
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, columnId: string, index: number) => void;
  onUpdate: (
    taskId: string,
    value: { title: string; labels: string[]; dueDate: string | null },
  ) => void;
};

const cardColorClass: Record<TaskColumn["color"], string> = {
  amber: "border-chart-2/35",
  blue: "border-primary/35",
  cyan: "border-chart-3/35",
  emerald: "border-chart-5/35",
  lime: "border-chart-5/35",
  orange: "border-chart-2/35",
  pink: "border-chart-4/35",
  rose: "border-destructive/35",
  slate: "border-muted-foreground/25",
  violet: "border-chart-4/35",
};

export function TaskCardSurface({
  task,
  color = "slate",
  isDragging = false,
}: {
  task: WorkspaceTask;
  color?: TaskColumn["color"];
  isDragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/task relative w-full rounded-md border bg-card px-3.5 py-3 text-left shadow-xs transition-[border-color,box-shadow] duration-100 ease-out hover:shadow-sm",
        cardColorClass[color],
        isDragging ? "opacity-60 shadow-md" : "",
      )}
    >
      <p className="line-clamp-4 min-w-0 pr-6 text-[15px] font-medium leading-5.5 text-card-foreground">
        {task.title}
      </p>
      {task.labels.length > 0 || task.dueDate ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary"
            >
              #{label}
            </span>
          ))}
          {task.dueDate ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-sm font-medium text-foreground">
              {task.dueDate}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const TaskCard = memo(function TaskCard({
  columns,
  task,
  tagSuggestions,
  onDelete,
  onMove,
  onUpdate,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const column = columns.find((entry) => entry.id === task.columnId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { columnId: task.columnId, taskId: task.id, type: "task" },
  });

  const initialValue = `${task.title}${task.labels.map((label) => ` #${label}`).join("")}${
    task.dueDate ? ` ${task.dueDate}` : ""
  }`;

  const handleUpdate = useCallback(
    (value: { title: string; labels: string[]; dueDate: string | null }) => {
      onUpdate(task.id, value);
      setIsEditing(false);
    },
    [onUpdate, task.id],
  );

  const sortableStyle = useMemo(
    () => ({ transform: CSS.Transform.toString(transform), transition }),
    [transform, transition],
  );

  if (isEditing) {
    return (
      <div ref={setNodeRef}>
        <TaskInlineEditor
          autoFocus
          color={column?.color}
          initialValue={initialValue}
          submitLabel="Save"
          tagSuggestions={tagSuggestions}
          onCancel={() => setIsEditing(false)}
          onSubmit={handleUpdate}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={sortableStyle}
      className={cn(
        "group/card relative w-full rounded-md outline-none",
        isDragging ? "z-20 opacity-50" : "",
      )}
    >
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="w-full cursor-grab rounded-md text-left outline-none active:cursor-grabbing focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <TaskCardSurface task={task} color={column?.color} isDragging={isDragging} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="absolute top-2.5 right-2 grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground"
              aria-label={`${task.title} options`}
            />
          }
        >
          <DotsHorizontalIcon size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-popover text-popover-foreground">
          <DropdownMenuItem onClick={() => setIsEditing(true)}>Edit card</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onMove(task.id, task.columnId, 0)}>
            Move to top
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMove(task.id, task.columnId, Number.MAX_SAFE_INTEGER)}>
            Move to bottom
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(task.id)}>
            Delete card
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to list</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {columns.map((targetColumn) => (
                <DropdownMenuItem
                  key={targetColumn.id}
                  onClick={() => onMove(task.id, targetColumn.id, Number.MAX_SAFE_INTEGER)}
                >
                  {targetColumn.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
