import type { ReactNode } from "react";

import type { UpdateState } from "../shared/workspace";
import type { OutlineItem } from "@/types/navigation";

export type EditorFocusRequest = {
  mode: "start" | "end" | "preserve";
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
  workspaceRootPath?: string | null;
  saveStateLabel: string;
  footerMetaLabel?: string;
  wordCount: number;
  readingTime: number;
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
  onUpdateAction?: () => void;
  isFocusMode?: boolean;
  showOutline?: boolean;
  onToggleFocusMode?: () => void;
  focusModeShortcut?: string;
  onOpenNewWindow?: () => void;
  onDeleteNote?: () => void;
  onTogglePinnedFile?: () => void;
  onScrollPositionChange?: (targetPath: string | null, scrollTop: number) => void;
  folderRevealLabel?: string;
  documentLabel?: string;
  outlineItems?: OutlineItem[];
  outlineJumpRequest?: { id: string; nonce: number } | null;
};

export type MarkdownEditorToast = {
  title: string;
  description: string;
};
