import type { ReactNode } from "react";

import type {
  AppInfo,
  ContextIndexStatus,
  NoteLinkPreview,
  UpdateState,
} from "../shared/workspace";
import type { OutlineItem } from "@/types/navigation";

export type EditorFocusRequest = {
  mode: "start" | "end" | "preserve";
  nonce: number;
};

export type EditorFindRequest = {
  nonce: number;
};

export type MarkdownEditorProps = {
  content: string;
  fileName: string | null;
  filePath: string | null;
  isEditable?: boolean;
  initialScrollTop?: number | null;
  scrollRestorationKey?: string | null;
  editorFocusRequest?: EditorFocusRequest | null;
  findRequest?: EditorFindRequest | null;
  showToolbar?: boolean;
  workspaceRootPath?: string | null;
  saveStateLabel: string;
  footerMetaLabel?: string;
  wordCount: number;
  readingTime: number;
  contextIndexStatus?: ContextIndexStatus | null;
  editorScale?: number;
  zoomInShortcut?: string;
  zoomOutShortcut?: string;
  zoomResetShortcut?: string;
  onChange: (value: string) => void;
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
  updatesMode?: AppInfo["updatesMode"];
  onUpdateAction?: () => void;
  onDismissUpdateAction?: () => void;
  dismissedUpdateVersion?: string | null;
  isFocusMode?: boolean;
  showOutline?: boolean;
  onToggleFocusMode?: () => void;
  focusModeShortcut?: string;
  onOpenNewWindow?: () => void;
  onDeleteNote?: () => void;
  onTogglePinnedFile?: () => void;
  onEditorScaleChange?: (scale: number) => void;
  onScrollPositionChange?: (targetPath: string | null, scrollTop: number) => void;
  folderRevealLabel?: string;
  documentLabel?: string;
  outlineItems?: OutlineItem[];
  outlineJumpRequest?: { id: string; nonce: number } | null;
};

export type MarkdownEditorToast = {
  title: string;
  description?: string;
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
