import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDisplayFileName, normalizePath } from "@/core/paths";

import type { NoteShortcutItem } from "@/types/navigation";
import type { SidebarRemoveTarget } from "@/types/sidebar";

import {
  SidebarActionMenu,
  buildFileMenuItems,
  type SidebarActionMenuCoords,
} from "./sidebar-action-menu";
import { MoreVerticalIcon, PinIcon } from "@/components/icons";

const normalizePathKey = (path: string) => normalizePath(path).toLowerCase();

type SidebarShortcutRowProps = {
  activePath: string | null;
  item: NoteShortcutItem;
  onOpenFile: (filePath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRequestRemoveFile?: (file: SidebarRemoveTarget) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onRevealInFinder?: (filePath: string) => void;
  revealLabel?: string;
};

export const SidebarShortcutRow = memo(function SidebarShortcutRow({
  activePath,
  item,
  onOpenFile,
  onTogglePinnedFile,
  onDeleteFile,
  onRequestRemoveFile,
  onRenameFile,
  onRevealInFinder,
  revealLabel = "Reveal in Finder",
}: SidebarShortcutRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState<SidebarActionMenuCoords | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!isRenaming) {
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setIsRenaming(false);
      return;
    }

    if (trimmed !== displayFileName) {
      onRenameFile(item.path, trimmed);
    }

    setIsRenaming(false);
  };

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuCoords({ top: rect.bottom + 4, left: rect.right + 4 });
    }

    setShowMenu((value) => !value);
  };

  const menuItems = buildFileMenuItems({
    displayFileName,
    onRename: () => {
      setRenameValue(displayFileName);
      setIsRenaming(true);
    },
    onRevealInFinder: () => {
      onRevealInFinder?.(item.path);
    },
    onRemove: () => {
      onRequestRemoveFile?.({ path: item.path, name: item.title });
    },
    onDelete: () => {
      onDeleteFile(item.path);
    },
    revealLabel: revealLabel ?? "Reveal in Finder",
  });

  return (
    <div
      className={`group/shortcut relative mb-0.5 flex min-w-0 items-center overflow-hidden rounded-xl border border-transparent transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98]`}
    >
      <div
        className={`mx-1 flex min-w-0 flex-1 cursor-pointer items-center rounded-md transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-accent/30"
            : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-within:bg-sidebar-accent/70 focus-within:text-sidebar-accent-foreground"
        }`}
        style={{
          paddingLeft: "8px",
          paddingRight: "4px",
          paddingTop: "6px",
          paddingBottom: "6px",
        }}
      >
        <button
          type="button"
          className={`mr-2 shrink-0 cursor-pointer transition-colors hover:text-foreground ${
            isActive ? "text-sidebar-accent-foreground/70" : "text-muted-foreground"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePinnedFile?.(item.path);
          }}
          aria-label="Unpin note"
        >
          <PinIcon size={12} />
        </button>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            className="h-7 min-w-0 flex-1 -ml-1 rounded border-transparent bg-transparent px-1 text-sm shadow-none outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setIsRenaming(false);
              }
            }}
          />
        ) : (
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
            {item.title}
          </Button>
        )}
        {!isRenaming ? (
          <div className="relative ml-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  ref={menuButtonRef}
                  variant="ghost"
                  size="icon-xs"
                  className="pointer-events-none rounded bg-transparent text-muted-foreground opacity-0 transition-opacity group-hover/shortcut:pointer-events-auto group-hover/shortcut:opacity-100 hover:text-foreground hover:!bg-transparent focus-visible:opacity-100 focus-visible:!bg-transparent"
                  onClick={openMenu}
                  type="button"
                >
                  <MoreVerticalIcon size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Note actions</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>
      <SidebarActionMenu
        open={showMenu}
        coords={menuCoords}
        onClose={() => setShowMenu(false)}
        onCloseFocusRef={menuButtonRef}
        items={menuItems}
        ariaLabel="Close note actions"
      />
    </div>
  );
});

type SidebarShortcutListProps = {
  activePath: string | null;
  items: NoteShortcutItem[];
  onOpenFile: (filePath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRequestRemoveFile?: (file: SidebarRemoveTarget) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onRevealInFinder?: (filePath: string) => void;
  revealLabel?: string;
};

export const SidebarShortcutList = memo(function SidebarShortcutList({
  activePath,
  items,
  onOpenFile,
  onTogglePinnedFile,
  onDeleteFile,
  onRequestRemoveFile,
  onRenameFile,
  onRevealInFinder,
  revealLabel,
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
          onDeleteFile={onDeleteFile}
          onRequestRemoveFile={onRequestRemoveFile}
          onRenameFile={onRenameFile}
          onRevealInFinder={onRevealInFinder}
          revealLabel={revealLabel}
        />
      ))}
    </div>
  );
});
