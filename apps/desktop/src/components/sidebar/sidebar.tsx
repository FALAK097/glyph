import { useCallback, useMemo, useState } from "react";

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
import { getShortcutDisplay } from "@/core/shortcuts";
import { cn } from "@/core/utils";

import type {
  DragPosition,
  SidebarDeleteTarget,
  SidebarProps,
  SidebarRemoveTarget,
  SidebarSkillCollectionItem,
} from "@/types/sidebar";

import { SkillSourceLogo } from "@/components/skills/skill-source-logo";
import { ChevronRightIcon, PlusIcon, FolderPlusIcon } from "@/components/icons";
import { getSkillSourceAccent } from "@/core/skill-source-accents";
import { NoteCollectionRow } from "./note-collection-row";
import { SidebarTreeNode } from "./sidebar-tree-node";
import { SidebarShortcutList } from "./sidebar-shortcut-row";

function SidebarSkillCollectionRow({
  item,
  onSelect,
}: {
  item: SidebarSkillCollectionItem;
  onSelect?: (collectionId: string) => void;
}) {
  const accent = getSkillSourceAccent(item.sourceKind, item.iconKind);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.id)}
      className={cn(
        "group flex w-full items-center justify-between rounded-md border-l-2 px-0.5 py-1.5 pr-2 text-left transition-colors duration-100 ease-out",
        item.isActive ? cn(accent.active, accent.border) : cn("border-l-transparent", accent.hover),
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        <SkillSourceLogo
          className={accent.icon}
          iconKind={item.iconKind}
          sourceKind={item.sourceKind}
          variant="compact"
        />
        <span
          className={cn(
            "truncate text-sm",
            item.isActive ? accent.text : "text-sidebar-foreground",
          )}
        >
          {item.label}
        </span>
      </span>
      <span
        className={cn(
          "ml-3 min-w-5 text-right text-[11px] font-semibold tabular-nums",
          item.isActive ? accent.text : "text-muted-foreground",
        )}
      >
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
  isTasksActive = false,
  folderRevealLabel,
  openInFolderLabel,
  pinnedNotes,
  noteCollections,
  skillCollections,
  onToggleNotesSection,
  onToggleSkillsSection,
  onOpenTasks,
  onSelectNoteCollection,
  onSelectSkillCollection,
  onOpenFile,
  onDeleteFile,
  onDeleteFolder,
  onRemoveFileFromGlyph,
  onTogglePinnedFile,
  onRemoveFolder,
  onRenameFile,
  onRenameFolder,
  onRevealInFinder,
  onToggleFolder,
  onReorderNodes,
  onCreateNote,
  onCreateFolder,
  onCreateNoteInCollection,
  onCreateFolderInCollection,
  onChangeNoteCollectionAccent,
  onChangeNoteCollectionIcon,
}: SidebarProps) => {
  const [nodeToDelete, setNodeToDelete] = useState<SidebarDeleteTarget | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<SidebarDeleteTarget | null>(null);
  const [fileToRemove, setFileToRemove] = useState<SidebarRemoveTarget | null>(null);
  const [folderToRemove, setFolderToRemove] = useState<SidebarRemoveTarget | null>(null);
  const pinnedList = pinnedNotes ?? [];
  const revealLabel = folderRevealLabel ?? openInFolderLabel ?? "Open in Finder";
  const hasActiveSkillCollection = Boolean(skillCollections?.some((item) => item.isActive));
  const pinnedPaths = useMemo(() => pinnedList.map((note) => note.path), [pinnedList]);
  const handleRequestRemoveFolder = useCallback((folder: SidebarRemoveTarget) => {
    setFolderToRemove(folder);
  }, []);
  const handleRequestDeleteFolder = useCallback((folder: SidebarDeleteTarget) => {
    setFolderToDelete(folder);
  }, []);
  const handleRequestDelete = useCallback((node: SidebarDeleteTarget) => {
    setNodeToDelete(node);
  }, []);
  const handleDropNode = useCallback(
    async (sourcePath: string, targetPath: string, position: DragPosition) => {
      if (!sourcePath || sourcePath === targetPath) {
        return;
      }

      await onReorderNodes(sourcePath, targetPath, position);
    },
    [onReorderNodes],
  );

  const handleConfirmDelete = () => {
    if (nodeToDelete) {
      onDeleteFile(nodeToDelete.path);
    }
    setNodeToDelete(null);
  };

  const handleConfirmDeleteFolder = () => {
    if (folderToDelete) {
      onDeleteFolder?.(folderToDelete.path);
    }
    setFolderToDelete(null);
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
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2.5">
        <div className="mb-3 px-3">
          <button
            type="button"
            aria-label="TASKS"
            onClick={onOpenTasks}
            className={`group flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left transition-colors duration-100 ease-out ${
              isTasksActive
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground hover:text-foreground"
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                isTasksActive
                  ? "text-sidebar-foreground"
                  : "text-muted-foreground group-hover:text-foreground"
              }`}
            >
              TASKS
            </p>
          </button>
        </div>

        {skillCollections && skillCollections.length > 0 ? (
          <div className="mb-3">
            <div className="flex items-center justify-between px-4 py-1.5">
              <button
                type="button"
                onClick={onToggleSkillsSection}
                className="flex items-center text-left"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  SKILLS
                </p>
              </button>
              <button
                type="button"
                onClick={onToggleSkillsSection}
                className="p-1 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
                aria-label={isSkillsExpanded ? "Collapse skills" : "Expand skills"}
              >
                <ChevronRightIcon
                  size={12}
                  className={`transition-transform duration-150 ${
                    isSkillsExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            </div>
            {isSkillsExpanded ? (
              <div className="space-y-0.5 px-2">
                {skillCollections.map((item) => (
                  <SidebarSkillCollectionRow
                    key={item.id}
                    item={item}
                    onSelect={onSelectSkillCollection}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between px-4 py-1.5">
            <button type="button" onClick={onToggleNotesSection} className="flex items-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                NOTES
              </p>
            </button>
            <div className="flex items-center gap-0.5">
              {onCreateNote ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onCreateNote}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
                      aria-label="New note"
                    >
                      <PlusIcon size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{`New Note (${getShortcutDisplay(null, "new-note", navigator.platform) ?? "⌘N"})`}</TooltipContent>
                </Tooltip>
              ) : null}
              {onCreateFolder ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onCreateFolder}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
                      aria-label="New folder"
                    >
                      <FolderPlusIcon size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{`New Folder (${getShortcutDisplay(null, "new-folder", navigator.platform) ?? "⇧⌘N"})`}</TooltipContent>
                </Tooltip>
              ) : null}
              <button
                type="button"
                onClick={onToggleNotesSection}
                className="p-1 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
                aria-label={isNotesExpanded ? "Collapse notes" : "Expand notes"}
              >
                <ChevronRightIcon
                  size={12}
                  className={`text-muted-foreground transition-transform duration-150 ${
                    isNotesExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            </div>
          </div>
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
                    onRevealInFinder={onRevealInFinder}
                    revealLabel={revealLabel}
                  />
                </div>
              ) : null}
              <div className="px-2">
                {(noteCollections?.length ?? 0) === 0 && tree.length === 0 && !activePath ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    Create your first note or open the palette to start navigating.
                  </p>
                ) : (
                  <div className="flex flex-col gap-0.5 px-0">
                    {(noteCollections ?? []).map((item) => (
                      <NoteCollectionRow
                        key={item.id}
                        item={{
                          ...item,
                          isActive: !isTasksActive && !hasActiveSkillCollection && item.isActive,
                        }}
                        onSelect={(path) => onSelectNoteCollection?.(path)}
                        onCreateNote={onCreateNoteInCollection}
                        onCreateFolder={onCreateFolderInCollection}
                        onChangeAccent={onChangeNoteCollectionAccent}
                        onChangeIcon={onChangeNoteCollectionIcon}
                        onRevealInFinder={onRevealInFinder}
                        onRenameFolder={onRenameFolder}
                        onRemoveFolder={onRemoveFolder}
                        onDeleteFolder={onDeleteFolder}
                        revealLabel={revealLabel}
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

      {folderToDelete ? (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setFolderToDelete(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Delete Folder</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-foreground">"{folderToDelete.name}"</span> and
                all its contents? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setFolderToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" type="button" onClick={handleConfirmDeleteFolder}>
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
