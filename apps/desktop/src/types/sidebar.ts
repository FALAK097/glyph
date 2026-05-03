import type { SkillSourceKind } from "@/core/skills";
import type { NoteCollectionItem } from "@/core/note-collections";
import type {
  DirectoryNode,
  NoteCollectionAccentKey,
  NoteCollectionIconKey,
} from "@/core/workspace";
import type { NoteShortcutItem } from "./navigation";

export type DragPosition = "before" | "after" | "inside";

export type SidebarTopLevelNode = {
  node: DirectoryNode;
  isExpanded: boolean;
};

export type SidebarSkillCollectionItem = {
  id: string;
  fallbackLabel: string;
  group: "scope" | "tool";
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
  isTasksActive?: boolean;
  pinnedNotes?: NoteShortcutItem[];
  noteCollections?: NoteCollectionItem[];
  folderRevealLabel?: string;
  openInFolderLabel?: string;
  skillCollections?: SidebarSkillCollectionItem[];
  onToggleNotesSection?: () => void;
  onToggleSkillsSection?: () => void;
  onOpenTasks?: () => void;
  onSelectNoteCollection?: (collectionPath: string) => void;
  onSelectSkillCollection?: (collectionId: string) => void;
  onOpenCommandPalette?: () => void;
  onOpenFile: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onRemoveFileFromGlyph?: (filePath: string) => void;
  onRemoveFolder: (folderPath: string) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onRenameFolder?: (folderPath: string, newName: string) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onToggleFolder: (folderPath: string) => void;
  onReorderNodes: (
    sourcePath: string,
    targetPath: string,
    position: DragPosition,
  ) => void | Promise<void>;
  onCreateNote?: () => void;
  onCreateFolder?: () => void;
  onCreateNoteInCollection?: (collectionPath: string) => void;
  onCreateFolderInCollection?: (collectionPath: string) => void;
  onChangeNoteCollectionAccent?: (collectionPath: string, accent: NoteCollectionAccentKey) => void;
  onChangeNoteCollectionIcon?: (collectionPath: string, icon: NoteCollectionIconKey) => void;
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
  onRequestDeleteFolder?: (folder: SidebarDeleteTarget) => void;
  onRequestRemoveFile?: (file: SidebarRemoveTarget) => void;
  onRevealInFinder: (targetPath: string) => void;
  onTogglePinnedFile?: (filePath: string) => void;
  onRequestDelete: (node: SidebarDeleteTarget) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onRenameFolder?: (folderPath: string, newName: string) => void;
  onToggleFolder: (folderPath: string) => void;
  draggable?: boolean;
  onDragStartTopLevel?: (sourcePath: string) => void;
  onDropNode?: (
    sourcePath: string,
    targetPath: string,
    position: DragPosition,
  ) => void | Promise<void>;
};
