import { useCallback } from "react";

import { getShortcutDisplay } from "@/shared/shortcuts";
import type { SkillDocument, SkillDocumentKind, SkillEntry } from "@/shared/skills";
import type { ShortcutSetting } from "@/shared/workspace";

import { SkillDocumentPane } from "./skill-document-pane";
import { SkillEmptyPane } from "./skill-empty-pane";

type SkillViewProps = {
  isSkillSurfaceLoading: boolean;
  isActiveSkillVisible: boolean;
  activeSkillCollection: { label: string } | null;
  activeDocument: SkillDocument | null;
  activeSkill: SkillEntry | null;
  draftContent: string;
  documentTabs: Array<{ kind: SkillDocumentKind; label: string; path: string }>;
  isDocumentLoading: boolean;
  isSaving: boolean;
  pendingExternalChange: { name: string; path: string } | null;
  saveStateLabel: string;
  skillInitialScrollTop: number;
  skillEmptyState: { title: string; description: string };
  isSidebarCollapsed: boolean;
  shortcuts: ShortcutSetting[];
  folderRevealLabel: string;
  showOutline: boolean;
  onSetIsPaletteOpen: (open: boolean) => void;
  onSetIsSettingsOpen: (open: boolean) => void;
  onToggleSidebar: () => void;
  onOpenLinkedFile: (targetPath: string) => void;
  onScrollPositionChange: (targetPath: string | null, scrollTop: number) => void;
  onDraftContentChange: (value: string) => void;
  onKeepMineAfterExternalChange: () => void;
  onReloadAfterExternalChange: () => void;
  onSelectDocumentTab: (kind: SkillDocumentKind) => void;
};

export function SkillView({
  isSkillSurfaceLoading,
  isActiveSkillVisible,
  activeSkillCollection,
  activeDocument,
  activeSkill,
  draftContent,
  documentTabs,
  isDocumentLoading,
  isSaving,
  pendingExternalChange,
  saveStateLabel,
  skillInitialScrollTop,
  skillEmptyState,
  isSidebarCollapsed,
  shortcuts,
  folderRevealLabel,
  showOutline,
  onSetIsPaletteOpen,
  onSetIsSettingsOpen,
  onToggleSidebar,
  onOpenLinkedFile,
  onScrollPositionChange,
  onDraftContentChange,
  onKeepMineAfterExternalChange,
  onReloadAfterExternalChange,
  onSelectDocumentTab,
}: SkillViewProps) {
  const commandPaletteShortcut = getShortcutDisplay(shortcuts, "command-palette") ?? "⌘P";
  const toggleSidebarShortcut = getShortcutDisplay(shortcuts, "toggle-sidebar");

  const handleOpenCommandPalette = useCallback(() => {
    onSetIsPaletteOpen(true);
  }, [onSetIsPaletteOpen]);

  const handleOpenSettings = useCallback(() => {
    onSetIsSettingsOpen(true);
  }, [onSetIsSettingsOpen]);

  if (isSkillSurfaceLoading) {
    return (
      <SkillEmptyPane
        commandPaletteShortcut={commandPaletteShortcut}
        description="Restoring your last skill session and loading the current document."
        isSidebarCollapsed={isSidebarCollapsed}
        onOpenCommandPalette={handleOpenCommandPalette}
        onOpenSettings={handleOpenSettings}
        onToggleSidebar={onToggleSidebar}
        title="Loading skills"
        titleLabel={activeSkillCollection?.label ?? "Skills"}
        toggleSidebarShortcut={toggleSidebarShortcut}
      />
    );
  }

  if (activeDocument && isActiveSkillVisible) {
    return (
      <SkillDocumentPane
        activeDocument={activeDocument}
        draftContent={draftContent}
        documentTabs={documentTabs}
        fileLabel={activeSkill?.name ?? activeDocument.name}
        commandPaletteShortcut={commandPaletteShortcut}
        initialScrollTop={skillInitialScrollTop}
        isSidebarCollapsed={isSidebarCollapsed}
        isSwitchingDocuments={isDocumentLoading || isSaving}
        pendingExternalChange={pendingExternalChange}
        saveStateLabel={saveStateLabel}
        onChange={onDraftContentChange}
        onKeepMineAfterExternalChange={onKeepMineAfterExternalChange}
        showOutline={showOutline}
        toggleSidebarShortcut={toggleSidebarShortcut}
        folderRevealLabel={folderRevealLabel}
        onOpenCommandPalette={handleOpenCommandPalette}
        onOpenLinkedFile={onOpenLinkedFile}
        onOpenSettings={handleOpenSettings}
        onReloadAfterExternalChange={onReloadAfterExternalChange}
        onScrollPositionChange={onScrollPositionChange}
        onSelectDocumentTab={onSelectDocumentTab}
        onToggleSidebar={onToggleSidebar}
        scrollRestorationKey={activeDocument.path}
      />
    );
  }

  return (
    <SkillEmptyPane
      commandPaletteShortcut={commandPaletteShortcut}
      description={skillEmptyState.description}
      isSidebarCollapsed={isSidebarCollapsed}
      onOpenCommandPalette={handleOpenCommandPalette}
      onOpenSettings={handleOpenSettings}
      onToggleSidebar={onToggleSidebar}
      title={skillEmptyState.title}
      titleLabel={activeSkillCollection?.label ?? "Skills"}
      toggleSidebarShortcut={toggleSidebarShortcut}
    />
  );
}
