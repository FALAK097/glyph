import type { UpdateState } from "../shared/workspace";

export type MarkdownEditorProps = {
  content: string;
  fileName: string | null;
  filePath: string | null;
  saveStateLabel: string;
  wordCount: number;
  readingTime: number;
  onChange: (value: string) => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onCreateNote?: () => void;
  toggleSidebarShortcut?: string;
  newNoteShortcut?: string;
  onOpenSettings?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenLinkedFile?: (path: string) => void;
  commandPaletteShortcut?: string;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  navigateBackShortcut?: string;
  navigateForwardShortcut?: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  autoOpenPDFSetting?: boolean;
  updateState?: UpdateState | null;
  onUpdateAction?: () => void;
};

export type MarkdownEditorToast = {
  title: string;
  description: string;
};
