import { useCallback, useMemo } from "react";

import { formatByteSize } from "@/lib/format-byte-size";
import {
  parseSkillDocument,
  serializeSkillDocument,
  type SkillDocument,
  type SkillDocumentKind,
} from "@/shared/skills";

import { MarkdownEditor } from "./markdown-editor";
import { Button } from "./ui/button";

type SkillDocumentPaneProps = {
  activeDocument: SkillDocument;
  draftContent: string;
  documentTabs: Array<{ kind: SkillDocumentKind; label: string; path: string }>;
  fileLabel: string;
  folderRevealLabel?: string;
  initialScrollTop?: number;
  pendingExternalChange?: {
    name: string;
    path: string;
  } | null;
  isSidebarCollapsed: boolean;
  isSwitchingDocuments?: boolean;
  saveStateLabel: string;
  commandPaletteShortcut?: string;
  onChange: (value: string) => void;
  onKeepMineAfterExternalChange?: () => void;
  onOpenLinkedFile?: (path: string) => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onReloadAfterExternalChange?: () => void;
  onScrollPositionChange?: (scrollTop: number) => void;
  onSelectDocumentTab: (kind: SkillDocumentKind) => void;
  onToggleSidebar?: () => void;
  scrollRestorationKey?: string | null;
  showOutline?: boolean;
  toggleSidebarShortcut?: string;
};

export function SkillDocumentPane({
  activeDocument,
  draftContent,
  documentTabs,
  fileLabel,
  folderRevealLabel,
  initialScrollTop = 0,
  pendingExternalChange,
  isSidebarCollapsed,
  isSwitchingDocuments = false,
  saveStateLabel,
  commandPaletteShortcut,
  onChange,
  onKeepMineAfterExternalChange,
  onOpenLinkedFile,
  onOpenCommandPalette,
  onOpenSettings,
  onReloadAfterExternalChange,
  onScrollPositionChange,
  onSelectDocumentTab,
  onToggleSidebar,
  scrollRestorationKey = null,
  showOutline = true,
  toggleSidebarShortcut,
}: SkillDocumentPaneProps) {
  const parsed = useMemo(() => parseSkillDocument(draftContent), [draftContent]);
  const outlineHeadingCount = useMemo(
    () => parsed.body.split("\n").filter((line) => /^#{1,4}\s+\S/.test(line.trim())).length,
    [parsed.body],
  );
  const fileSizeLabel = useMemo(() => {
    const bytes = new TextEncoder().encode(draftContent).length;
    return formatByteSize(bytes);
  }, [draftContent]);
  const wordCount = useMemo(() => {
    const text = parsed.body.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [parsed.body]);
  const readingTime = Math.max(1, Math.round(wordCount / 200));
  const frontmatterRows = Math.max(2, parsed.frontmatterText?.split("\n").length ?? 0);
  const handleBodyChange = useCallback(
    (nextBody: string) => {
      onChange(
        serializeSkillDocument({
          frontmatterText: parsed.frontmatterText,
          body: nextBody,
        }),
      );
    },
    [onChange, parsed.frontmatterText],
  );
  const handleFrontmatterChange = useCallback(
    (nextFrontmatterText: string) => {
      onChange(
        serializeSkillDocument({
          frontmatterText: nextFrontmatterText,
          body: parsed.body,
        }),
      );
    },
    [onChange, parsed.body],
  );
  const shouldShowOutline =
    showOutline && (outlineHeadingCount >= 2 || (outlineHeadingCount >= 1 && wordCount >= 250));
  const headerAccessory =
    documentTabs.length > 1 ? (
      <div
        role="tablist"
        aria-label="Skill document tabs"
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/35 p-1"
      >
        {documentTabs.map((tab) => {
          const isActive = tab.kind === activeDocument.kind;
          return (
            <Button
              key={tab.kind}
              type="button"
              role="tab"
              aria-selected={isActive}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              disabled={isSwitchingDocuments}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => onSelectDocumentTab(tab.kind)}
            >
              {tab.label}
            </Button>
          );
        })}
      </div>
    ) : null;
  const topContent =
    pendingExternalChange || parsed.frontmatterText ? (
      <div className="space-y-4">
        {pendingExternalChange ? (
          <div className="rounded-xl border border-border/70 bg-muted/45 px-4 py-3 transition-opacity duration-150 ease-out">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">External change detected</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {pendingExternalChange.name} changed on disk while you were editing.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onReloadAfterExternalChange?.();
                  }}
                >
                  Reload
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onKeepMineAfterExternalChange?.();
                  }}
                >
                  Keep mine
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {parsed.frontmatterText ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 font-mono text-[13px] leading-6 text-muted-foreground transition-opacity duration-150 ease-out">
            <div className="text-muted-foreground/70">---</div>
            {activeDocument.isEditable ? (
              <textarea
                aria-label="Skill frontmatter"
                className="mt-1 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-mono text-[13px] leading-6 text-muted-foreground outline-none"
                spellCheck={false}
                rows={frontmatterRows}
                value={parsed.frontmatterText}
                onChange={(event) => handleFrontmatterChange(event.target.value)}
              />
            ) : (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-muted-foreground">
                {parsed.frontmatterText}
              </pre>
            )}
            <div className="mt-1 text-muted-foreground/70">---</div>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <MarkdownEditor
        content={parsed.body}
        fileName={fileLabel}
        filePath={activeDocument.path}
        documentLabel={activeDocument.kind === "agents" ? "agent" : "skill"}
        isEditable={activeDocument.isEditable}
        saveStateLabel={saveStateLabel}
        footerMetaLabel={fileSizeLabel}
        wordCount={wordCount}
        readingTime={readingTime}
        headerAccessory={headerAccessory}
        onChange={handleBodyChange}
        onOpenCommandPalette={onOpenCommandPalette}
        commandPaletteLabel="Search notes and skills"
        commandPaletteShortcut={commandPaletteShortcut}
        onOpenSettings={onOpenSettings}
        onScrollPositionChange={onScrollPositionChange}
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        initialScrollTop={initialScrollTop}
        scrollRestorationKey={scrollRestorationKey}
        toggleSidebarShortcut={toggleSidebarShortcut}
        folderRevealLabel={folderRevealLabel}
        onOpenLinkedFile={onOpenLinkedFile}
        showOutline={shouldShowOutline}
        topContent={topContent}
      />
    </section>
  );
}
