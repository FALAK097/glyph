import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import type { DirectoryNode } from "../shared/workspace";
import { Logo } from "./Logo";

export type DragPosition = "before" | "after";

export type SidebarTopLevelNode = {
  node: DirectoryNode;
  isExpanded: boolean;
};

type SidebarProps = {
  tree: SidebarTopLevelNode[];
  activePath: string | null;
  isCollapsed: boolean;
  onOpenFile: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onToggleFolder: (folderPath: string) => void;
  onReorderNodes: (sourcePath: string, targetPath: string, position: DragPosition) => void;
};

type TreeNodeProps = {
  node: DirectoryNode;
  activePath: string | null;
  depth: number;
  isExpanded?: boolean;
  onOpenFile: (filePath: string) => void;
  onRequestDelete: (node: { path: string; name: string }) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onToggleFolder: (folderPath: string) => void;
  draggable?: boolean;
  onDragStartTopLevel?: (sourcePath: string) => void;
  onDropNode?: (targetPath: string, position: DragPosition) => void;
};

function TreeNode({
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
}: TreeNodeProps) {
  const [localIsExpanded, setLocalIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dropPosition, setDropPosition] = useState<DragPosition | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
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
      <div className={`sidebar-node mb-[2px] border-transparent ${containerClassName}`} {...dragHandlers}>
        <button
          className="sidebar-directory flex items-center gap-2 w-full text-left rounded-md mx-1 hover:bg-sidebar-accent/50 transition-colors"
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
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${isFolderExpanded ? "rotate-90" : ""}`}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
          <span className="font-medium text-foreground truncate">{node.name}</span>
        </button>
        {isFolderExpanded && node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            activePath={activePath}
            depth={depth + 1}
            onOpenFile={onOpenFile}
            onRequestDelete={onRequestDelete}
            onRenameFile={onRenameFile}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`group relative flex items-center min-w-0 overflow-hidden mb-[2px] border-transparent ${containerClassName}`} {...dragHandlers}>
      <div
        className={`sidebar-file flex items-center rounded-md mx-1 flex-1 min-w-0 ${activePath === node.path ? "is-active bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}`}
        style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: "4px", paddingTop: "6px", paddingBottom: "6px" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mr-2 flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-1 -ml-1"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleRenameSubmit();
              }
              if (event.key === "Escape") {
                setIsRenaming(false);
              }
            }}
          />
        ) : (
          <button className="flex-1 min-w-0 text-left truncate text-sm" onClick={() => onOpenFile(node.path)} type="button">
            {node.name}
          </button>
        )}
        {!isRenaming && (
          <div className="relative flex-shrink-0 ml-1">
            <button
              ref={menuButtonRef}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
              onClick={handleMenuToggle}
              title="Options"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            </button>
          </div>
        )}
      </div>
      {showMenu && menuCoords && (
        <>
          <button
            aria-label="Close note menu"
            className="fixed inset-0 z-40"
            onClick={(event) => { event.stopPropagation(); setShowMenu(false); }}
            type="button"
          />
          <div
            className="fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[160px]"
            style={{ top: menuCoords.top, left: menuCoords.left }}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={(event) => {
                event.stopPropagation();
                setRenameValue(node.name.replace(/\.(md|markdown)$/i, ""));
                setIsRenaming(true);
                setShowMenu(false);
              }}
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              Rename
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-red-500 hover:bg-red-500/10 transition-colors"
              onClick={(event) => {
                event.stopPropagation();
                onRequestDelete({ path: node.path, name: node.name });
                setShowMenu(false);
              }}
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar({
  tree,
  activePath,
  isCollapsed,
  onOpenFile,
  onDeleteFile,
  onRenameFile,
  onToggleFolder,
  onReorderNodes
}: SidebarProps) {
  const [nodeToDelete, setNodeToDelete] = useState<{ path: string; name: string } | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);

  const handleRequestDelete = (node: { path: string; name: string }) => {
    setNodeToDelete(node);
  };

  const handleConfirmDelete = () => {
    if (nodeToDelete) {
      onDeleteFile(nodeToDelete.path);
    }
    setNodeToDelete(null);
  };

  if (isCollapsed) {
    return (
      <aside className="sidebar collapsed-sidebar flex flex-col h-full w-14 bg-sidebar border-r border-border items-center pb-4">
        <div className="p-2 mb-2 text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </div>
        <div className="flex-1" />
      </aside>
    );
  }

  return (
    <aside className="sidebar flex flex-col h-full w-[280px] bg-sidebar border-r border-border">
      <div className="flex items-center pl-20 pr-4 py-2 border-b border-border/40 flex-shrink-0">
        <div className="mt-3">
          <Logo size={18} showText={true} />
        </div>
      </div>

      <div className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-3 min-h-0">
        <div className="sidebar-section sidebar-tree">
          <p className="sidebar-section-title px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>

          {tree.length === 0 && !activePath ? (
            <p className="sidebar-empty text-sm text-muted-foreground px-3">Create your first note from the command palette.</p>
          ) : (
            tree.map((entry) => (
              <TreeNode
                key={entry.node.path}
                node={entry.node}
                activePath={activePath}
                depth={0}
                isExpanded={entry.isExpanded}
                onOpenFile={onOpenFile}
                onRequestDelete={handleRequestDelete}
                onRenameFile={onRenameFile}
                onToggleFolder={onToggleFolder}
                draggable
                onDragStartTopLevel={setDraggedPath}
                onDropNode={(targetPath, position) => {
                  if (!draggedPath || draggedPath === targetPath) {
                    return;
                  }

                  onReorderNodes(draggedPath, targetPath, position);
                  setDraggedPath(null);
                }}
              />
            ))
          )}
        </div>
      </div>

      {nodeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border shadow-lg rounded-lg p-6 w-[400px] max-w-[90vw]">
            <h2 className="text-lg font-semibold mb-2">Delete Note</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{nodeToDelete.name}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors" onClick={() => setNodeToDelete(null)} type="button">
                Cancel
              </button>
              <button className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors" onClick={handleConfirmDelete} type="button">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
