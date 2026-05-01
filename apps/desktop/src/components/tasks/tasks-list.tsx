import type { WorkspaceTask } from "@/core/tasks";

type TasksListProps = {
  tasks: WorkspaceTask[];
  onOpenTaskSource: (task: WorkspaceTask) => void;
};

export function TasksList({ tasks, onOpenTaskSource }: TasksListProps) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-border bg-card">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTaskSource(task)}
              className="flex h-11 w-full items-center gap-3 border-b border-border/60 px-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/40"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
              <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:block">
                {task.labels.map((label) => `#${label}`).join(" ")}
              </span>
            </button>
          ))
        ) : (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">
            No tasks match current filters.
          </div>
        )}
      </div>
    </div>
  );
}
