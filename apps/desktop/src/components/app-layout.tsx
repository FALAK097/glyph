import type { NoteShortcutItem } from "@/types/navigation";
import type {
  DragPosition,
  SidebarSkillCollectionItem,
  SidebarTopLevelNode,
} from "@/types/sidebar";

import { Sidebar } from "./sidebar";

type AppLayoutProps = {
  shouldCollapseSidebar: boolean;
  tree: SidebarTopLevelNode[];
  activePath: string | null;
  isSidebarCollapsed: boolean;
  isNotesExpanded: boolean;
  isSkillsExpanded: boolean;
  openInFolderLabel: string;
  pinnedNotes: NoteShortcutItem[];
  skillCollections: SidebarSkillCollectionItem[];
  onToggleNotesSection: () => void;
  onToggleSkillsSection: () => void;
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
  children: React.ReactNode;
};

export function AppLayout({
  shouldCollapseSidebar,
  tree,
  activePath,
  isSidebarCollapsed,
  isNotesExpanded,
  isSkillsExpanded,
  openInFolderLabel,
  pinnedNotes,
  skillCollections,
  onToggleNotesSection,
  onToggleSkillsSection,
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
  children,
}: AppLayoutProps) {
  return (
    <div
      className={`grid h-screen min-h-0 overflow-hidden transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none ${
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
          openInFolderLabel={openInFolderLabel}
          pinnedNotes={pinnedNotes}
          skillCollections={skillCollections}
          onToggleNotesSection={onToggleNotesSection}
          onToggleSkillsSection={onToggleSkillsSection}
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
        />
      )}

      <main
        id="main-content"
        className="relative h-full min-h-0 overflow-hidden bg-background"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
