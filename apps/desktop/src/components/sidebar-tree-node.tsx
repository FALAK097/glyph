import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDisplayFileName, isSamePath } from "@/lib/paths";

import {
  SidebarActionMenu,
  buildFileMenuItems,
  buildFolderMenuItems,
  type SidebarActionMenuCoords,
} from "./sidebar-action-menu";
import { ChevronRightIcon, FileIcon, FolderIcon, MoreVerticalIcon, PinIcon } from "./icons";
import type { DragPosition, SidebarRemoveTarget, SidebarTreeNodeProps } from "../types/sidebar";

let globalDraggedSidebarPath: string | null = null;

export const SidebarTreeNode = memo(function SidebarTreeNode({
  node,
  activePath,
  depth,
  isExpanded,
  folderRevealLabel,
  pinnedPaths,
  onOpenFile,
  onRequestRemoveFolder,
  onRequestDeleteFolder,
  onRequestRemoveFile,
  onRevealInFinder,
  onTogglePinnedFile,
  onRequestDelete,
  onRenameFile,
  onRenameFolder,
  onToggleFolder,
  draggable,
  onDragStartTopLevel,
  onDropNode,
}: SidebarTreeNodeProps) {
  const [localIsExpanded, setLocalIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dropPosition, setDropPosition] = useState<DragPosition | null>(null);
  const [menuCoords, setMenuCoords] = useState<SidebarActionMenuCoords | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const displayFileName = useMemo(() => getDisplayFileName(node.name), [node.name]);
  const isFolderExpanded = isExpanded ?? localIsExpanded;
  const revealLabel = folderRevealLabel;
  const pinnedPathList = pinnedPaths ?? [];
  const isPinned = pinnedPathList.some((path) => isSamePath(path, node.path));
  const isActive = isSamePath(activePath, node.path);

  const containerClassName = useMemo(() => {
    if (dropPosition === "before") {
      return "border-t-2 border-primary/70 bg-primary/5 ring-1 ring-primary/20";
    }

    if (dropPosition === "after") {
      return "border-b-2 border-primary/70 bg-primary/5 ring-1 ring-primary/20";
    }

    if (dropPosition === "inside") {
      return "bg-primary/6 ring-1 ring-inset ring-primary/30";
    }

    return "border-transparent";
  }, [dropPosition]);

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

    const currentName = node.name;
    const baseName = node.type === "file" ? getDisplayFileName(currentName) : currentName;

    if (trimmed !== currentName && trimmed !== baseName) {
      if (node.type === "directory" && onRenameFolder) {
        onRenameFolder(node.path, trimmed);
      } else {
        onRenameFile(node.path, trimmed);
      }
    }

    setIsRenaming(false);
  };

  const handleMenuToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuCoords({ top: rect.bottom + 4, left: rect.right + 4 });
    }
    setShowMenu((prev) => !prev);
  };

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!draggable) {
        return;
      }

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", node.path);
      globalDraggedSidebarPath = node.path;
      onDragStartTopLevel?.(node.path);
    },
    [draggable, node.path, onDragStartTopLevel],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!onDropNode) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const bounds = event.currentTarget.getBoundingClientRect();
      if (node.type === "directory") {
        const offsetY = event.clientY - bounds.top;
        const topZoneHeight = bounds.height * 0.25;
        const bottomZoneStart = bounds.height * 0.75;

        if (offsetY < topZoneHeight) {
          setDropPosition("before");
          return;
        }

        if (offsetY > bottomZoneStart) {
          setDropPosition("after");
          return;
        }

        setDropPosition("inside");
        return;
      }

      setDropPosition(event.clientY < bounds.top + bounds.height / 2 ? "before" : "after");
    },
    [node.type, onDropNode],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!onDropNode) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const sourcePath = event.dataTransfer.getData("text/plain") || globalDraggedSidebarPath;
      if (!sourcePath) {
        setDropPosition(null);
        return;
      }

      void onDropNode(sourcePath, node.path, dropPosition ?? "after");
      setDropPosition(null);
    },
    [dropPosition, node.path, onDropNode],
  );

  const handleDragEnd = useCallback(() => {
    globalDraggedSidebarPath = null;
    setDropPosition(null);
  }, []);

  const handleDirectoryContentDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!onDropNode || node.type !== "directory") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setDropPosition("inside");
    },
    [node.type, onDropNode],
  );

  const handleDirectoryContentDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!onDropNode || node.type !== "directory") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const sourcePath = event.dataTransfer.getData("text/plain") || globalDraggedSidebarPath;
      if (!sourcePath) {
        setDropPosition(null);
        return;
      }

      void onDropNode(sourcePath, node.path, "inside");
      setDropPosition(null);
    },
    [node.path, node.type, onDropNode],
  );

  const dragHandlers = draggable
    ? {
        onDragOver: handleDragOver,
        onDragLeave: () => setDropPosition(null),
        onDrop: handleDrop,
      }
    : {};

  const fileMenuItems = buildFileMenuItems({
    displayFileName,
    onRename: () => {
      setRenameValue(displayFileName);
      setIsRenaming(true);
    },
    onRevealInFinder: () => {
      onRevealInFinder(node.path);
    },
    onRemove: () => {
      onRequestRemoveFile?.({ path: node.path, name: node.name });
    },
    onDelete: () => {
      onRequestDelete({ path: node.path, name: node.name });
    },
    revealLabel: revealLabel ?? "Reveal in Finder",
  });

  const folderMenuItems = buildFolderMenuItems({
    folderName: node.name,
    onRename: () => {
      setRenameValue(node.name);
      setIsRenaming(true);
    },
    onRevealInFinder: () => {
      onRevealInFinder(node.path);
    },
    onRemove: () => {
      const folder: SidebarRemoveTarget = { path: node.path, name: node.name };
      onRequestRemoveFolder(folder);
    },
    onDelete: onRequestDeleteFolder
      ? () => {
          onRequestDeleteFolder({ path: node.path, name: node.name });
        }
      : undefined,
    revealLabel: revealLabel ?? "Reveal in Finder",
  });

  if (node.type === "directory") {
    return (
      <div
        className={`relative mb-1 rounded-xl border border-transparent transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out ${containerClassName}`}
      >
        <div
          className="group/folder-row mx-1 flex min-w-0 items-center rounded-lg border border-transparent text-sidebar-foreground transition-[background-color,border-color,color] duration-150 ease-out hover:border-sidebar-accent/20 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-within:border-sidebar-accent/30 focus-within:bg-sidebar-accent/50"
          style={{
            paddingLeft: `${depth * 14 + 6}px`,
            paddingRight: "4px",
            paddingTop: "4px",
            paddingBottom: "4px",
          }}
          {...dragHandlers}
        >
          <Button
            variant="ghost"
            size="sm"
            aria-label={node.name}
            className={`h-auto min-w-0 flex-1 cursor-pointer justify-start gap-2 rounded-md bg-transparent px-0 py-1 text-left hover:!bg-transparent ${
              draggable ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            draggable={draggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => {
              if (depth === 0) {
                onToggleFolder(node.path);
                return;
              }

              setLocalIsExpanded((value) => !value);
            }}
            type="button"
          >
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
              <FolderIcon
                size={14}
                className="transition-[transform,opacity,color] duration-200 ease-out group-hover/folder-row:scale-90 group-hover/folder-row:opacity-0 group-hover/folder-row:text-sidebar-accent-foreground/75"
              />
              <ChevronRightIcon
                size={12}
                className={`absolute opacity-0 transition-[transform,opacity,color] duration-200 ease-out group-hover/folder-row:opacity-100 ${
                  isFolderExpanded ? "rotate-90" : ""
                }`}
              />
            </span>
            {isRenaming ? (
              <Input
                ref={renameInputRef}
                type="text"
                className="h-7 min-w-0 flex-1 rounded border-transparent bg-transparent px-1 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-primary/50"
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
              <span className="min-w-0 truncate font-medium text-foreground">{node.name}</span>
            )}
          </Button>
          {!isRenaming ? (
            <div className="relative ml-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    ref={menuButtonRef}
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Folder actions"
                    className="pointer-events-none rounded bg-transparent text-muted-foreground opacity-0 transition-opacity group-hover/folder-row:pointer-events-auto group-hover/folder-row:opacity-100 hover:text-foreground hover:!bg-transparent focus-visible:opacity-100 focus-visible:!bg-transparent"
                    onClick={handleMenuToggle}
                    type="button"
                  >
                    <MoreVerticalIcon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Folder actions</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>

        {isFolderExpanded ? (
          <div
            className="mt-1"
            onDragOver={handleDirectoryContentDragOver}
            onDrop={handleDirectoryContentDrop}
          >
            {node.children.map((child) => (
              <SidebarTreeNode
                key={child.path}
                node={child}
                activePath={activePath}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                onRequestRemoveFolder={onRequestRemoveFolder}
                onRequestDeleteFolder={onRequestDeleteFolder}
                onRequestRemoveFile={onRequestRemoveFile}
                onRevealInFinder={onRevealInFinder}
                folderRevealLabel={folderRevealLabel}
                pinnedPaths={pinnedPaths}
                onTogglePinnedFile={onTogglePinnedFile}
                onRequestDelete={onRequestDelete}
                onRenameFile={onRenameFile}
                onRenameFolder={onRenameFolder}
                onToggleFolder={onToggleFolder}
                draggable={draggable}
                onDragStartTopLevel={onDragStartTopLevel}
                onDropNode={onDropNode}
              />
            ))}
          </div>
        ) : null}

        <SidebarActionMenu
          open={showMenu && node.type === "directory"}
          coords={menuCoords}
          onClose={() => setShowMenu(false)}
          onCloseFocusRef={menuButtonRef}
          items={folderMenuItems}
          ariaLabel="Close folder menu"
        />
      </div>
    );
  }

  return (
    <div
      className={`group/file-row relative mb-0.5 flex min-w-0 items-center overflow-hidden rounded-xl border border-transparent transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] ${containerClassName}`}
    >
      <div
        className={`mx-1 flex min-w-0 flex-1 cursor-pointer items-center rounded-md transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-accent/30"
            : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-within:bg-sidebar-accent/70 focus-within:text-sidebar-accent-foreground"
        }`}
        style={{
          paddingLeft: `${depth * 14 + 8}px`,
          paddingRight: "4px",
          paddingTop: "6px",
          paddingBottom: "6px",
        }}
        {...dragHandlers}
      >
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center mr-2">
          <FileIcon
            size={12}
            className={`transition-[opacity,color] duration-200 ${
              isPinned
                ? "opacity-0"
                : isActive
                  ? "text-sidebar-accent-foreground/70 group-hover/file-row:opacity-0"
                  : "text-muted-foreground group-hover/file-row:text-sidebar-accent-foreground/70 group-hover/file-row:opacity-0"
            }`}
          />
          <button
            type="button"
            className={`absolute flex items-center justify-center transition-[opacity,color] duration-200 cursor-pointer hover:text-foreground ${
              isPinned
                ? isActive
                  ? "opacity-100 text-sidebar-accent-foreground/70"
                  : "opacity-100 text-muted-foreground"
                : "opacity-0 group-hover/file-row:opacity-100 group-hover/file-row:text-sidebar-accent-foreground/70"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePinnedFile?.(node.path);
            }}
            aria-label={isPinned ? "Unpin note" : "Pin note"}
          >
            <PinIcon size={12} />
          </button>
        </span>
        {isRenaming ? (
          <Input
            ref={renameInputRef}
            type="text"
            className="h-7 min-w-0 flex-1 -ml-1 rounded border-transparent bg-transparent px-1 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-primary/50"
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
            draggable={draggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => onOpenFile(node.path)}
            type="button"
          >
            {displayFileName}
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
                  aria-label="Note actions"
                  className="pointer-events-none rounded bg-transparent text-muted-foreground opacity-0 transition-opacity group-hover/file-row:pointer-events-auto group-hover/file-row:opacity-100 hover:text-foreground hover:!bg-transparent focus-visible:opacity-100 focus-visible:!bg-transparent"
                  onClick={handleMenuToggle}
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
        open={showMenu && node.type === "file"}
        coords={menuCoords}
        onClose={() => setShowMenu(false)}
        onCloseFocusRef={menuButtonRef}
        items={fileMenuItems}
        ariaLabel="Close note menu"
      />
    </div>
  );
});
