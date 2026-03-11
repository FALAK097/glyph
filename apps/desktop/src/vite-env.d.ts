/// <reference types="vite/client" />

import type { AppCommand, AppSettings, FileDocument, FileOpenResult, SearchResult, WorkspaceChangeEvent, WorkspaceSnapshot, ExternalFileTarget } from "./shared/workspace";

declare global {
  interface Window {
    typist?: {
      openDialog: (kind: "file" | "directory") => Promise<FileOpenResult | null>;
      openFolder: (dirPath?: string) => Promise<WorkspaceSnapshot | null>;
      openDefaultWorkspace: () => Promise<WorkspaceSnapshot | null>;
      openDocument: () => Promise<FileDocument | null>;
      readFile: (filePath: string) => Promise<FileDocument>;
      saveFile: (filePath: string, content: string) => Promise<FileDocument>;
      createFile: (parentDir: string, fileName: string) => Promise<FileDocument>;
      renameFile: (oldPath: string, newName: string) => Promise<FileDocument>;
      deleteFile: (targetPath: string) => Promise<string>;
      createFolder: (parentDir: string, folderName: string) => Promise<WorkspaceSnapshot["tree"]>;
      searchWorkspace: (query: string) => Promise<SearchResult[]>;
      getSidebarNode: (kind: "file" | "directory", targetPath: string) => Promise<WorkspaceSnapshot["tree"][number] | null>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      onWorkspaceChanged: (listener: (event: WorkspaceChangeEvent) => void) => () => void;
      onCommand: (listener: (command: AppCommand) => void) => () => void;
      getPendingExternalPath: () => Promise<ExternalFileTarget | null>;
      revealInFinder: (targetPath: string) => Promise<boolean>;
      onExternalFile: (listener: (target: ExternalFileTarget) => void) => () => void;
    };
  }
}

export {};
