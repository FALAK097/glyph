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

export type SearchResult = {
  path: string;
  name: string;
  line: number;
  snippet: string;
};

export type ThemeMode = "light" | "dark";

export type AppSettings = {
  defaultWorkspacePath: string;
  themeId: string;
  themeMode: ThemeMode;
  recentFiles: string[];
};

export type AppCommand = "open-file" | "open-folder" | "save" | "new-file" | "new-folder" | "search" | "quick-open";
