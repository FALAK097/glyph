import { createContext, useContext } from "react";

import type { AppInfo, ShortcutSetting, TabMovePosition, UpdateState } from "@/shared/workspace";
import type { EditorFindRequest, EditorFocusRequest } from "@/types/markdown-editor";
import type { OutlineItem } from "@/types/navigation";

/**
 * Shared controller state passed through the split layout tree so that
 * individual pane components don't need the full controller prop-drilled
 * from DesktopApp. Keep this context stable and avoid putting high-churn
 * editor state here so inactive panes don't rerender on every keystroke.
 */
export type SplitViewContextValue = {
  // ── Appearance / settings ──
  shortcuts: ShortcutSetting[];
  isSidebarCollapsed: boolean;
  isFocusMode: boolean;
  showOutline: boolean;
  editorScale: number;
  autoOpenPDFSetting: boolean;
  folderRevealLabel: string;
  updateState: UpdateState | null;
  updatesMode: AppInfo["updatesMode"] | undefined;
  dismissedUpdateVersion: string | null;

  // ── Navigation ──
  canGoBack: boolean;
  canGoForward: boolean;

  // ── Callbacks ──
  onToggleSidebar: () => void;
  onCreateNote: () => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  onOpenLinkedFile: (path: string) => void;
  onScrollPositionChange: (targetPath: string | null, scrollTop: number) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onToggleFocusMode: () => void;
  onEditorScaleChange: (scale: number) => void;
  onUpdateAction: () => void;
  onDismissUpdateAction: () => void;

  // NoteView-only note actions are intentionally omitted here until split view
  // grows pane-aware versions of those workflows.

  // ── Pinned files ──
  pinnedFilePaths: string[];
  onTogglePinnedFile: (filePath: string) => void;

  // ── Pane-aware tab operations (these go through layout store) ──
  onSelectTab: (paneId: string, path: string) => void;
  onCloseTab: (paneId: string, path: string) => void;
  onMoveTab: (
    paneId: string,
    sourcePath: string,
    targetPath: string,
    position: TabMovePosition,
  ) => void;
  onContentChange: (paneId: string, tabId: string, content: string) => void;
  onActivatePane: (paneId: string) => void;
};

export type SplitViewActivePaneContextValue = {
  editorFocusRequest: EditorFocusRequest | null;
  findRequest: EditorFindRequest | null;
  outlineItems: OutlineItem[];
  outlineJumpRequest: { id: string; nonce: number } | null;
  onOutlineJumpHandled: () => void;
};

const SplitViewContext = createContext<SplitViewContextValue | null>(null);
const SplitViewActivePaneContext = createContext<SplitViewActivePaneContextValue | null>(null);

export const SplitViewProvider = SplitViewContext.Provider;
export const SplitViewActivePaneProvider = SplitViewActivePaneContext.Provider;

export function useSplitViewContext(): SplitViewContextValue {
  const context = useContext(SplitViewContext);
  if (!context) {
    throw new Error("useSplitViewContext must be used within a SplitViewProvider");
  }
  return context;
}

export function useSplitViewActivePaneContext(): SplitViewActivePaneContextValue {
  const context = useContext(SplitViewActivePaneContext);
  if (!context) {
    throw new Error(
      "useSplitViewActivePaneContext must be used within a SplitViewActivePaneProvider",
    );
  }
  return context;
}
