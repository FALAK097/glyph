import { useEffect, useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";
import { SlashCommand } from "./SlashCommand";

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
  onCreateNote?: () => void;
  toggleSidebarShortcut?: string;
  newNoteShortcut?: string;
  onOpenSettings?: () => void;
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
  isSidebarCollapsed,
  onCreateNote,
  toggleSidebarShortcut,
  newNoteShortcut,
  onOpenSettings
}: MarkdownEditorProps) {
  const lastSyncedMarkdown = useRef(content);
  const toastTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank"
        }
      }),
      Image,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommand,
      Placeholder.configure({
        placeholder: "Start with a title, then let markdown shortcuts shape the page."
      }),
      Markdown.configure({
        linkify: true,
        transformPastedText: true,
        transformCopiedText: true,
        breaks: true
      })
    ],
    enableInputRules: true,
    enablePasteRules: true,
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

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null);

  const showToast = (title: string, description: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ title, description });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyPath = async () => {
    if (filePath) {
      try {
        await navigator.clipboard.writeText(filePath);
        showToast("Path copied to clipboard", "");
      } catch (err) {
        console.error("Failed to copy path:", err);
        showToast("Failed to copy path", "");
      }
    }
  };

  const handleCopy = async () => {
    if (content) {
      try {
        await navigator.clipboard.writeText(content);
        showToast("Copied as Markdown", "");
      } catch (err) {
        console.error("Failed to copy content:", err);
        showToast("Failed to copy content", "");
      }
    }
  };

  const handleOpenExternal = async () => {
    if (filePath && window.typist) {
      try {
        const didReveal = await window.typist.revealInFinder(filePath);
        if (!didReveal) {
          showToast("Could not open in Finder", "");
        }
      } catch (err) {
        console.error("Failed to open in Finder:", err);
        showToast("Could not open in Finder", "");
      }
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
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors mr-1"
              onClick={onToggleSidebar}
               title={isSidebarCollapsed ? `Show Sidebar (${toggleSidebarShortcut ?? "⌘B"})` : `Hide Sidebar (${toggleSidebarShortcut ?? "⌘B"})`}
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
          <div className="flex items-center gap-1 mr-2">
            <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-50" title="Back">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-50" title="Forward">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button 
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" 
              onClick={onCreateNote}
               title={`New Note (${newNoteShortcut ?? "⌘N"})`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            </button>
          </div>
          <div className="min-w-0 max-w-[300px]">
            <span className="text-sm font-medium text-foreground truncate block">
              {fileName?.replace(/\.(md|markdown)$/i, "") ?? "Untitled"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 relative">
          <button 
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" 
            title="More options"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
          {onOpenSettings && (
            <button 
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" 
              title="Settings"
              onClick={onOpenSettings}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></svg>
            </button>
          )}
          
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1 overflow-hidden">
                <button 
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => { handleCopy(); setIsMenuOpen(false); }}
                  disabled={!content}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  Copy as MD
                </button>
                <button 
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => { handleCopyPath(); setIsMenuOpen(false); }}
                  disabled={!filePath}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Copy file path
                </button>
                <button 
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => { handleOpenExternal(); setIsMenuOpen(false); }}
                  disabled={!filePath}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 48 48" className="shrink-0">
                    <path fill="#e1e1e1" d="M40.056 40.98H8.944A3.95 3.95 0 0 1 5 37.036V9.964A3.95 3.95 0 0 1 8.944 6.02h31.112A3.95 3.95 0 0 1 44 9.964v27.072a3.95 3.95 0 0 1-3.944 3.944Z" />
                    <path fill="#e1e1e1" d="M38.992 6.04H26.32a.086.086 0 0 0-.081.056 51.745 51.745 0 0 0-2.399 8.354 49.15 49.15 0 0 0-1.026 8.46c-.002.05.037.09.087.09h3.819c.4 0 .79.17 1.06.47.27.3.4.7.36 1.1-.277 2.908-.28 5.855.02 8.764.005.05.052.088.102.078 2.307-.44 5.265-1.464 8.028-3.783.43-.35 1.06-.29 1.41.13.36.42.3 1.05-.12 1.41-3.138 2.623-6.501 3.757-9.08 4.235-.045.008-.074.051-.067.096.276 1.831.676 3.652 1.18 5.435.01.039.044.065.083.065h9.222A4.084 4.084 0 0 0 43 36.917V10.048a4.008 4.008 0 0 0-4.008-4.008ZM34.15 17.95a1 1 0 0 1-2 0V14.7a1 1 0 1 1 2 0v3.25Z" />
                    <path fill="#00b7f9" d="M32.15 17.95V14.7a1 1 0 1 1 2 0v3.25a1 1 0 1 1-2 0Z" />
                    <path fill="#00b7f9" d="M37.58 31.17c-3.17 2.65-6.57 3.78-9.16 4.25.28 1.88.69 3.75 1.21 5.58H9.003A4.003 4.003 0 0 1 5 36.997V10.053A4.017 4.017 0 0 1 9.013 6.04H26.26a50.1 50.1 0 0 0-2.42 8.41c-.56 2.81-.91 5.68-1.03 8.55h3.91c.4 0 .79.17 1.06.47.27.3.4.7.36 1.1-.28 2.94-.28 5.92.03 8.86 2.32-.43 5.32-1.45 8.12-3.8.43-.35 1.06-.29 1.41.13.36.42.3 1.05-.12 1.41Z" />
                    <path fill="#00a0d1" d="M29.63 41a50.689 50.689 0 0 1-1.21-5.58c-.09-.59-.17-1.19-.23-1.78-.01-.07-.01-.14-.02-.21-.31-2.94-.31-5.92-.03-8.86.04-.4-.09-.8-.36-1.1-.27-.3-.66-.47-1.06-.47h-3.91c.12-2.87.47-5.74 1.03-8.55a50.1 50.1 0 0 1 2.42-8.41c.08-.21.16-.41.24-.62l-1.86-.73c-.17.45-.34.9-.5 1.35a46.49 46.49 0 0 0-2.26 8.02c-.63 3.11-.99 6.29-1.09 9.47-.01.39.13.76.41 1.04.26.27.64.43 1.03.43h3.86c-.24 2.89-.21 5.81.09 8.69.01.05.01.11.02.16.07.61.14 1.22.24 1.82.26 1.8.64 3.58 1.11 5.33.26.95.54 1.88.86 2.81l1.9-.65A39.35 39.35 0 0 1 29.63 41Z" />
                    <path fill="#37474f" d="M37.58 31.17c-3.17 2.65-6.57 3.78-9.16 4.25-.73.13-1.4.21-1.98.25-.56.05-1.04.06-1.41.06-6.41 0-10.91-3.19-12.55-4.56a1.004 1.004 0 1 1 1.28-1.54c1.47 1.24 5.51 4.1 11.27 4.1.31 0 .7-.01 1.15-.04.57-.04 1.24-.12 1.99-.26 2.32-.43 5.32-1.45 8.12-3.8.43-.35 1.06-.29 1.41.13.36.42.3 1.05-.12 1.41Z" />
                    <path fill="#37474f" d="M15.826 18.95a1 1 0 0 1-1-1v-3.248a1 1 0 1 1 2 0v3.248a1 1 0 0 1-1 1Z" />
                    <path fill="#37474f" d="M34.15 14.7v3.25a1 1 0 1 1-2 0V14.7a1 1 0 1 1 2 0Z" />
                  </svg>
                  Open in Finder
                </button>
                <button 
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => { handleExport(); setIsMenuOpen(false); }}
                  disabled={!content}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 12 18 15 15"/><line x1="12" y1="11" x2="12" y2="18"/></svg>
                  Export as PDF
                </button>
              </div>
            </>
          )}
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
      {toast ? (
        <div className="toast-card" role="status" aria-live="polite">
          <div className="toast-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div className="toast-copy">
            <p className="toast-title">{toast.title}</p>
            {toast.description && (
              <p className="toast-description">{toast.description}</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
