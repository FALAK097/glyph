/// <reference types="vite/client" />

import type {
  AppCommand,
  AppInfo,
  AssetSelection,
  AppSettings,
  DialogKind,
  UpdateState,
  FileDocument,
  FileOpenResult,
  NoteLinkPreview,
  ResolvedLinkTarget,
  SearchResult,
  WorkspaceChangeEvent,
  WorkspaceSnapshot,
  ExternalFileTarget,
} from "./shared/workspace";
import type { SkillDocument, SkillLibraryChangeEvent, SkillLibrarySnapshot } from "./shared/skills";

declare global {
  interface Window {
    glyph?: {
      openDialog: (kind: DialogKind) => Promise<FileOpenResult | null>;
      pickAsset: (kind: "image" | "any-file") => Promise<AssetSelection | null>;
      resolveLinkTarget: (
        currentFilePath: string | null,
        href: string,
      ) => Promise<ResolvedLinkTarget | null>;
      getLinkPreview: (
        currentFilePath: string | null,
        href: string,
      ) => Promise<NoteLinkPreview | null>;
      openFolder: (dirPath?: string) => Promise<WorkspaceSnapshot | null>;
      openDefaultWorkspace: () => Promise<WorkspaceSnapshot | null>;
      openDocument: () => Promise<FileDocument | null>;
      readFile: (filePath: string) => Promise<FileDocument>;
      getSkillLibrary: () => Promise<SkillLibrarySnapshot>;
      refreshSkillLibrary: (changedPaths?: string[]) => Promise<SkillLibrarySnapshot>;
      searchSkillLibrary: (query: string) => Promise<string[]>;
      readSkillDocument: (filePath: string) => Promise<SkillDocument>;
      saveSkillDocument: (filePath: string, content: string) => Promise<SkillDocument>;
      saveFile: (filePath: string, content: string) => Promise<FileDocument>;
      createFile: (parentDir: string, fileName: string) => Promise<FileDocument>;
      renameFile: (oldPath: string, newName: string) => Promise<FileDocument>;
      moveFile: (oldPath: string, targetDir: string) => Promise<FileDocument>;
      renameFolder: (
        oldPath: string,
        newName: string,
      ) => Promise<{ oldPath: string; newPath: string }>;
      deleteFile: (targetPath: string) => Promise<string>;
      deleteFolder: (targetPath: string) => Promise<string>;
      createFolder: (
        parentDir: string,
        folderName: string,
      ) => Promise<WorkspaceSnapshot["tree"] | null>;
      searchWorkspace: (query: string) => Promise<SearchResult[]>;
      getSidebarNode: (
        kind: "file" | "directory",
        targetPath: string,
      ) => Promise<WorkspaceSnapshot["tree"][number] | null>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      getAppInfo: () => Promise<AppInfo>;
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => Promise<UpdateState>;
      downloadUpdate: () => Promise<UpdateState>;
      installUpdate: () => Promise<void>;
      onWorkspaceChanged: (listener: (event: WorkspaceChangeEvent) => void) => () => void;
      onSkillLibraryChanged: (listener: (event: SkillLibraryChangeEvent) => void) => () => void;
      onCommand: (listener: (command: AppCommand) => void) => () => void;
      getPendingExternalPath: () => Promise<ExternalFileTarget | null>;
      revealInFinder: (targetPath: string) => Promise<boolean>;
      onExternalFile: (listener: (target: ExternalFileTarget) => void) => () => void;
      onUpdateStateChange: (listener: (state: UpdateState) => void) => () => void;
      openExternal: (path: string) => Promise<void>;

      exportMarkdownToPDF: (markdown: string, filename: string) => Promise<string>;
    };
  }
}

export {};
