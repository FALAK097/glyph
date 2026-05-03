import { memo, useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDisplayFileName, normalizePath } from "@/core/paths";
import { cn } from "@/core/utils";

import type { NoteShortcutItem } from "@/types/navigation";

import { PinIcon } from "@/components/icons";

const normalizePathKey = (path: string) => normalizePath(path).toLowerCase();

type SidebarShortcutRowProps = {
  activePath: string | null;
  item: NoteShortcutItem;
  onOpenFile: (filePath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
};

export const SidebarShortcutRow = memo(function SidebarShortcutRow({
  activePath,
  item,
  onOpenFile,
  onTogglePinnedFile,
}: SidebarShortcutRowProps) {
  const isActive = normalizePathKey(activePath ?? "") === normalizePathKey(item.path);
  const displayFileName = useMemo(() => {
    const segments = item.path.replace(/\\/g, "/").split("/");
    const fileName = segments.pop() ?? item.title;
    return getDisplayFileName(fileName);
  }, [item.path, item.title]);

  const focusEditorSurface = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("[data-glyph-editor='true']")?.focus();
      });
    });
  }, []);

  return (
    <div className="group/shortcut mb-0.5 flex min-w-0 items-center">
      <div
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-center rounded-md border-l-2 px-2 py-1.5 transition-colors duration-100 ease-out",
          isActive
            ? "border-l-slate-500 bg-slate-500/10 text-sidebar-foreground dark:bg-slate-400/15"
            : "border-l-transparent text-sidebar-foreground hover:bg-slate-500/5 dark:hover:bg-slate-400/10",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "mr-2 grid h-5 w-5 shrink-0 place-items-center rounded-sm transition-colors hover:text-foreground",
                isActive ? "text-slate-600 dark:text-slate-300" : "text-muted-foreground",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePinnedFile?.(item.path);
              }}
              aria-label="Unpin note"
            >
              <PinIcon size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Unpin note</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-w-0 flex-1 cursor-pointer justify-start truncate bg-transparent px-0 py-0 text-left text-sm hover:!bg-transparent"
          onClick={() => {
            onOpenFile(item.path);
            focusEditorSurface();
          }}
          type="button"
        >
          {displayFileName}
        </Button>
      </div>
    </div>
  );
});

type SidebarShortcutListProps = {
  activePath: string | null;
  items: NoteShortcutItem[];
  onOpenFile: (filePath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
};

export const SidebarShortcutList = memo(function SidebarShortcutList({
  activePath,
  items,
  onOpenFile,
  onTogglePinnedFile,
}: SidebarShortcutListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <SidebarShortcutRow
          key={item.path}
          activePath={activePath}
          item={item}
          onOpenFile={onOpenFile}
          onTogglePinnedFile={onTogglePinnedFile}
        />
      ))}
    </div>
  );
});
