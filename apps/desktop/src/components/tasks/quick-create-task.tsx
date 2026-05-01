import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuickCreateTaskProps = {
  columnId: string;
  onSubmit: (title: string, columnId: string) => void;
  onCancel: () => void;
};

export function QuickCreateTask({ columnId, onSubmit, onCancel }: QuickCreateTaskProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextTitle = title.trim();
      if (!nextTitle) {
        return;
      }
      onSubmit(nextTitle, columnId);
      setTitle("");
    },
    [columnId, onSubmit, title],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-b border-border bg-card/95 px-4 py-2"
    >
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add task"
        className="h-8 flex-1"
      />
      <Button type="submit" size="sm" disabled={!title.trim()}>
        Add
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
