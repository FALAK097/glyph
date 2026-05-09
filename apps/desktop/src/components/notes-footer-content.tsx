import { useMemo } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useLayoutStore } from "@/store/layout";
import { formatSaveTime } from "@/core/format-time";
import { calculateDocumentMetrics } from "@/core/document-metrics";
import { FooterStats } from "./footer-stats";

type NotesFooterContentProps = {
  draftContent: string;
};

export function NotesFooterContent({ draftContent }: NotesFooterContentProps) {
  const noteTabs = useWorkspaceStore((s) => s.noteTabs);
  const activePaneId = useLayoutStore((s) => s.activePaneId);
  const paneState = useLayoutStore((s) => s.panes[activePaneId ?? ""]);
  const activeTabId = paneState?.activeTabId ?? null;
  const activeTab = useMemo(
    () => noteTabs.find((tab) => tab.id === activeTabId) ?? null,
    [noteTabs, activeTabId],
  );

  const metrics = useMemo(() => calculateDocumentMetrics(draftContent), [draftContent]);

  const saveState = useMemo(() => {
    if (!activeTab) return undefined;
    if (activeTab.isSaving) return "Saving...";
    if (activeTab.isDirty) return "Unsaved";
    return formatSaveTime(activeTab.lastSavedAt);
  }, [activeTab]);

  return (
    <FooterStats
      wordCount={metrics.words}
      readingTime={metrics.readTime}
      fileSize={metrics.fileSize}
      saveState={saveState}
    />
  );
}
