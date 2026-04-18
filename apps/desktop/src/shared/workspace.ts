export type FileDocument = {
  path: string;
  name: string;
  content: string;
};

export type NoteTab = {
  id: string;
  file: FileDocument;
  draftContent: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
};

export type TabMovePosition = "before" | "after";

export type FileNode = {
  type: "file";
  name: string;
  path: string;
};

export type DirectoryBranch = {
  type: "directory";
  name: string;
  path: string;
  children: DirectoryNode[];
};

export type DirectoryNode = FileNode | DirectoryBranch;

export type WorkspaceSnapshot = {
  rootPath: string;
  tree: DirectoryNode[];
  activeFile: FileDocument | null;
};

export type WorkspaceChangeEvent = {
  rootPath: string;
  tree: DirectoryNode[];
  changedPaths: string[];
};

export type FileOpenResult = {
  kind: "file" | "directory";
  path: string;
};

export type DialogKind = "file" | "directory" | "image" | "any-file";

export type AssetSelection = {
  path: string;
  name: string;
  url: string;
};

export type ResolvedLinkTarget = {
  kind: "markdown-file" | "file" | "external";
  target: string;
};

export type NoteLinkPreview = {
  targetPath: string;
  title: string;
  excerpt: string;
  displayPath: string;
};

export type SearchResult = {
  path: string;
  name: string;
  line: number;
  snippet: string;
};

export type ThemeMode = "light" | "dark" | "system";

export type ShortcutSetting = {
  id: string;
  keys: string;
};

export type SidebarItemSetting = {
  kind: "file" | "directory";
  path: string;
};

export type SidebarState = {
  items: SidebarItemSetting[];
  expandedFolders: string[];
};

export type EditorPreferences = {
  focusMode: boolean;
  showOutline: boolean;
  editorScale: number;
};

export type AppSettings = {
  defaultWorkspacePath: string;
  hasSeenWelcomeNote: boolean;
  welcomeNoteVersionSeen: number;
  themeId: string;
  themeMode: ThemeMode;
  hiddenFiles: string[];
  pinnedFiles: string[];
  shortcuts: ShortcutSetting[];
  sidebar: SidebarState;
  editorPreferences: EditorPreferences;
  autoOpenPDF: boolean;
  dismissedUpdateVersion: string | null;
  dismissedDefaultAppPrompt: boolean | null;
};

export type AppInfo = {
  name: string;
  version: string;
  isPackaged: boolean;
  platform: string;
  updatesEnabled: boolean;
  updatesMode: "automatic" | "manual" | "none";
};

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "not-available"
  | "error";

export type UpdateState = {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  recentlyInstalledVersion: string | null;
  releasePageUrl: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  progressPercent: number | null;
  checkedAt: string | null;
  errorMessage: string | null;
};

export type AppCommand =
  | "open-file"
  | "open-folder"
  | "check-updates"
  | "save"
  | "new-file"
  | "new-folder"
  | "close-tab"
  | "next-tab"
  | "previous-tab"
  | "search"
  | "quick-open"
  | "find-in-note"
  | "toggle-sidebar"
  | "focus-mode"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset";

export type ExternalFileTarget = {
  path: string;
  isDirectory: boolean;
};
