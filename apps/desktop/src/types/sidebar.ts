import type { DirectoryNode } from "../shared/workspace";
import type { NoteShortcutItem } from "./navigation";

export type DragPosition = "before" | "after";

export type SidebarTopLevelNode = {
  node: DirectoryNode;
  isExpanded: boolean;
};

export type SidebarProps = {
  tree: SidebarTopLevelNode[];
  activePath: string | null;
  isCollapsed: boolean;
  pinnedNotes?: NoteShortcutItem[];
  favoriteNotes?: NoteShortcutItem[];
  recentNotes?: NoteShortcutItem[];
  folderRevealLabel?: string;
  openInFolderLabel?: string;
  onCreateNote?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenFile: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRemoveFolder: (folderPath: string) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onToggleFavoriteFile?: (filePath: string) => void;
  onToggleFolder: (folderPath: string) => void;
  onReorderNodes: (sourcePath: string, targetPath: string, position: DragPosition) => void;
};

export type SidebarTreeNodeMenuCoords = {
  top: number;
  left: number;
};

export type SidebarDeleteTarget = {
  path: string;
  name: string;
};

export type SidebarRemoveTarget = {
  path: string;
  name: string;
};

export type SidebarTreeNodeProps = {
  node: DirectoryNode;
  activePath: string | null;
  depth: number;
  isExpanded?: boolean;
  folderRevealLabel?: string;
  pinnedPaths?: string[];
  favoritePaths?: string[];
  onOpenFile: (filePath: string) => void;
  onRequestRemoveFolder: (folder: SidebarRemoveTarget) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onToggleFavoriteFile?: (filePath: string) => void;
  onRequestDelete: (node: SidebarDeleteTarget) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onToggleFolder: (folderPath: string) => void;
  draggable?: boolean;
  onDragStartTopLevel?: (sourcePath: string) => void;
  onDropNode?: (targetPath: string, position: DragPosition) => void;
};
