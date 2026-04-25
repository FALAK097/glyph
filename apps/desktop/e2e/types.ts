import type { ElectronApplication, Page, TestInfo } from "@playwright/test";

export type GlyphSandbox = {
  cleanup: () => Promise<void>;
  settingsPath: string;
  userDataRoot: string;
  workspaceRoot: string;
};

export type GlyphHarness = {
  app: ElectronApplication;
  sandbox: GlyphSandbox;
  stop: (testInfo: TestInfo) => Promise<void>;
  window: Page;
};

export type PersistedSessionState = {
  noteFilePath: string | null;
  noteTabPaths: string[];
  noteWorkspacePath: string | null;
};

export type TabState = {
  label: string | null;
  selected: string | null;
  title: string | null;
};

export type ContextIndexEntry = {
  backlinks: Array<{ sourceRelativePath: string }>;
  frontmatter: Record<string, unknown>;
  headings: Array<{ text: string }>;
  kind: string;
  relativePath: string;
  tags: string[];
};

export type ContextIndexStatus = {
  noteCount: number;
  state: string;
};

export type WorkspaceOpened = {
  activeFile: { name: string } | null;
  rootPath: string;
} | null;

export type GlyphApi = {
  openFolder: (dirPath?: string) => Promise<WorkspaceOpened>;
  getContextIndexStatus: () => Promise<ContextIndexStatus>;
  getContextIndexEntry: (filePath: string) => Promise<ContextIndexEntry | null>;
};
