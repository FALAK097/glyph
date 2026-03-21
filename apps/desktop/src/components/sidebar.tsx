import { useMemo, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

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
import { normalizePath } from "@/lib/paths";

import type { NoteShortcutItem } from "@/types/navigation";
import type { SidebarDeleteTarget, SidebarProps, SidebarRemoveTarget } from "../types/sidebar";

import { LogoComponent } from "./logo-component";
import {
  CheckCircleIcon,
  FileIcon,
  MoreVerticalIcon,
  PlusIcon,
  RevealInFolderIcon,
  SearchIcon,
} from "./icons";
import { SidebarTreeNode } from "./sidebar-tree-node";

const SidebarSection = ({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) => (
  <section className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-sidebar/65 shadow-sm">
    <div className="flex items-center justify-between border-b border-sidebar-border/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      {typeof count === "number" ? (
        <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
    <div className="p-2">{children}</div>
  </section>
);

const normalizePathKey = (path: string) => normalizePath(path).toLowerCase();

const SidebarShortcutRow = ({
  activePath,
  item,
  isPinned,
  isFavorite,
  folderRevealLabel,
  onOpenFile,
  onRevealInFinder,
  onTogglePinnedFile,
  onToggleFavoriteFile,
}: {
  activePath: string | null;
  item: NoteShortcutItem;
  isPinned: boolean;
  isFavorite: boolean;
  folderRevealLabel: string;
  onOpenFile: (filePath: string) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onToggleFavoriteFile?: (filePath: string) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const isActive = normalizePathKey(activePath ?? "") === normalizePathKey(item.path);
  const pinLabel = isPinned ? "Unpin note" : "Pin note";
  const favoriteLabel = isFavorite ? "Remove from favorites" : "Add to favorites";

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!showMenu) {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuCoords({ top: rect.bottom + 4, left: rect.right + 4 });
    }

    setShowMenu((value) => !value);
  };

  return (
    <div
      className={`group/shortcut relative mb-1 flex items-center overflow-hidden rounded-xl border border-transparent transition-all duration-150 ease-out ${
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-accent/30"
          : "text-sidebar-foreground hover:border-sidebar-accent/20 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto min-w-0 flex-1 justify-start gap-2 rounded-none bg-transparent px-2.5 py-2 text-left hover:!bg-transparent"
        onClick={() => onOpenFile(item.path)}
      >
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          <FileIcon
            size={12}
            className={`transition-colors ${
              isActive
                ? "text-sidebar-accent-foreground/70"
                : "group-hover/shortcut:text-sidebar-accent-foreground/70"
            }`}
          />
          {isActive ? (
            <span className="absolute -left-3 h-5 w-1 rounded-full bg-sidebar-accent-foreground/80" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.title}</span>
          <span
            className={`block truncate text-[11px] ${
              isActive ? "text-sidebar-accent-foreground/65" : "text-muted-foreground"
            }`}
          >
            {item.subtitle}
          </span>
        </span>
        {item.badge ? (
          <span className="ml-2 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {item.badge}
          </span>
        ) : null}
        {isPinned ? (
          <span className="ml-1 rounded-full border border-sidebar-accent/30 bg-sidebar-accent/60 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent-foreground">
            Pinned
          </span>
        ) : null}
        {isFavorite ? (
          <span className="ml-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Fav
          </span>
        ) : null}
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="pointer-events-none mr-1 rounded bg-transparent text-muted-foreground opacity-0 transition-opacity group-hover/shortcut:pointer-events-auto group-hover/shortcut:opacity-100 hover:text-foreground hover:!bg-transparent focus-visible:opacity-100 focus-visible:!bg-transparent"
            onClick={openMenu}
          >
            <MoreVerticalIcon size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Note actions</TooltipContent>
      </Tooltip>

      {showMenu && menuCoords ? (
        <>
          <button
            aria-label="Close note actions"
            className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
            onClick={(event) => {
              event.stopPropagation();
              setShowMenu(false);
            }}
            type="button"
            tabIndex={-1}
          />
          <div
            className="fixed z-50 w-[176px] rounded-md border border-border bg-popover py-1 shadow-lg"
            style={{ top: menuCoords.top, left: menuCoords.left }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
              onClick={(event) => {
                event.stopPropagation();
                onOpenFile(item.path);
                setShowMenu(false);
              }}
              type="button"
            >
              <FileIcon size={14} className="opacity-70" />
              Open
            </Button>
            {onTogglePinnedFile ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePinnedFile(item.path);
                  setShowMenu(false);
                }}
                type="button"
              >
                <PlusIcon size={14} className="opacity-70" />
                {pinLabel}
              </Button>
            ) : null}
            {onToggleFavoriteFile ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavoriteFile(item.path);
                  setShowMenu(false);
                }}
                type="button"
              >
                <CheckCircleIcon size={14} className="opacity-70" />
                {favoriteLabel}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm"
              onClick={(event) => {
                event.stopPropagation();
                onRevealInFinder(item.path);
                setShowMenu(false);
              }}
              type="button"
            >
              <RevealInFolderIcon size={14} className="opacity-70" />
              {folderRevealLabel}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};

const SidebarShortcutList = ({
  activePath,
  items,
  emptyLabel,
  folderRevealLabel,
  onOpenFile,
  onRevealInFinder,
  onTogglePinnedFile,
  onToggleFavoriteFile,
  pinnedPaths,
  favoritePaths,
}: {
  activePath: string | null;
  items: NoteShortcutItem[];
  emptyLabel: string;
  folderRevealLabel: string;
  onOpenFile: (filePath: string) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onToggleFavoriteFile?: (filePath: string) => void;
  pinnedPaths: string[];
  favoritePaths: string[];
}) => {
  if (items.length === 0) {
    return <p className="px-2 text-xs leading-5 text-muted-foreground">{emptyLabel}</p>;
  }

  const pinnedSet = new Set(pinnedPaths.map(normalizePathKey));
  const favoriteSet = new Set(favoritePaths.map(normalizePathKey));

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const itemPathKey = normalizePathKey(item.path);

        return (
          <SidebarShortcutRow
            key={item.path}
            activePath={activePath}
            item={item}
            isFavorite={favoriteSet.has(itemPathKey)}
            isPinned={pinnedSet.has(itemPathKey)}
            folderRevealLabel={folderRevealLabel}
            onOpenFile={onOpenFile}
            onRevealInFinder={onRevealInFinder}
            onToggleFavoriteFile={onToggleFavoriteFile}
            onTogglePinnedFile={onTogglePinnedFile}
          />
        );
      })}
    </div>
  );
};

export const Sidebar = ({
  tree,
  activePath,
  isCollapsed,
  favoriteNotes,
  folderRevealLabel,
  openInFolderLabel,
  pinnedNotes,
  recentNotes,
  onCreateNote,
  onOpenCommandPalette,
  onOpenFile,
  onDeleteFile,
  onToggleFavoriteFile,
  onTogglePinnedFile,
  onRemoveFolder,
  onRenameFile,
  onRevealInFinder,
  onToggleFolder,
  onReorderNodes,
}: SidebarProps) => {
  const [nodeToDelete, setNodeToDelete] = useState<SidebarDeleteTarget | null>(null);
  const [folderToRemove, setFolderToRemove] = useState<SidebarRemoveTarget | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const pinnedList = pinnedNotes ?? [];
  const favoriteList = favoriteNotes ?? [];
  const recentList = recentNotes ?? [];
  const revealLabel = folderRevealLabel ?? openInFolderLabel ?? "Open in Finder";
  const pinnedPaths = useMemo(() => pinnedList.map((note) => note.path), [pinnedList]);
  const favoritePaths = useMemo(() => favoriteList.map((note) => note.path), [favoriteList]);
  const workspaceCount = tree.length;

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
    <aside className="flex h-full w-[280px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border/80 px-3 pt-3 pb-2">
        <div
          className="mb-3 flex items-center justify-center rounded-2xl border border-sidebar-border/70 bg-card/40 px-3 py-3"
          style={{ WebkitAppRegion: "drag" } as CSSProperties}
        >
          <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
            <LogoComponent size={108} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            className="justify-center gap-2 rounded-xl"
            onClick={onCreateNote}
            disabled={!onCreateNote}
          >
            <PlusIcon size={14} />
            New
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-center gap-2 rounded-xl"
            onClick={onOpenCommandPalette}
            disabled={!onOpenCommandPalette}
          >
            <SearchIcon size={14} />
            Search
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-4">
          <SidebarSection title="Pinned" count={pinnedList.length}>
            <SidebarShortcutList
              activePath={activePath}
              items={pinnedList}
              emptyLabel="Pin your key notes to keep them one click away."
              onOpenFile={onOpenFile}
              folderRevealLabel={revealLabel}
              onRevealInFinder={onRevealInFinder}
              onTogglePinnedFile={onTogglePinnedFile}
              onToggleFavoriteFile={onToggleFavoriteFile}
              pinnedPaths={pinnedPaths}
              favoritePaths={favoritePaths}
            />
          </SidebarSection>

          <SidebarSection title="Favorites" count={favoriteList.length}>
            <SidebarShortcutList
              activePath={activePath}
              items={favoriteList}
              emptyLabel="Favorites are great for notes you revisit often."
              onOpenFile={onOpenFile}
              folderRevealLabel={revealLabel}
              onRevealInFinder={onRevealInFinder}
              onTogglePinnedFile={onTogglePinnedFile}
              onToggleFavoriteFile={onToggleFavoriteFile}
              pinnedPaths={pinnedPaths}
              favoritePaths={favoritePaths}
            />
          </SidebarSection>

          <SidebarSection title="Recent" count={recentList.length}>
            <SidebarShortcutList
              activePath={activePath}
              items={recentList.slice(0, 6)}
              emptyLabel="Recent notes will appear here as you move around."
              onOpenFile={onOpenFile}
              folderRevealLabel={revealLabel}
              onRevealInFinder={onRevealInFinder}
              onTogglePinnedFile={onTogglePinnedFile}
              onToggleFavoriteFile={onToggleFavoriteFile}
              pinnedPaths={pinnedPaths}
              favoritePaths={favoritePaths}
            />
          </SidebarSection>

          <SidebarSection title="Workspace" count={workspaceCount}>
            {tree.length === 0 && !activePath ? (
              <p className="px-2 text-sm text-muted-foreground">
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
                    favoritePaths={favoritePaths}
                    folderRevealLabel={revealLabel}
                    isExpanded={entry.isExpanded}
                    pinnedPaths={pinnedPaths}
                    onOpenFile={onOpenFile}
                    onRequestRemoveFolder={(folder) => setFolderToRemove(folder)}
                    onRevealInFinder={onRevealInFinder}
                    onRequestDelete={(node) => setNodeToDelete(node)}
                    onRenameFile={onRenameFile}
                    onToggleFavoriteFile={onToggleFavoriteFile}
                    onToggleFolder={onToggleFolder}
                    onTogglePinnedFile={onTogglePinnedFile}
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
                ))}
              </div>
            )}
          </SidebarSection>
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
    </aside>
  );
};
