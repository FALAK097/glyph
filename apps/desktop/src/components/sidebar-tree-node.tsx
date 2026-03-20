import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDisplayFileName } from "@/lib/paths";

import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  RevealInFolderIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import type {
  DragPosition,
  SidebarRemoveTarget,
  SidebarTreeNodeMenuCoords,
  SidebarTreeNodeProps,
} from "../types/sidebar";

export const SidebarTreeNode = ({
  node,
  activePath,
  depth,
  isExpanded,
  onOpenFile,
  onRequestRemoveFolder,
  onRevealInFinder,
  onRequestDelete,
  onRenameFile,
  onToggleFolder,
  draggable,
  onDragStartTopLevel,
  onDropNode,
}: SidebarTreeNodeProps) => {
  const [localIsExpanded, setLocalIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dropPosition, setDropPosition] = useState<DragPosition | null>(null);
  const [menuCoords, setMenuCoords] =
    useState<SidebarTreeNodeMenuCoords | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const displayFileName = useMemo(
    () => getDisplayFileName(node.name),
    [node.name],
  );
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
    const baseName =
      node.type === "file" ? getDisplayFileName(currentName) : currentName;

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
          setDropPosition(
            event.clientY < bounds.top + bounds.height / 2 ? "before" : "after",
          );
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

    return (
      <>
        <Button
          aria-label={ariaLabel}
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
          className="fixed z-50 w-[142px] rounded-md border border-border bg-popover py-1 shadow-lg"
          style={{ top: menuCoords.top, left: menuCoords.left }}
        >
          {content}
        </div>
      </>
    );
  };

  if (node.type === "directory") {
    return (
      <div
        className={`group relative mb-1 border-transparent ${containerClassName}`}
        {...dragHandlers}
      >
        <div
          className="mx-1 flex min-w-0 items-center rounded-md transition-colors hover:bg-sidebar-accent/50"
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
            className={`h-auto min-w-0 flex-1 justify-start gap-2 rounded-md bg-transparent px-0 py-1 text-left hover:!bg-transparent ${
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
                className="transition-all duration-150 group-hover:scale-90 group-hover:opacity-0"
              />
              <ChevronRightIcon
                size={12}
                className={`absolute transition-all duration-150 group-hover:opacity-100 ${
                  isFolderExpanded ? "rotate-90 opacity-0" : "opacity-0"
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
              <span className="min-w-0 truncate font-medium text-foreground">
                {node.name}
              </span>
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
                    className="pointer-events-none rounded bg-transparent text-muted-foreground opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:text-foreground hover:!bg-transparent focus-visible:opacity-100 focus-visible:!bg-transparent"
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

        {isFolderExpanded
          ? node.children.map((child) => (
              <SidebarTreeNode
                key={child.path}
                node={child}
                activePath={activePath}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                onRequestRemoveFolder={onRequestRemoveFolder}
                onRevealInFinder={onRevealInFinder}
                onRequestDelete={onRequestDelete}
                onRenameFile={onRenameFile}
                onToggleFolder={onToggleFolder}
              />
            ))
          : null}

        {renderMenu(
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
              onClick={(event) => {
                event.stopPropagation();
                onRevealInFinder(node.path);
                setShowMenu(false);
              }}
              type="button"
            >
              <RevealInFolderIcon size={14} className="shrink-0 opacity-70" />
              Open in Finder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
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
      className={`group relative mb-0.5 flex min-w-0 items-center overflow-hidden border-transparent ${containerClassName}`}
      {...dragHandlers}
    >
      <div
        className={`mx-1 flex min-w-0 flex-1 items-center rounded-md ${
          activePath === node.path
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : ""
        }`}
        style={{
          paddingLeft: `${depth * 14 + 8}px`,
          paddingRight: "4px",
          paddingTop: "6px",
          paddingBottom: "6px",
        }}
      >
        <FileIcon size={12} className="mr-2 shrink-0 text-muted-foreground" />
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
            className="h-auto min-w-0 flex-1 justify-start truncate bg-transparent px-0 py-0 text-left text-sm hover:!bg-transparent"
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
                  className="pointer-events-none rounded bg-transparent text-muted-foreground opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:text-foreground hover:!bg-transparent focus-visible:opacity-100 focus-visible:!bg-transparent"
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

      {renderMenu(
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
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
};
