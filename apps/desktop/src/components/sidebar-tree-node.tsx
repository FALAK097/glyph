import { createPortal } from "react-dom";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDisplayFileName, isSamePath } from "@/lib/paths";

import { FileManagerLogo } from "./file-manager-logo";
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  MoreVerticalIcon,
  PinIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import type {
  DragPosition,
  SidebarRemoveTarget,
  SidebarTreeNodeMenuCoords,
  SidebarTreeNodeProps,
} from "../types/sidebar";

export const SidebarTreeNode = memo(function SidebarTreeNode({
  node,
  activePath,
  depth,
  isExpanded,
  folderRevealLabel,
  pinnedPaths,
  onOpenFile,
  onRequestRemoveFolder,
  onRequestRemoveFile,
  onRevealInFinder,
  onTogglePinnedFile,
  onRequestDelete,
  onRenameFile,
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
  const [menuCoords, setMenuCoords] = useState<SidebarTreeNodeMenuCoords | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const displayFileName = useMemo(() => getDisplayFileName(node.name), [node.name]);
  const isFolderExpanded = isExpanded ?? localIsExpanded;
  const revealLabel = folderRevealLabel;
  const pinnedPathList = pinnedPaths ?? [];
  const isPinned = pinnedPathList.some((path) => isSamePath(path, node.path));
  const isActive = isSamePath(activePath, node.path);
  const focusMenuButton = useCallback(() => {
    window.requestAnimationFrame(() => {
      menuButtonRef.current?.focus();
    });
  }, []);

  const containerClassName = useMemo(() => {
    if (dropPosition === "before") {
      return "border-t-2 border-primary/70 bg-primary/5 ring-1 ring-primary/20";
    }

    if (dropPosition === "after") {
      return "border-b-2 border-primary/70 bg-primary/5 ring-1 ring-primary/20";
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
      onRenameFile(node.path, trimmed);
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

  const dragHandlers = draggable
    ? {
        draggable: true,
        onDragStart: (event: DragEvent<HTMLDivElement>) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.path);
          onDragStartTopLevel?.(node.path);
        },
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
          if (!onDropNode) {
            return;
          }

          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          setDropPosition(event.clientY < bounds.top + bounds.height / 2 ? "before" : "after");
        },
        onDragLeave: () => setDropPosition(null),
        onDrop: (event: DragEvent<HTMLDivElement>) => {
          if (!onDropNode) {
            return;
          }

          event.preventDefault();
          onDropNode(node.path, dropPosition ?? "after");
          setDropPosition(null);
        },
        onDragEnd: () => setDropPosition(null),
      }
    : {};

  const renderMenu = (content: ReactNode, ariaLabel: string) => {
    if (!showMenu || !menuCoords) {
      return null;
    }

    return createPortal(
      <>
        <button
          aria-label={ariaLabel}
          className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
          onClick={(event) => {
            event.stopPropagation();
            setShowMenu(false);
            focusMenuButton();
          }}
          type="button"
          tabIndex={-1}
        />
        <div
          className="fixed z-50 w-[142px] rounded-md border border-border bg-popover py-1 shadow-lg"
          style={{ top: menuCoords.top, left: menuCoords.left }}
        >
          {content}
        </div>
      </>,
      document.body,
    );
  };

  if (node.type === "directory") {
    return (
      <div
        className={`relative mb-1 rounded-xl border border-transparent transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out ${containerClassName}`}
        {...dragHandlers}
      >
        <div
          className="group/folder-row mx-1 flex min-w-0 items-center rounded-lg border border-transparent text-sidebar-foreground transition-[background-color,border-color,color] duration-150 ease-out hover:border-sidebar-accent/20 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-within:border-sidebar-accent/30 focus-within:bg-sidebar-accent/50"
          style={{
            paddingLeft: `${depth * 14 + 6}px`,
            paddingRight: "4px",
            paddingTop: "4px",
            paddingBottom: "4px",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            className={`h-auto min-w-0 flex-1 cursor-pointer justify-start gap-2 rounded-md bg-transparent px-0 py-1 text-left hover:!bg-transparent ${
              draggable ? "cursor-grab active:cursor-grabbing" : ""
            }`}
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
          <div className="mt-1">
            {node.children.map((child) => (
              <SidebarTreeNode
                key={child.path}
                node={child}
                activePath={activePath}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                onRequestRemoveFolder={onRequestRemoveFolder}
                onRequestRemoveFile={onRequestRemoveFile}
                onRevealInFinder={onRevealInFinder}
                folderRevealLabel={folderRevealLabel}
                pinnedPaths={pinnedPaths}
                onTogglePinnedFile={onTogglePinnedFile}
                onRequestDelete={onRequestDelete}
                onRenameFile={onRenameFile}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        ) : null}

        {renderMenu(
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm hover:bg-white/10 dark:hover:bg-white/10"
              onClick={(event) => {
                event.stopPropagation();
                onRevealInFinder(node.path);
                setShowMenu(false);
                focusMenuButton();
              }}
              type="button"
            >
              <FileManagerLogo label={revealLabel} size={14} className="opacity-70" />
              {revealLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm hover:bg-white/10 dark:hover:bg-white/10"
              onClick={(event) => {
                event.stopPropagation();
                const folder: SidebarRemoveTarget = {
                  path: node.path,
                  name: node.name,
                };
                onRequestRemoveFolder(folder);
                setShowMenu(false);
              }}
              type="button"
            >
              <XIcon size={14} className="opacity-70" />
              Remove
            </Button>
          </>,
          "Close folder menu",
        )}
      </div>
    );
  }

  return (
    <div
      className={`group/file-row relative mb-0.5 flex min-w-0 items-center overflow-hidden rounded-xl border border-transparent transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] ${containerClassName}`}
      {...dragHandlers}
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

      {renderMenu(
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm hover:bg-white/10 dark:hover:bg-white/10"
            onClick={(event) => {
              event.stopPropagation();
              setRenameValue(displayFileName);
              setIsRenaming(true);
              setShowMenu(false);
            }}
            type="button"
          >
            <PencilIcon size={14} className="opacity-70" />
            Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm hover:bg-white/10 dark:hover:bg-white/10"
            onClick={(event) => {
              event.stopPropagation();
              onRequestRemoveFile?.({ path: node.path, name: node.name });
              setShowMenu(false);
            }}
            type="button"
          >
            <XIcon size={14} className="opacity-70" />
            Remove
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onRequestDelete({ path: node.path, name: node.name });
              setShowMenu(false);
            }}
            type="button"
          >
            <TrashIcon size={14} className="opacity-70" />
            Delete
          </Button>
        </>,
        "Close note menu",
      )}
    </div>
  );
});
