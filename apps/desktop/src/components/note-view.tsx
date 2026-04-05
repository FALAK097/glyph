import { useCallback } from "react";

import { getShortcutDisplay } from "@/shared/shortcuts";
import type { ShortcutSetting } from "@/shared/workspace";
import type { OutlineItem } from "@/types/navigation";
import type { UpdateState } from "@/shared/workspace";
import type { EditorFocusRequest } from "@/types/markdown-editor";

import { MarkdownEditor } from "./markdown-editor";

type NoteViewProps = {
  content: string;
  fileName: string | null;
  filePath: string | null;
  editorFocusRequest: EditorFocusRequest | null;
  initialScrollTop: number;
  saveStateLabel: string;
  footerMetaLabel: string;
  wordCount: number;
  readingTime: number;
  isSidebarCollapsed: boolean;
  shortcuts: ShortcutSetting[];
  canGoBack: boolean;
  canGoForward: boolean;
  autoOpenPDFSetting: boolean;
  folderRevealLabel: string;
  isActiveFilePinned: boolean;
  isFocusMode: boolean;
  showOutline: boolean;
  outlineItems: OutlineItem[];
  outlineJumpRequest: { id: string; nonce: number } | null;
  updateState: UpdateState | null;
  onContentChange: (value: string) => void;
  onToggleSidebar: () => void;
  onCreateNote: () => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  onOpenLinkedFile: (path: string) => void;
  onScrollPositionChange: (targetPath: string | null, scrollTop: number) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onDeleteNote: (() => void) | undefined;
  onOpenNewWindow: (() => void) | undefined;
  onOutlineJumpHandled: () => void;
  onToggleFocusMode: () => void;
  onTogglePinnedFile: (() => void) | undefined;
  onUpdateAction: () => void;
};

export function NoteView({
  content,
  fileName,
  filePath,
  editorFocusRequest,
  initialScrollTop,
  saveStateLabel,
  footerMetaLabel,
  wordCount,
  readingTime,
  isSidebarCollapsed,
  shortcuts,
  canGoBack,
  canGoForward,
  autoOpenPDFSetting,
  folderRevealLabel,
  isActiveFilePinned,
  isFocusMode,
  showOutline,
  outlineItems,
  outlineJumpRequest,
  updateState,
  onContentChange,
  onToggleSidebar,
  onCreateNote,
  onOpenSettings,
  onOpenCommandPalette,
  onOpenLinkedFile,
  onScrollPositionChange,
  onNavigateBack,
  onNavigateForward,
  onDeleteNote,
  onOpenNewWindow,
  onOutlineJumpHandled,
  onToggleFocusMode,
  onTogglePinnedFile,
  onUpdateAction,
}: NoteViewProps) {
  const handleOpenCommandPalette = useCallback(() => {
    onOpenCommandPalette();
  }, [onOpenCommandPalette]);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings();
  }, [onOpenSettings]);

  return (
    <MarkdownEditor
      content={content}
      fileName={fileName}
      filePath={filePath}
      editorFocusRequest={editorFocusRequest}
      initialScrollTop={initialScrollTop}
      saveStateLabel={saveStateLabel}
      footerMetaLabel={footerMetaLabel}
      wordCount={wordCount}
      readingTime={readingTime}
      onChange={onContentChange}
      onToggleSidebar={onToggleSidebar}
      isSidebarCollapsed={isSidebarCollapsed}
      onCreateNote={onCreateNote}
      toggleSidebarShortcut={getShortcutDisplay(shortcuts, "toggle-sidebar")}
      newNoteShortcut={getShortcutDisplay(shortcuts, "new-note")}
      onOpenSettings={handleOpenSettings}
      onOpenCommandPalette={handleOpenCommandPalette}
      commandPaletteLabel="Search notes and skills"
      onOpenLinkedFile={onOpenLinkedFile}
      commandPaletteShortcut={getShortcutDisplay(shortcuts, "command-palette") ?? "⌘P"}
      onScrollPositionChange={onScrollPositionChange}
      onNavigateBack={onNavigateBack}
      onNavigateForward={onNavigateForward}
      navigateBackShortcut={getShortcutDisplay(shortcuts, "navigate-back")}
      navigateForwardShortcut={getShortcutDisplay(shortcuts, "navigate-forward")}
      focusModeShortcut={getShortcutDisplay(shortcuts, "focus-mode")}
      onDeleteNote={onDeleteNote}
      onOpenNewWindow={onOpenNewWindow}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      autoOpenPDFSetting={autoOpenPDFSetting}
      folderRevealLabel={folderRevealLabel}
      isActiveFilePinned={isActiveFilePinned}
      isFocusMode={isFocusMode}
      onOutlineJumpHandled={onOutlineJumpHandled}
      onToggleFocusMode={onToggleFocusMode}
      onTogglePinnedFile={onTogglePinnedFile}
      outlineItems={outlineItems}
      outlineJumpRequest={outlineJumpRequest}
      scrollRestorationKey={filePath}
      showOutline={showOutline}
      updateState={updateState}
      onUpdateAction={onUpdateAction}
    />
  );
}
