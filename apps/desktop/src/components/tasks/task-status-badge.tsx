import { memo } from "react";

export const TaskStatusBadge = memo(function TaskStatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-border bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
});
