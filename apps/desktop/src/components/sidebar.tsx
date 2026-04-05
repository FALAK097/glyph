import { createPortal } from "react-dom";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDisplayFileName, normalizePath } from "@/lib/paths";

import type { NoteShortcutItem } from "@/types/navigation";
import type {
  DragPosition,
  SidebarDeleteTarget,
  SidebarProps,
  SidebarRemoveTarget,
  SidebarSkillCollectionItem,
} from "../types/sidebar";

import { LogoComponent } from "./logo-component";
import { SkillSourceLogo } from "./skill-source-logo";
import { ChevronRightIcon, MoreVerticalIcon, PencilIcon, PinIcon, TrashIcon, XIcon } from "./icons";
import { SidebarTreeNode } from "./sidebar-tree-node";

const normalizePathKey = (path: string) => normalizePath(path).toLowerCase();

type SidebarShortcutRowProps = {
  activePath: string | null;
  item: NoteShortcutItem;
  onOpenFile: (filePath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRequestRemoveFile?: (file: SidebarRemoveTarget) => void;
  onRenameFile: (filePath: string, newName: string) => void;
};

const SidebarShortcutRow = memo(function SidebarShortcutRow({
  activePath,
  item,
  onOpenFile,
  onTogglePinnedFile,
  onDeleteFile,
  onRequestRemoveFile,
  onRenameFile,
}: SidebarShortcutRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
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

  const focusMenuButton = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (menuButtonRef.current?.isConnected) {
        menuButtonRef.current.focus();
        return;
      }

      document.querySelector<HTMLElement>("[data-glyph-editor='true']")?.focus();
    });
  }, []);

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

    if (!showMenu) {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuCoords({ top: rect.bottom + 4, left: rect.right + 4 });
    }

    setShowMenu((value) => !value);
  };

  const renderMenu = () => {
    if (!showMenu || !menuCoords) {
      return null;
    }

    return createPortal(
      <>
        <button
          aria-label="Close note actions"
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
            className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
            onClick={(event) => {
              event.stopPropagation();
              onRequestRemoveFile?.({ path: item.path, name: item.title });
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
              onDeleteFile(item.path);
              setShowMenu(false);
            }}
            type="button"
          >
            <TrashIcon size={14} className="opacity-70" />
            Delete
          </Button>
        </div>
      </>,
      document.body,
    );
  };

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
      {renderMenu()}
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
};

const SidebarShortcutList = memo(function SidebarShortcutList({
  activePath,
  items,
  onOpenFile,
  onTogglePinnedFile,
  onDeleteFile,
  onRequestRemoveFile,
  onRenameFile,
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
        />
      ))}
    </div>
  );
});

function SidebarSkillCollectionRow({
  item,
  onSelect,
}: {
  item: SidebarSkillCollectionItem;
  onSelect?: (collectionId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.id)}
      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.99] ${
        item.isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-accent/30"
          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <SkillSourceLogo iconKind={item.iconKind} sourceKind={item.sourceKind} variant="compact" />
        <span className="truncate text-sm font-medium">{item.label}</span>
      </span>
      <span className="ml-3 rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {item.count}
      </span>
    </button>
  );
}

