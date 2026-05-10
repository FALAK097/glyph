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

export type NoteCollectionAccentKey =
  | "violet"
  | "indigo"
  | "blue"
  | "sky"
  | "cyan"
  | "teal"
  | "emerald"
  | "lime"
  | "amber"
  | "orange"
  | "coral"
  | "rose"
  | "pink"
  | "red"
  | "slate";

export type NoteCollectionIconKey =
  | "folder"
  | "book"
  | "briefcase"
  | "calendar"
  | "sparkles"
  | "rocket"
  | "tag"
  | "archive"
  | "leaf"
  | "layers"
  | "globe"
  | "home"
  | "camera"
  | "notebook"
  | "star"
  | "idea"
  | "file"
  | "sun"
  | "moon"
  | "monitor";

export type NoteFolderAppearance = {
  accent: NoteCollectionAccentKey;
  icon: NoteCollectionIconKey;
};

export type NoteFolderAppearanceMap = Record<string, Partial<NoteFolderAppearance>>;

export type NoteBrowserEntry = {
  path: string;
  title: string;
  icon: string | null;
  excerpt: string;
  modifiedAt: string | null;
  createdAt: string | null;
  sizeBytes: number;
  wordCount: number;
};

export type NoteKnowledgeHeading = {
  id: string;
  level: number;
  title: string;
  line: number;
};

export type NoteKnowledgeTag = {
  name: string;
  line: number;
};

export type NoteKnowledgeLink = {
  kind: "markdown" | "wiki";
  target: string;
  label: string;
  resolvedPath: string | null;
  line: number;
};

export type NoteKnowledgeDocument = {
  path: string;
  title: string;
  excerpt: string;
  frontmatter: Record<string, unknown>;
  tags: NoteKnowledgeTag[];
  headings: NoteKnowledgeHeading[];
  links: NoteKnowledgeLink[];
  backlinks: string[];
  modifiedAt: string | null;
  createdAt: string | null;
  sizeBytes: number;
  wordCount: number;
};

export type NoteKnowledgeIndexSnapshot = {
  workspaceRoot: string | null;
  notes: NoteKnowledgeDocument[];
  tags: Array<{ name: string; count: number }>;
  generatedAt: string;
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
  noteFolderAppearances: NoteFolderAppearanceMap;
  shortcuts: ShortcutSetting[];
  sidebar: SidebarState;
  editorPreferences: EditorPreferences;
  autoOpenPDF: boolean;
  dismissedUpdateVersion: string | null;
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
  | "zoom-reset"
  | "split-right"
  | "split-down"
  | "close-pane"
  | "focus-next-pane"
  | "focus-previous-pane"
  | "navigate-back"
  | "navigate-forward";

export type ExternalFileTarget = {
  path: string;
  isDirectory: boolean;
};

// ─── Split View Layout ──────────────────────────────────────────────

export type SplitDirection = "horizontal" | "vertical";

export type PaneNode = {
  type: "pane";
  id: string;
};

export type SplitNode = {
  type: "split";
  id: string;
  direction: SplitDirection;
  children: [LayoutNode, LayoutNode];
};

export type LayoutNode = PaneNode | SplitNode;

export type PaneState = {
  tabIds: string[];
  activeTabId: string | null;
};
