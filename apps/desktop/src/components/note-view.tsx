import { useCallback, useMemo } from "react";

import { getDisplayFileName } from "@/lib/paths";
import { getDirectTabShortcutDisplay, getShortcutDisplay } from "@/shared/shortcuts";
import type { NoteTab, ShortcutSetting, TabMovePosition } from "@/shared/workspace";
import type { OutlineItem } from "@/types/navigation";
import type { UpdateState } from "@/shared/workspace";
import type { EditorFocusRequest } from "@/types/markdown-editor";

import { MarkdownEditor } from "./markdown-editor";
import { NoteTabsBar } from "./note-tabs-bar";

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
  activeTabId: string | null;
  noteTabs: NoteTab[];
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
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onMoveTab: (sourcePath: string, targetPath: string, position: TabMovePosition) => void;
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
  activeTabId,
  noteTabs,
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
  onSelectTab,
  onCloseTab,
  onMoveTab,
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

  const noteTabItems = useMemo(
    () =>
      noteTabs.map((tab, index) => ({
        id: tab.id,
        label: getDisplayFileName(tab.file.name),
        path: tab.file.path,
        shortcutLabel: getDirectTabShortcutDisplay(
          index,
          noteTabs.length,
          typeof navigator === "undefined" ? undefined : navigator.platform,
        ),
      })),
    [noteTabs],
  );

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
      subheaderContent={
        noteTabItems.length > 0 ? (
          <NoteTabsBar
            activeTabId={activeTabId}
            tabs={noteTabItems}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onMoveTab={onMoveTab}
          />
        ) : null
      }
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
