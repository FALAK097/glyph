import { memo, useCallback, useMemo } from "react";

import { getDisplayFileName, isSamePath } from "@/lib/paths";
import { getDirectTabShortcutDisplay, getShortcutDisplay } from "@/shared/shortcuts";
import type { NoteTab, TabMovePosition } from "@/shared/workspace";
import { useLayoutStore } from "@/store/layout";
import { useWorkspaceStore } from "@/store/workspace";

import { MarkdownEditor } from "./markdown-editor";
import { NoteTabsBar } from "./note-tabs-bar";
import { useSplitViewContext } from "./split-view-context";

type EditorPaneProps = {
  paneId: string;
};

export const EditorPane = memo(function EditorPane({ paneId }: EditorPaneProps) {
  const ctx = useSplitViewContext();

  // ── Layout store selectors ─────────────────────────────────────────
  const isActivePane = useLayoutStore((s) => s.activePaneId === paneId);
  const paneState = useLayoutStore((s) => s.panes[paneId]);
  const hasMultiplePanes = useLayoutStore((s) => Object.keys(s.panes).length > 1);

  const paneTabIds = paneState?.tabIds ?? [];
  const paneActiveTabId = paneState?.activeTabId ?? null;

  // ── Workspace store: get NoteTab objects for this pane ─────────────
  const allNoteTabs = useWorkspaceStore((s) => s.noteTabs);

  const paneTabs = useMemo(() => {
    const tabMap = new Map<string, NoteTab>();
    for (const tab of allNoteTabs) {
      tabMap.set(tab.id, tab);
    }
    return paneTabIds.map((id) => tabMap.get(id)).filter(Boolean) as NoteTab[];
  }, [allNoteTabs, paneTabIds]);

  const activeTab = useMemo(
    () => paneTabs.find((tab) => tab.id === paneActiveTabId) ?? null,
    [paneTabs, paneActiveTabId],
  );

  // ── Derived display values ─────────────────────────────────────────
  const content = activeTab?.draftContent ?? "";
  const fileName = activeTab?.file.name ?? null;
  const filePath = activeTab?.file.path ?? null;
  const isDirty = activeTab?.isDirty ?? false;
  const isSaving = activeTab?.isSaving ?? false;

  const saveStateLabel = useMemo(() => {
    if (!activeTab) return "";
    if (isSaving) return "Saving...";
    if (isDirty) return "Unsaved";
    return "Saved";
  }, [activeTab, isDirty, isSaving]);

  const wordCount = useMemo(() => {
    if (!content) return 0;
    return content.split(/\s+/).filter(Boolean).length;
  }, [content]);

  const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 200)), [wordCount]);

  const isActiveFilePinned = useMemo(() => {
    if (!filePath) return false;
    return ctx.pinnedFilePaths.some((p) => isSamePath(p, filePath));
  }, [ctx.pinnedFilePaths, filePath]);

  const handleTogglePinnedFile = useCallback(() => {
    if (filePath) {
      ctx.onTogglePinnedFile(filePath);
    }
  }, [ctx, filePath]);

  const footerMetaLabel = useMemo(() => {
    if (!content) return "";
    const bytes = new TextEncoder().encode(content).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }, [content]);

  const noteTabItems = useMemo(
    () =>
      paneTabs.map((tab, index) => ({
        id: tab.id,
        label: getDisplayFileName(tab.file.name),
        path: tab.file.path,
        shortcutLabel: getDirectTabShortcutDisplay(
          index,
          paneTabs.length,
          typeof navigator === "undefined" ? undefined : navigator.platform,
        ),
      })),
    [paneTabs],
  );

  // ── Handlers (bind paneId) ─────────────────────────────────────────
  const handleFocus = useCallback(() => {
    if (!isActivePane) {
      ctx.onActivatePane(paneId);
    }
  }, [ctx, isActivePane, paneId]);

  const handleContentChange = useCallback(
    (value: string) => {
      if (paneActiveTabId) {
        ctx.onContentChange(paneId, paneActiveTabId, value);
      }
    },
    [ctx, paneId, paneActiveTabId],
  );

  const handleSelectTab = useCallback(
    (path: string) => {
      ctx.onSelectTab(paneId, path);
    },
    [ctx, paneId],
  );

  const handleCloseTab = useCallback(
    (path: string) => {
      ctx.onCloseTab(paneId, path);
    },
    [ctx, paneId],
  );

  const handleMoveTab = useCallback(
    (sourcePath: string, targetPath: string, position: TabMovePosition) => {
      ctx.onMoveTab(paneId, sourcePath, targetPath, position);
    },
    [ctx, paneId],
  );

  // Only the active pane receives focus / find requests
  const editorFocusRequest = isActivePane ? ctx.editorFocusRequest : null;
  const findRequest = isActivePane ? ctx.findRequest : null;
  const outlineItems = isActivePane ? ctx.outlineItems : [];
  const outlineJumpRequest = isActivePane ? ctx.outlineJumpRequest : null;

  // ── Active pane highlight ──────────────────────────────────────────
  const showActiveBorder = hasMultiplePanes;

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col ${
        showActiveBorder
          ? isActivePane
            ? "ring-1 ring-inset ring-primary/30"
            : "ring-1 ring-inset ring-transparent"
          : ""
      }`}
      onFocusCapture={handleFocus}
      onPointerDown={handleFocus}
    >
      <MarkdownEditor
        content={content}
        fileName={fileName}
        filePath={filePath}
        editorFocusRequest={editorFocusRequest}
        findRequest={findRequest}
        initialScrollTop={0}
        saveStateLabel={saveStateLabel}
        footerMetaLabel={footerMetaLabel}
        wordCount={wordCount}
        readingTime={readingTime}
        subheaderContent={
          noteTabItems.length > 0 ? (
            <NoteTabsBar
              activeTabId={paneActiveTabId}
              tabs={noteTabItems}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onMoveTab={handleMoveTab}
            />
          ) : null
        }
        onChange={handleContentChange}
        onToggleSidebar={ctx.onToggleSidebar}
        isSidebarCollapsed={ctx.isSidebarCollapsed}
        onCreateNote={ctx.onCreateNote}
        toggleSidebarShortcut={getShortcutDisplay(
          ctx.shortcuts,
          "toggle-sidebar",
          navigator.platform,
        )}
        newNoteShortcut={getShortcutDisplay(ctx.shortcuts, "new-note", navigator.platform)}
        onOpenSettings={ctx.onOpenSettings}
        onOpenCommandPalette={ctx.onOpenCommandPalette}
        commandPaletteLabel="Search notes and skills"
        onOpenLinkedFile={ctx.onOpenLinkedFile}
        commandPaletteShortcut={
          getShortcutDisplay(ctx.shortcuts, "command-palette", navigator.platform) ??
          (navigator.platform.includes("Mac") ? "⌘P" : "Ctrl+P")
        }
        onScrollPositionChange={ctx.onScrollPositionChange}
        onNavigateBack={ctx.onNavigateBack}
        onNavigateForward={ctx.onNavigateForward}
        navigateBackShortcut={getShortcutDisplay(
          ctx.shortcuts,
          "navigate-back",
          navigator.platform,
        )}
        navigateForwardShortcut={getShortcutDisplay(
          ctx.shortcuts,
          "navigate-forward",
          navigator.platform,
        )}
        focusModeShortcut={getShortcutDisplay(ctx.shortcuts, "focus-mode", navigator.platform)}
        zoomInShortcut={getShortcutDisplay(ctx.shortcuts, "zoom-in", navigator.platform)}
        zoomOutShortcut={getShortcutDisplay(ctx.shortcuts, "zoom-out", navigator.platform)}
        zoomResetShortcut={getShortcutDisplay(ctx.shortcuts, "zoom-reset", navigator.platform)}
        canGoBack={ctx.canGoBack}
        canGoForward={ctx.canGoForward}
        autoOpenPDFSetting={ctx.autoOpenPDFSetting}
        folderRevealLabel={ctx.folderRevealLabel}
        isActiveFilePinned={isActiveFilePinned}
        onTogglePinnedFile={filePath ? handleTogglePinnedFile : undefined}
        isFocusMode={ctx.isFocusMode}
        showOutline={ctx.showOutline}
        outlineItems={outlineItems}
        outlineJumpRequest={outlineJumpRequest}
        onOutlineJumpHandled={ctx.onOutlineJumpHandled}
        onToggleFocusMode={ctx.onToggleFocusMode}
        editorScale={ctx.editorScale}
        onEditorScaleChange={ctx.onEditorScaleChange}
        scrollRestorationKey={filePath}
        updateState={isActivePane ? ctx.updateState : null}
        updatesMode={ctx.updatesMode}
        dismissedUpdateVersion={ctx.dismissedUpdateVersion}
        onUpdateAction={ctx.onUpdateAction}
        onDismissUpdateAction={ctx.onDismissUpdateAction}
      />
    </div>
  );
});
