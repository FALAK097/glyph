import { useCallback, useMemo } from "react";

import { formatByteSize } from "@/lib/format-byte-size";
import { parseSkillDocument, serializeSkillDocument, type SkillDocument } from "@/shared/skills";

import { MarkdownEditor } from "./markdown-editor";
import { Textarea } from "./ui/textarea";

type SkillDocumentPaneProps = {
  activeDocument: SkillDocument;
  draftContent: string;
  fileLabel: string;
  folderRevealLabel?: string;
  isSidebarCollapsed: boolean;
  saveStateLabel: string;
  commandPaletteShortcut?: string;
  onChange: (value: string) => void;
  onOpenLinkedFile?: (path: string) => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
  showOutline?: boolean;
  toggleSidebarShortcut?: string;
};

export function SkillDocumentPane({
  activeDocument,
  draftContent,
  fileLabel,
  folderRevealLabel,
  isSidebarCollapsed,
  saveStateLabel,
  commandPaletteShortcut,
  onChange,
  onOpenLinkedFile,
  onOpenCommandPalette,
  onOpenSettings,
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
