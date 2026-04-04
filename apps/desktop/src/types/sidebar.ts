import type { SkillSourceKind } from "../shared/skills";
import type { DirectoryNode } from "../shared/workspace";
import type { NoteShortcutItem } from "./navigation";

export type DragPosition = "before" | "after";

export type SidebarTopLevelNode = {
  node: DirectoryNode;
  isExpanded: boolean;
};

export type SidebarSkillCollectionItem = {
  id: string;
  fallbackLabel: string;
  iconKind?: "all-agents" | "all-skills" | "global" | "project";
  sourceKind?: SkillSourceKind;
  label: string;
  count: number;
  isActive: boolean;
};

export type SidebarProps = {
  tree: SidebarTopLevelNode[];
  activePath: string | null;
  isCollapsed: boolean;
  isNotesExpanded?: boolean;
  isSkillsExpanded?: boolean;
  pinnedNotes?: NoteShortcutItem[];
  folderRevealLabel?: string;
  openInFolderLabel?: string;
  skillCollections?: SidebarSkillCollectionItem[];
  onToggleNotesSection?: () => void;
  onToggleSkillsSection?: () => void;
  onSelectSkillCollection?: (collectionId: string) => void;
  onOpenCommandPalette?: () => void;
  onOpenFile: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRemoveFileFromGlyph?: (filePath: string) => void;
  onRemoveFolder: (folderPath: string) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
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
  onOpenFile: (filePath: string) => void;
  onRequestRemoveFolder: (folder: SidebarRemoveTarget) => void;
  onRequestRemoveFile?: (file: SidebarRemoveTarget) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onRequestDelete: (node: SidebarDeleteTarget) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onToggleFolder: (folderPath: string) => void;
  draggable?: boolean;
  onDragStartTopLevel?: (sourcePath: string) => void;
  onDropNode?: (targetPath: string, position: DragPosition) => void;
};
