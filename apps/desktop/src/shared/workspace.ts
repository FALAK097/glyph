export type FileDocument = {
  path: string;
  name: string;
  content: string;
};

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
  changedPath: string;
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
};

export type AppSettings = {
  defaultWorkspacePath: string;
  themeId: string;
  themeMode: ThemeMode;
  hiddenFiles: string[];
  pinnedFiles: string[];
  shortcuts: ShortcutSetting[];
  sidebar: SidebarState;
  editorPreferences: EditorPreferences;
  autoOpenPDF: boolean;
};

export type AppInfo = {
  name: string;
  version: string;
  isPackaged: boolean;
  platform: string;
  updatesEnabled: boolean;
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
  releaseName: string | null;
  releaseNotes: string | null;
  progressPercent: number | null;
  checkedAt: string | null;
  errorMessage: string | null;
};

export type AppCommand =
  | "open-file"
  | "open-folder"
  | "save"
  | "new-file"
  | "new-folder"
  | "search"
  | "quick-open"
  | "toggle-sidebar"
  | "focus-mode";

export type ExternalFileTarget = {
  path: string;
  isDirectory: boolean;
};
