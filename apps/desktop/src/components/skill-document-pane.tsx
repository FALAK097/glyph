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
import { Textarea } from "./ui/textarea";

type SkillDocumentPaneProps = {
  activeDocument: SkillDocument;
  draftContent: string;
  documentTabs: Array<{ kind: SkillDocumentKind; label: string; path: string }>;
  fileLabel: string;
  folderRevealLabel?: string;
  pendingExternalChange?: {
    name: string;
    path: string;
  } | null;
  isSidebarCollapsed: boolean;
  saveStateLabel: string;
  commandPaletteShortcut?: string;
  onChange: (value: string) => void;
  onKeepMineAfterExternalChange?: () => void;
  onOpenLinkedFile?: (path: string) => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onReloadAfterExternalChange?: () => void;
  onSelectDocumentTab: (kind: SkillDocumentKind) => void;
  onToggleSidebar?: () => void;
  showOutline?: boolean;
  toggleSidebarShortcut?: string;
};

export function SkillDocumentPane({
  activeDocument,
  draftContent,
  documentTabs,
  fileLabel,
  folderRevealLabel,
  pendingExternalChange,
  isSidebarCollapsed,
  saveStateLabel,
  commandPaletteShortcut,
  onChange,
  onKeepMineAfterExternalChange,
  onOpenLinkedFile,
  onOpenCommandPalette,
  onOpenSettings,
  onReloadAfterExternalChange,
  onSelectDocumentTab,
  onToggleSidebar,
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

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {activeDocument.kind === "agents" ? "Agent document" : "Skill document"}
            </p>
            <p className="truncate text-sm text-muted-foreground">{fileLabel}</p>
          </div>

          {documentTabs.length > 0 ? (
            <div
              role="tablist"
              aria-label="Skill document tabs"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-muted/30 p-1"
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
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => onSelectDocumentTab(tab.kind)}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>

        {pendingExternalChange ? (
          <div className="mt-3 rounded-xl border border-border/70 bg-muted/50 p-3">
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
      </div>

      <div className="min-h-0 flex-1">
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
          onChange={handleBodyChange}
          onOpenCommandPalette={onOpenCommandPalette}
          commandPaletteLabel="Search notes and skills"
          commandPaletteShortcut={commandPaletteShortcut}
          onOpenSettings={onOpenSettings}
          onToggleSidebar={onToggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          toggleSidebarShortcut={toggleSidebarShortcut}
          folderRevealLabel={folderRevealLabel}
          onOpenLinkedFile={onOpenLinkedFile}
          showOutline={shouldShowOutline}
          topContent={
            parsed.frontmatterText ? (
              <div className="border-l-2 border-border/60 pl-4">
                <pre className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-6 text-muted-foreground">
                  ---
                </pre>
                {activeDocument.isEditable ? (
                  <Textarea
                    aria-label="Skill frontmatter"
                    className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 font-mono text-[13px] leading-6 text-muted-foreground shadow-none focus-visible:ring-0"
                    spellCheck={false}
                    value={parsed.frontmatterText}
                    onChange={(event) => handleFrontmatterChange(event.target.value)}
                  />
                ) : (
                  <pre className="m-0 overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-muted-foreground">
                    {parsed.frontmatterText}
                  </pre>
                )}
                <pre className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-6 text-muted-foreground">
                  ---
                </pre>
              </div>
            ) : null
          }
        />
      </div>
    </section>
  );
}
