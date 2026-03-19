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

export type AppSettings = {
  defaultWorkspacePath: string;
  themeId: string;
  themeMode: ThemeMode;
  recentFiles: string[];
  shortcuts: ShortcutSetting[];
  sidebar: SidebarState;
  autoOpenPDF: boolean;
};

export type AppCommand = "open-file" | "open-folder" | "save" | "new-file" | "new-folder" | "search" | "quick-open" | "toggle-sidebar";

export type ExternalFileTarget = {
  path: string;
  isDirectory: boolean;
};
