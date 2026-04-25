import type { ReactNode } from "react";
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
  headerAccessory?: ReactNode;
  subheaderContent?: ReactNode;
  topContent?: ReactNode;
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
