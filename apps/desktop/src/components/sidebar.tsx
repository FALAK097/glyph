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

import { SidebarTreeNode } from "./sidebar-tree-node";

import type { SidebarDeleteTarget, SidebarProps, SidebarRemoveTarget } from "../types/sidebar";
import { LogoComponent } from "./logo-component";

export const Sidebar = ({
  tree,
  activePath,
  isCollapsed,
  onOpenFile,
  onDeleteFile,
  onRemoveFolder,
  onRenameFile,
  onRevealInFinder,
  onToggleFolder,
  onReorderNodes,
}: SidebarProps) => {
  const [nodeToDelete, setNodeToDelete] = useState<SidebarDeleteTarget | null>(null);
  const [folderToRemove, setFolderToRemove] = useState<SidebarRemoveTarget | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (nodeToDelete) {
      onDeleteFile(nodeToDelete.path);
    }
    setNodeToDelete(null);
  };

  const handleConfirmRemove = () => {
    if (folderToRemove) {
      onRemoveFolder(folderToRemove.path);
    }
    setFolderToRemove(null);
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <aside className="flex h-full min-h-0 w-[280px] flex-col border-r border-border bg-sidebar">
      <div
        className="flex items-center justify-center flex-shrink-0 bg-sidebar"
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <div style={{ WebkitAppRegion: "no-drag" } as any}>
          <LogoComponent size={120} />
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
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
                onRequestRemoveFolder={(folder) => setFolderToRemove(folder)}
                onRevealInFinder={onRevealInFinder}
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
                <span className="font-semibold text-foreground">"{nodeToDelete.name}"</span>? This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setNodeToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" type="button" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {folderToRemove ? (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setFolderToRemove(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Remove Folder From Glyph</DialogTitle>
              <DialogDescription>
                Remove{" "}
                <span className="font-semibold text-foreground">"{folderToRemove.name}"</span> from
                Glyph? This only removes it from the sidebar and does not delete anything from your
                device.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setFolderToRemove(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmRemove}>
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </aside>
  );
};
