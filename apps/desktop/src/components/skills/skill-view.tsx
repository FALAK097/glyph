import type { SkillDocument, SkillDocumentKind, SkillEntry } from "@/core/skills";

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
  folderRevealLabel: string;
  showOutline: boolean;
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
  folderRevealLabel,
  showOutline,
  onOpenLinkedFile,
  onScrollPositionChange,
  onDraftContentChange,
  onKeepMineAfterExternalChange,
  onReloadAfterExternalChange,
  onSelectDocumentTab,
}: SkillViewProps) {
  if (isSkillSurfaceLoading) {
    return (
      <SkillEmptyPane
        description="Restoring your last skill session and loading the current document."
        title="Loading skills"
        titleLabel={activeSkillCollection?.label ?? "Skills"}
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
        initialScrollTop={skillInitialScrollTop}
        isSwitchingDocuments={isDocumentLoading || isSaving}
        pendingExternalChange={pendingExternalChange}
        saveStateLabel={saveStateLabel}
        onChange={onDraftContentChange}
        onKeepMineAfterExternalChange={onKeepMineAfterExternalChange}
        showOutline={showOutline}
        folderRevealLabel={folderRevealLabel}
        onOpenLinkedFile={onOpenLinkedFile}
        onReloadAfterExternalChange={onReloadAfterExternalChange}
        onScrollPositionChange={onScrollPositionChange}
        onSelectDocumentTab={onSelectDocumentTab}
        scrollRestorationKey={activeDocument.path}
      />
    );
  }

  return (
    <SkillEmptyPane
      description={skillEmptyState.description}
      title={skillEmptyState.title}
      titleLabel={activeSkillCollection?.label ?? "Skills"}
    />
  );
}
