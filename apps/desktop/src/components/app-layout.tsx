import type { NoteCollectionItem } from "@/core/note-collections";
import type { NoteCollectionAccentKey, NoteCollectionIconKey, ThemeMode } from "@/core/workspace";
import type { NoteShortcutItem } from "@/types/navigation";
import type {
  DragPosition,
  SidebarSkillCollectionItem,
  SidebarTopLevelNode,
} from "@/types/sidebar";

import { Sidebar } from "./sidebar/sidebar";
import { AppFooter } from "./app-footer";

type AppLayoutProps = {
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  shouldCollapseSidebar: boolean;
  tree: SidebarTopLevelNode[];
  activePath: string | null;
  isSidebarCollapsed: boolean;
  isNotesExpanded: boolean;
  isSkillsExpanded: boolean;
  isTasksActive: boolean;
  openInFolderLabel: string;
  pinnedNotes: NoteShortcutItem[];
  noteCollections: NoteCollectionItem[];
  skillCollections: SidebarSkillCollectionItem[];
  onToggleNotesSection: () => void;
  onToggleSkillsSection: () => void;
  onOpenTasks: () => void;
  onSelectNoteCollection: (collectionPath: string) => void;
  onSelectSkillCollection: (collectionId: string) => void;
  onOpenFile: (filePath: string) => void;
  onOpenCommandPalette: () => void;
  onDeleteFile: (filePath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onRemoveFileFromGlyph: (filePath: string) => void;
  onTogglePinnedFile: (filePath: string) => void;
  onRemoveFolder: (folderPath: string) => void;
  onRenameFile: (filePath: string, newName: string) => void;
  onRenameFolder?: (folderPath: string, newName: string) => void;
  onRevealInFinder: (targetPath: string) => void;
  onToggleFolder: (folderPath: string) => void;
  onReorderNodes: (sourcePath: string, targetPath: string, position: DragPosition) => void;
  onCreateNote?: () => void;
  onCreateFolder?: () => void;
  onCreateNoteInCollection?: (collectionPath: string) => void;
  onCreateFolderInCollection?: (collectionPath: string) => void;
  onChangeNoteCollectionAccent?: (collectionPath: string, accent: NoteCollectionAccentKey) => void;
  onChangeNoteCollectionIcon?: (collectionPath: string, icon: NoteCollectionIconKey) => void;
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
  children: React.ReactNode;
};

export function AppLayout({
  toolbar,
  footer,
  shouldCollapseSidebar,
  tree,
  activePath,
  isSidebarCollapsed,
  isNotesExpanded,
  isSkillsExpanded,
  isTasksActive,
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
  onOpenCommandPalette,
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
  themeMode,
  onChangeTheme,
  children,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {toolbar ? <div className="shrink-0 bg-sidebar">{toolbar}</div> : null}
      <div
        className={`grid flex-1 min-h-0 overflow-hidden transition-[grid-template-columns] duration-200 ${
          shouldCollapseSidebar ? "grid-cols-[0_minmax(0,1fr)]" : "grid-cols-[280px_minmax(0,1fr)]"
        }`}
      >
        {shouldCollapseSidebar ? (
          <div aria-hidden="true" className="w-0 min-w-0 overflow-hidden" />
        ) : (
          <Sidebar
            tree={tree}
            activePath={activePath}
            isCollapsed={isSidebarCollapsed}
            isNotesExpanded={isNotesExpanded}
            isSkillsExpanded={isSkillsExpanded}
            isTasksActive={isTasksActive}
            openInFolderLabel={openInFolderLabel}
            pinnedNotes={pinnedNotes}
            noteCollections={noteCollections}
            skillCollections={skillCollections}
            onToggleNotesSection={onToggleNotesSection}
            onToggleSkillsSection={onToggleSkillsSection}
            onOpenTasks={onOpenTasks}
            onSelectNoteCollection={onSelectNoteCollection}
            onSelectSkillCollection={onSelectSkillCollection}
            onOpenFile={onOpenFile}
            onOpenCommandPalette={onOpenCommandPalette}
            onDeleteFile={onDeleteFile}
            onDeleteFolder={onDeleteFolder}
            onRemoveFileFromGlyph={onRemoveFileFromGlyph}
            onTogglePinnedFile={onTogglePinnedFile}
            onRemoveFolder={onRemoveFolder}
            onRenameFile={onRenameFile}
            onRenameFolder={onRenameFolder}
            onRevealInFinder={onRevealInFinder}
            onToggleFolder={onToggleFolder}
            onReorderNodes={onReorderNodes}
            onCreateNote={onCreateNote}
            onCreateFolder={onCreateFolder}
            onCreateNoteInCollection={onCreateNoteInCollection}
            onCreateFolderInCollection={onCreateFolderInCollection}
            onChangeNoteCollectionAccent={onChangeNoteCollectionAccent}
            onChangeNoteCollectionIcon={onChangeNoteCollectionIcon}
          />
        )}

        <main className="relative flex-1 min-h-0 overflow-hidden bg-background">{children}</main>
      </div>
      {footer ? (
        <AppFooter content={footer} themeMode={themeMode} onChangeTheme={onChangeTheme} />
      ) : null}
    </div>
  );
}