export const Sidebar = ({
  tree,
  activePath,
  isCollapsed,
  isNotesExpanded = true,
  isSkillsExpanded = false,
  folderRevealLabel,
  openInFolderLabel,
  pinnedNotes,
  skillCollections,
  onToggleNotesSection,
  onToggleSkillsSection,
  onSelectSkillCollection,
  onOpenFile,
  onDeleteFile,
  onRemoveFileFromGlyph,
  onTogglePinnedFile,
  onRemoveFolder,
  onRenameFile,
  onRevealInFinder,
  onToggleFolder,
  onReorderNodes,
}: SidebarProps) => {
  const [nodeToDelete, setNodeToDelete] = useState<SidebarDeleteTarget | null>(null);
  const [fileToRemove, setFileToRemove] = useState<SidebarRemoveTarget | null>(null);
  const [folderToRemove, setFolderToRemove] = useState<SidebarRemoveTarget | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const pinnedList = pinnedNotes ?? [];
  const revealLabel = folderRevealLabel ?? openInFolderLabel ?? "Open in Finder";
  const pinnedPaths = useMemo(() => pinnedList.map((note) => note.path), [pinnedList]);
  const handleRequestRemoveFolder = useCallback((folder: SidebarRemoveTarget) => {
    setFolderToRemove(folder);
  }, []);
  const handleRequestDelete = useCallback((node: SidebarDeleteTarget) => {
    setNodeToDelete(node);
  }, []);
  const handleDropNode = useCallback(
    (targetPath: string, position: DragPosition) => {
      if (!draggedPath || draggedPath === targetPath) {
        return;
      }

      onReorderNodes(draggedPath, targetPath, position);
      setDraggedPath(null);
    },
    [draggedPath, onReorderNodes],
  );

  const handleConfirmDelete = () => {
    if (nodeToDelete) {
      onDeleteFile(nodeToDelete.path);
    }
    setNodeToDelete(null);
  };

  const handleConfirmRemoveFile = () => {
    if (fileToRemove) {
      onRemoveFileFromGlyph?.(fileToRemove.path);
    }
    setFileToRemove(null);
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
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <LogoComponent size={120} />
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
        {skillCollections && skillCollections.length > 0 ? (
          <div className="mb-3">
            <button
              type="button"
              onClick={onToggleSkillsSection}
              className="flex w-full items-center justify-between px-4 py-1.5 text-left"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                SKILLS
              </p>
              <ChevronRightIcon
                size={14}
                className={`text-muted-foreground transition-transform duration-150 ${
                  isSkillsExpanded ? "rotate-90" : ""
                }`}
              />
            </button>
            {isSkillsExpanded ? (
              <div>
                <div className="space-y-1 px-2">
                  {skillCollections
                    .filter((item) => item.group === "scope")
                    .map((item) => (
                      <SidebarSkillCollectionRow
                        key={item.id}
                        item={item}
                        onSelect={onSelectSkillCollection}
                      />
                    ))}
                </div>
                {skillCollections.some((item) => item.group === "tool") ? (
                  <div className="mt-4">
                    <div className="px-4 py-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        TOOLS
                      </p>
                    </div>
                    <div className="space-y-1 px-2">
                      {skillCollections
                        .filter((item) => item.group === "tool")
                        .map((item) => (
                          <SidebarSkillCollectionRow
                            key={item.id}
                            item={item}
                            onSelect={onSelectSkillCollection}
                          />
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <button
            type="button"
            onClick={onToggleNotesSection}
            className="flex w-full items-center justify-between px-4 py-1.5 text-left"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              NOTES
            </p>
            <ChevronRightIcon
              size={14}
              className={`text-muted-foreground transition-transform duration-150 ${
                isNotesExpanded ? "rotate-90" : ""
              }`}
            />
          </button>
          {isNotesExpanded ? (
            <>
              {pinnedList.length > 0 ? (
                <div className="mb-2 px-2">
                  <SidebarShortcutList
                    activePath={activePath}
                    items={pinnedList}
                    onOpenFile={onOpenFile}
                    onTogglePinnedFile={onTogglePinnedFile}
                    onRequestRemoveFile={setFileToRemove}
                    onDeleteFile={(filePath) => {
                      const segments = filePath.replace(/\\/g, "/").split("/");
                      const name = segments.pop() ?? filePath;
                      setNodeToDelete({ path: filePath, name });
                    }}
                    onRenameFile={onRenameFile}
                  />
                </div>
              ) : null}
              <div className="px-2">
                {tree.length === 0 && !activePath ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    Create your first note or open the palette to start navigating.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {tree.map((entry) => (
                      <SidebarTreeNode
                        key={entry.node.path}
                        node={entry.node}
                        activePath={activePath}
                        depth={0}
                        folderRevealLabel={revealLabel}
                        isExpanded={entry.isExpanded}
                        pinnedPaths={pinnedPaths}
                        onOpenFile={onOpenFile}
                        onRequestRemoveFolder={handleRequestRemoveFolder}
                        onRequestRemoveFile={setFileToRemove}
                        onRevealInFinder={onRevealInFinder}
                        onRequestDelete={handleRequestDelete}
                        onRenameFile={onRenameFile}
                        onToggleFolder={onToggleFolder}
                        onTogglePinnedFile={onTogglePinnedFile}
                        draggable
                        onDragStartTopLevel={setDraggedPath}
                        onDropNode={handleDropNode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

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

      {fileToRemove ? (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setFileToRemove(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Remove Note From Glyph</DialogTitle>
              <DialogDescription>
                Remove <span className="font-semibold text-foreground">"{fileToRemove.name}"</span>{" "}
                from Glyph? This only hides it from the app and does not delete the file from your
                device.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setFileToRemove(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmRemoveFile}>
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </aside>
  );
};
