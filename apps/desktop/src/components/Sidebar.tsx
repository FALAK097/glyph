import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Logo } from "./logo";
import { SidebarTreeNode } from "./sidebar-tree-node";

import type { SidebarDeleteTarget, SidebarProps } from "../types/sidebar";

export const Sidebar = ({
  tree,
  activePath,
  isCollapsed,
  onOpenFile,
  onDeleteFile,
  onRenameFile,
  onToggleFolder,
  onReorderNodes,
}: SidebarProps) => {
  const [nodeToDelete, setNodeToDelete] = useState<SidebarDeleteTarget | null>(
    null,
  );
  const [draggedPath, setDraggedPath] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (nodeToDelete) {
      onDeleteFile(nodeToDelete.path);
    }
    setNodeToDelete(null);
  };

  if (isCollapsed) {
    return (
      <aside className="flex flex-col h-full w-20 bg-sidebar border-r border-border items-center pt-3">
        <div
          className="h-20 flex items-center justify-center flex-shrink-0 w-full"
          style={{ WebkitAppRegion: "drag" } as any}
        >
          <div
            style={{ WebkitAppRegion: "no-drag" } as any}
            className="flex items-center justify-center"
          >
            <Logo size={120} />
          </div>
        </div>
        <div className="flex-1" />
      </aside>
    );
  }

  return (
    <aside className="flex flex-col h-full w-[280px] bg-sidebar border-r border-border">
      <div
        className="flex items-center justify-center flex-shrink-0 bg-sidebar"
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <div style={{ WebkitAppRegion: "no-drag" } as any}>
          <Logo size={120} />
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="px-1">
          {/* Section label */}
          <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Notes
          </p>

          {/* Empty state */}
          {tree.length === 0 && !activePath ? (
            <p className="text-sm text-muted-foreground px-3">
              Create your first note from the command palette.
            </p>
          ) : (
            /* File tree */
            tree.map((entry) => (
              <SidebarTreeNode
                key={entry.node.path}
                node={entry.node}
                activePath={activePath}
                depth={0}
                isExpanded={entry.isExpanded}
                onOpenFile={onOpenFile}
                onRequestDelete={(node) => setNodeToDelete(node)}
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

      {/* Delete confirmation dialog */}
      {nodeToDelete ? (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setNodeToDelete(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Delete Note</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  "{nodeToDelete.name}"
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setNodeToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </aside>
  );
};
