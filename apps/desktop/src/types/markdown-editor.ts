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
  editorFocusRequest?: EditorFocusRequest | null;
  workspaceRootPath?: string | null;
  saveStateLabel: string;
  footerMetaLabel?: string;
  wordCount: number;
  readingTime: number;
  onChange: (value: string) => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
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
  isActiveFileFavorite?: boolean;
  isActiveFilePinned?: boolean;
  onOutlineJumpHandled?: () => void;
  onToggleFavoriteFile?: () => void;
  updateState?: UpdateState | null;
  onUpdateAction?: () => void;
  isFocusMode?: boolean;
  showOutline?: boolean;
  onToggleFocusMode?: () => void;
  focusModeShortcut?: string;
  onOpenNewWindow?: () => void;
  onDeleteNote?: () => void;
  onTogglePinnedFile?: () => void;
  folderRevealLabel?: string;
  documentLabel?: string;
  outlineItems?: OutlineItem[];
  outlineJumpRequest?: { id: string; nonce: number } | null;
};

export type MarkdownEditorToast = {
  title: string;
  description: string;
};
