import { useEffect, useRef } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";

type MarkdownEditorProps = {
  content: string;
  fileName: string | null;
  filePath: string | null;
  saveStateLabel: string;
  wordCount: number;
  readingTime: number;
  onChange: (value: string) => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
};

export function MarkdownEditor({
  content,
  fileName,
  filePath,
  saveStateLabel,
  wordCount,
  readingTime,
  onChange,
  onToggleSidebar,
  isSidebarCollapsed
}: MarkdownEditorProps) {
  const lastSyncedMarkdown = useRef(content);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      Placeholder.configure({
        placeholder: "Start with a title, then let markdown shortcuts shape the page."
      }),
      Markdown
    ],
    content: content,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        spellcheck: "true"
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      const nextMarkdown = (nextEditor.storage as any).markdown.getMarkdown() as string;
      lastSyncedMarkdown.current = nextMarkdown;
      onChange(nextMarkdown);
    }
  });

  useEffect(() => {
    if (!editor || content === lastSyncedMarkdown.current) {
      return;
    }

    editor.commands.setContent(content, {
      emitUpdate: false
    });
    lastSyncedMarkdown.current = content;
  }, [content, editor]);

  const handleCopy = async () => {
    if (content) {
      try {
        await navigator.clipboard.writeText(content);
      } catch (err) {
        console.error("Failed to copy content:", err);
      }
    }
  };

  const handleOpenExternal = () => {
    if (filePath && window.typist) {
      // The file is already on disk, we can use shell.openPath if available
      // For now, we'll just show an alert that this feature requires implementation
      console.log("Open external for:", filePath);
    }
  };

  const handleExport = () => {
    // Export to PDF would require additional libraries like html2pdf or jspdf
    // For now, we'll just copy to clipboard as a workaround
    handleCopy();
    alert("Content copied to clipboard. PDF export coming soon!");
  };

  return (
    <section className="editor-shell">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors mr-2"
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isSidebarCollapsed ? (
                  <><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></>
                ) : (
                  <><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></>
                )}
              </svg>
            </button>
          )}
          <div>
            <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
              {fileName?.replace(/\.(md|markdown)$/i, "") ?? "Untitled"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" 
            title="Open in External App"
            onClick={handleOpenExternal}
            disabled={!filePath}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <button 
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" 
            title="Copy Content"
            onClick={handleCopy}
            disabled={!content}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
          <button 
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" 
            title="Export to PDF"
            onClick={handleExport}
            disabled={!content}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      </div>
      <div className="editor-canvas">
        <EditorContent editor={editor} />
      </div>
      <div className="editor-footer">
        <div className="editor-metrics">
          <span>{wordCount} words</span>
          <span>{readingTime} min read</span>
        </div>
        <p className="editor-status">{saveStateLabel}</p>
      </div>
    </section>
  );
}
