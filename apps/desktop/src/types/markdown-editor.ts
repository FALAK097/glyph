import type { NoteLinkPreview, UpdateState } from "@/core/workspace";
import type { OutlineItem } from "@/types/navigation";

export type EditorFindRequest = {
  nonce: number;
};

export type EditorFocusRequest = {
  mode: "start" | "end" | "preserve";
  nonce: number;
};

export type MarkdownEditorToast = {
  title: string;
  description?: string;
};

export type MarkdownEditorProps = {
  content: string;
  fileName: string | null;
  filePath: string | null;
  isEditable?: boolean;
  initialScrollTop?: number;
  scrollRestorationKey?: string | null;
  editorFocusRequest?: EditorFocusRequest | null;
  findRequest?: EditorFindRequest | null;
  showToolbar?: boolean;
  saveStateLabel?: string;
  footerMetaLabel?: string;
  wordCount: number;
  readingTime: number;
  onChange: (content: string) => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  headerAccessory?: React.ReactNode;
  subheaderContent?: React.ReactNode;
  topContent?: React.ReactNode;
  onCreateNote?: () => void;
  toggleSidebarShortcut?: string;
  newNoteShortcut?: string;
  onOpenSettings?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenLinkedFile?: (path: string) => void;
  commandPaletteShortcut?: string;
  commandPaletteLabel?: string;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  navigateBackShortcut?: string;
  navigateForwardShortcut?: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  autoOpenPDFSetting?: boolean;
  isActiveFilePinned?: boolean;
  onOutlineJumpHandled?: () => void;
  updateState?: UpdateState | null;
  updatesMode?: "automatic" | "manual" | "none";
  onUpdateAction?: () => void;
  onDismissUpdateAction?: () => void;
  dismissedUpdateVersion?: string | null;
  isFocusMode?: boolean;
  showOutline?: boolean;
  onToggleFocusMode?: () => void;
  focusModeShortcut?: string;
  zoomInShortcut?: string;
  zoomOutShortcut?: string;
  zoomResetShortcut?: string;
  onTogglePinnedFile?: () => void;
  onEditorScaleChange?: (scale: number) => void;
  onScrollPositionChange?: (key: string | null, scrollTop: number) => void;
  folderRevealLabel?: string;
  documentLabel?: string;
  outlineJumpRequest?: { id: string; nonce: number } | null;
  editorScale?: number;
  onDeleteNote?: () => void;
  onOpenNewWindow?: () => void;
  outlineItems?: OutlineItem[];
};

export type EditorActionType = "insert-table" | "insert-link" | "insert-image";

export type EditorActionDetail = {
  type: EditorActionType;
};

export type ImageControlsState = {
  left: number;
  top: number;
};

export type HoveredLinkState = {
  href: string;
  placement: "above" | "below";
  preview: NoteLinkPreview | null;
  status: "hint" | "loading" | "preview";
  tooltipLeft: number;
  tooltipTop: number;
};

export type TableControlsState = {
  active: boolean;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
  canDeleteTable: boolean;
};

export type SelectionSnapshot = {
  from: number;
  to: number;
};

export type FindPanelState = {
  activeIndex: number;
  matchCount: number;
};

export type EditorOutlineItem = OutlineItem & {
  pos: number;
};

export function getDevPreviewUpdateState(): UpdateState | null {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const previewStatus = window.localStorage.getItem("glyph.dev.update-preview");

  if (previewStatus === "available") {
    return {
      status: "available",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: null,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloading") {
    return {
      status: "downloading",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: 68,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloaded") {
    return {
      status: "downloaded",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: "0.2.0",
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: 100,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "installed") {
    return {
      status: "not-available",
      currentVersion: "0.2.0",
      availableVersion: null,
      downloadedVersion: null,
      recentlyInstalledVersion: "0.2.0",
      releasePageUrl: null,
      releaseName: null,
      releaseNotes: null,
      progressPercent: null,
      checkedAt: null,
      errorMessage: null,
    };
  }

  return null;
}
