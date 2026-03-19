import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { ChevronRightIcon, FileIcon, FolderIcon, MoreVerticalIcon, PencilIcon, TrashIcon } from "./icons";
import type { DragPosition, SidebarTreeNodeMenuCoords, SidebarTreeNodeProps } from "../types/sidebar";

export const SidebarTreeNode = ({
  node,
  activePath,
  depth,
  isExpanded,
  onOpenFile,
  onRequestDelete,
  onRenameFile,
  onToggleFolder,
  draggable,
  onDragStartTopLevel,
  onDropNode
}: SidebarTreeNodeProps) => {
  const [localIsExpanded, setLocalIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dropPosition, setDropPosition] = useState<DragPosition | null>(null);
  const [menuCoords, setMenuCoords] = useState<SidebarTreeNodeMenuCoords | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const isFolderExpanded = isExpanded ?? localIsExpanded;
  const containerClassName = useMemo(() => {
    if (dropPosition === "before") {
      return "border-t-2 border-primary";
    }

    if (dropPosition === "after") {
      return "border-b-2 border-primary";
    }

    return "border-transparent";
  }, [dropPosition]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setIsRenaming(false);
      return;
    }

    const currentName = node.name;
    const baseName = currentName.replace(/\.(md|markdown)$/i, "");

    if (trimmed !== currentName && trimmed !== baseName) {
      onRenameFile(node.path, trimmed);
    }
    setIsRenaming(false);
  };

  useEffect(() => {
    if (!isRenaming) {
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isRenaming]);

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
        onDragEnd: () => setDropPosition(null)
      }
    : {};

  if (node.type === "directory") {
    return (
      <div className={`mb-0.5 border-transparent ${containerClassName}`} {...dragHandlers}>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-start gap-2 rounded-md mx-1 hover:bg-sidebar-accent/50 transition-colors px-0 py-0"
          style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: "8px", paddingTop: "6px", paddingBottom: "6px" }}
          onClick={() => {
            if (depth === 0) {
              onToggleFolder(node.path);
              return;
            }

            setLocalIsExpanded((value) => !value);
          }}
          type="button"
        >
          <ChevronRightIcon
            size={12}
            className={`text-muted-foreground transition-transform ${isFolderExpanded ? "rotate-90" : ""}`}
          />
          <FolderIcon size={14} className="text-muted-foreground" />
          <span className="font-medium text-foreground truncate">{node.name}</span>
        </Button>
        {isFolderExpanded
          ? node.children.map((child) => (
              <SidebarTreeNode
                key={child.path}
                node={child}
                activePath={activePath}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                onRequestDelete={onRequestDelete}
                onRenameFile={onRenameFile}
                onToggleFolder={onToggleFolder}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <div className={`group relative flex items-center min-w-0 overflow-hidden mb-0.5 border-transparent ${containerClassName}`} {...dragHandlers}>
      <div
        className={`flex items-center rounded-md mx-1 flex-1 min-w-0 ${
          activePath === node.path ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: "4px", paddingTop: "6px", paddingBottom: "6px" }}
      >
        <FileIcon size={12} className="text-muted-foreground mr-2 flex-shrink-0" />
        {isRenaming ? (
          <Input
            ref={renameInputRef}
            type="text"
            className="flex-1 min-w-0 bg-transparent text-sm shadow-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded px-1 -ml-1 h-7 border-transparent"
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
            className="h-auto flex-1 min-w-0 justify-start bg-transparent px-0 py-0 text-left truncate text-sm hover:!bg-transparent dark:hover:!bg-transparent aria-expanded:!bg-transparent dark:aria-expanded:!bg-transparent"
            onClick={() => onOpenFile(node.path)}
            type="button"
          >
            {node.name}
          </Button>
        )}
         {!isRenaming ? (
            <div className="relative flex-shrink-0 ml-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    ref={menuButtonRef}
                    variant="ghost"
                    size="icon-xs"
                    className="rounded bg-transparent text-muted-foreground opacity-0 transition-opacity pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 hover:text-foreground hover:!bg-transparent dark:hover:!bg-transparent aria-expanded:!bg-transparent dark:aria-expanded:!bg-transparent focus-visible:opacity-100 focus-visible:!bg-transparent"
                    onClick={handleMenuToggle}
                    type="button"
                  >
                    <MoreVerticalIcon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Options</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
      </div>
      {showMenu && menuCoords ? (
        <>
          <Button
            aria-label="Close note menu"
            className="fixed inset-0 z-40 h-auto w-auto rounded-none bg-transparent hover:bg-transparent"
            onClick={(event) => {
              event.stopPropagation();
              setShowMenu(false);
            }}
            type="button"
            tabIndex={-1}
            variant="ghost"
            size="sm"
          />
          <div
            className="fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[160px]"
            style={{ top: menuCoords.top, left: menuCoords.left }}
          >
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setRenameValue(node.name.replace(/\.(md|markdown)$/i, ""));
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
                className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm hover:text-destructive hover:bg-destructive/10"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestDelete({ path: node.path, name: node.name });
                  setShowMenu(false);
                }}
                type="button"
              >
                <TrashIcon size={14} className="opacity-70 hover:text-destructive" />
                Delete
              </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};
