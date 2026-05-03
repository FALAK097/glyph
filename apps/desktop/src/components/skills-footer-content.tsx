import { useMemo } from "react";
import { calculateDocumentMetrics } from "@/core/document-metrics";
import { FooterStats } from "./footer-stats";

type SkillsFooterContentProps = {
  draftContent: string;
  saveStateLabel: string;
};

export function SkillsFooterContent({ draftContent, saveStateLabel }: SkillsFooterContentProps) {
  const metrics = useMemo(() => calculateDocumentMetrics(draftContent), [draftContent]);

  return (
    <FooterStats
      wordCount={metrics.words}
      readingTime={metrics.readTime}
      fileSize={metrics.fileSize}
      saveState={saveStateLabel}
    />
  );
}
