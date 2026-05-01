import type { WorkspaceTask } from "@/core/tasks";

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load tasks.";
}

export function matchesTaskQuery(task: WorkspaceTask, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return [task.title, task.dueDate ?? "", ...task.labels]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}
