import { useCallback, useDeferredValue, useMemo } from "react";

import {
  ArchiveIcon,
  DiscountTagIcon,
  FileIcon,
  OutlineIcon,
  PlusIcon,
  SearchIcon,
  TickIcon,
} from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/core/utils";
import { applyTaskMutation, useTasksStore } from "@/store/tasks";
import { useTasksUIStore, type TasksViewMode } from "@/store/tasks-ui";

type TasksHeaderActionsProps = {
  glyph: NonNullable<Window["glyph"]>;
  onOpenMarkdown: () => void;
};

export function TasksHeaderActions({ glyph, onOpenMarkdown }: TasksHeaderActionsProps) {
  const columns = useTasksStore((s) => s.columns);
  const tasks = useTasksStore((s) => s.tasks);
  const setSnapshot = useTasksStore((s) => s.setSnapshot);
  const setError = useTasksStore((s) => s.setError);

  const isSearching = useTasksUIStore((s) => s.isSearching);
  const searchQuery = useTasksUIStore((s) => s.searchQuery);
  const selectedTag = useTasksUIStore((s) => s.selectedTag);
  const viewMode = useTasksUIStore((s) => s.viewMode);
  const setIsSearching = useTasksUIStore((s) => s.setIsSearching);
  const setSearchQuery = useTasksUIStore((s) => s.setSearchQuery);
  const setSelectedTag = useTasksUIStore((s) => s.setSelectedTag);
  const setViewMode = useTasksUIStore((s) => s.setViewMode);
  const setIsAddingColumn = useTasksUIStore((s) => s.setIsAddingColumn);

  const _deferredQuery = useDeferredValue(searchQuery);

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    tasks.forEach((task) => {
      task.labels.forEach((label) => tagsSet.add(label));
    });
    return Array.from(tagsSet).sort();
  }, [tasks]);

  const handleArchiveCompleted = useCallback(async () => {
    const doneColumns = columns.filter((c) => c.isDone);
    const doneTaskCount = tasks.filter((t) => doneColumns.some((c) => c.id === t.columnId)).length;
    if (doneTaskCount === 0) {
      return;
    }
    if (
      !window.confirm(
        `Archive ${doneTaskCount} task${doneTaskCount === 1 ? "" : "s"} from done list${doneColumns.length === 1 ? "" : "s"}? They will be stored in the Tasks.md archive section.`,
      )
    ) {
      return;
    }
    const result = await applyTaskMutation(glyph.archiveCompletedTasks(), setSnapshot);
    if (!result.ok) {
      setError(result.message);
    }
  }, [columns, glyph, setError, setSnapshot, tasks]);

  const handleToggleSearch = useCallback(() => {
    setIsSearching(!isSearching);
    if (isSearching) {
      setSearchQuery("");
    }
  }, [isSearching, setIsSearching, setSearchQuery]);

  const handleChangeViewMode = useCallback(
    (nextMode: TasksViewMode) => {
      setViewMode(nextMode);
    },
    [setViewMode],
  );

  return (
    <div className="flex items-center gap-1">
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
          className="h-7 w-44 bg-background text-sm"
        />
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsAddingColumn(true)}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Add a list"
          >
            <PlusIcon size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Add a list</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleToggleSearch}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Search tasks"
          >
            <SearchIcon size={15} />
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
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded transition-colors hover:bg-muted",
                    selectedTag
                      ? "text-primary hover:text-primary/80"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label="Filter by tag"
                />
              }
            >
              <DiscountTagIcon size={15} />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {selectedTag ? `Filtered by #${selectedTag}` : "Filter by tag"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          className="w-48 bg-popover text-popover-foreground max-h-60 overflow-y-auto"
        >
          <DropdownMenuItem onClick={() => setSelectedTag(null)}>
            <span className="mr-2 grid h-4 w-4 place-items-center">
              {selectedTag === null ? <TickIcon size={14} /> : null}
            </span>
            All Tags
          </DropdownMenuItem>
          {allTags.length > 0 && <div className="h-px bg-border my-1" />}
          {allTags.map((tag) => (
            <DropdownMenuItem key={tag} onClick={() => setSelectedTag(tag)}>
              <span className="mr-2 grid h-4 w-4 place-items-center">
                {selectedTag === tag ? <TickIcon size={14} /> : null}
              </span>
              #{tag}
            </DropdownMenuItem>
          ))}
          {allTags.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              No tags found in tasks
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Change tasks view"
                />
              }
            >
              <OutlineIcon size={15} />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">View options</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44 bg-popover text-popover-foreground">
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
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void handleArchiveCompleted()}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Archive done tasks"
          >
            <ArchiveIcon size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Archive done tasks</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpenMarkdown}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Open as Markdown"
          >
            <FileIcon size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open as Markdown</TooltipContent>
      </Tooltip>
    </div>
  );
}
