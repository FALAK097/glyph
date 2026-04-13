import { useCallback, useMemo } from "react";

import { getDisplayFileName } from "@/lib/paths";
import { getDirectTabShortcutDisplay, getShortcutDisplay } from "@/shared/shortcuts";
import type { AppInfo, NoteTab, ShortcutSetting, TabMovePosition } from "@/shared/workspace";
import type { OutlineItem } from "@/types/navigation";
import type { UpdateState } from "@/shared/workspace";
import type { EditorFindRequest, EditorFocusRequest } from "@/types/markdown-editor";

import { MarkdownEditor } from "./markdown-editor";
import { NoteTabsBar } from "./note-tabs-bar";

type NoteViewProps = {
  content: string;
  fileName: string | null;
  filePath: string | null;
  editorFocusRequest: EditorFocusRequest | null;
  findRequest: EditorFindRequest | null;
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
  editorScale: number;
  onEditorScaleChange: (scale: number) => void;
  zoomInShortcut?: string;
  zoomOutShortcut?: string;
  zoomResetShortcut?: string;
  outlineItems: OutlineItem[];
  outlineJumpRequest: { id: string; nonce: number } | null;
  updateState: UpdateState | null;
  updatesMode?: AppInfo["updatesMode"];
  dismissedUpdateVersion?: string | null;
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
  onDismissUpdateAction?: () => void;
};

export function NoteView({
  content,
  fileName,
  filePath,
  editorFocusRequest,
  findRequest,
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
  editorScale,
  onEditorScaleChange,
  outlineItems,
  outlineJumpRequest,
  updateState,
  updatesMode,
  dismissedUpdateVersion,
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
  onDismissUpdateAction,
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
      findRequest={findRequest}
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
      toggleSidebarShortcut={getShortcutDisplay(shortcuts, "toggle-sidebar", navigator.platform)}
      newNoteShortcut={getShortcutDisplay(shortcuts, "new-note", navigator.platform)}
      onOpenSettings={handleOpenSettings}
      onOpenCommandPalette={handleOpenCommandPalette}
      commandPaletteLabel="Search notes and skills"
      onOpenLinkedFile={onOpenLinkedFile}
      commandPaletteShortcut={
        getShortcutDisplay(shortcuts, "command-palette", navigator.platform) ??
        (navigator.platform.includes("Mac") ? "⌘P" : "Ctrl+P")
      }
      onScrollPositionChange={onScrollPositionChange}
      onNavigateBack={onNavigateBack}
      onNavigateForward={onNavigateForward}
      navigateBackShortcut={getShortcutDisplay(shortcuts, "navigate-back", navigator.platform)}
      navigateForwardShortcut={getShortcutDisplay(
        shortcuts,
        "navigate-forward",
        navigator.platform,
      )}
      focusModeShortcut={getShortcutDisplay(shortcuts, "focus-mode", navigator.platform)}
      zoomInShortcut={getShortcutDisplay(shortcuts, "zoom-in", navigator.platform)}
      zoomOutShortcut={getShortcutDisplay(shortcuts, "zoom-out", navigator.platform)}
      zoomResetShortcut={getShortcutDisplay(shortcuts, "zoom-reset", navigator.platform)}
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
      editorScale={editorScale}
      onEditorScaleChange={onEditorScaleChange}
      updateState={updateState}
      updatesMode={updatesMode}
      dismissedUpdateVersion={dismissedUpdateVersion}
      onUpdateAction={onUpdateAction}
      onDismissUpdateAction={onDismissUpdateAction}
    />
  );
}
