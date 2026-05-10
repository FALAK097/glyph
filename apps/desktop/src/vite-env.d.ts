/// <reference types="vite/client" />

import type {
  AppCommand,
  AppInfo,
  AssetSelection,
  AppSettings,
  DialogKind,
  NoteBrowserEntry,
  NoteKnowledgeIndexSnapshot,
  UpdateState,
  FileDocument,
  FileOpenResult,
  NoteLinkPreview,
  ResolvedLinkTarget,
  SearchResult,
  WorkspaceChangeEvent,
  WorkspaceSnapshot,
  ExternalFileTarget,
} from "@/core/workspace";
import type { SkillDocument, SkillLibraryChangeEvent, SkillLibrarySnapshot } from "@/core/skills";
import type {
  TaskColumnCreateInput,
  TaskColumnDeleteInput,
  TaskColumnMoveInput,
  TaskColumnUpdateInput,
  TaskCreateInput,
  TaskDeleteInput,
  TaskIndexSnapshot,
  TaskMoveInput,
  TaskMutationResult,
  TaskUpdateInput,
  ArchivedTaskEntry,
  TaskUnarchiveInput,
} from "@/core/tasks";

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
      getKnowledgeIndex: () => Promise<NoteKnowledgeIndexSnapshot>;
      listTasks: () => Promise<TaskIndexSnapshot>;
      refreshTasks: () => Promise<TaskIndexSnapshot>;
      updateTask: (input: TaskUpdateInput) => Promise<TaskMutationResult>;
      moveTask: (input: TaskMoveInput) => Promise<TaskMutationResult>;
      deleteTask: (input: TaskDeleteInput) => Promise<TaskMutationResult>;
      createTask: (input: TaskCreateInput) => Promise<TaskMutationResult>;
      createTaskColumn: (input: TaskColumnCreateInput) => Promise<TaskMutationResult>;
      updateTaskColumn: (input: TaskColumnUpdateInput) => Promise<TaskMutationResult>;
      moveTaskColumn: (input: TaskColumnMoveInput) => Promise<TaskMutationResult>;
      deleteTaskColumn: (input: TaskColumnDeleteInput) => Promise<TaskMutationResult>;
      archiveCompletedTasks: () => Promise<TaskMutationResult>;
      getArchivedTasks: () => Promise<ArchivedTaskEntry[]>;
      unarchiveTask: (input: TaskUnarchiveInput) => Promise<TaskMutationResult>;
      getSidebarNode: (
        kind: "file" | "directory",
        targetPath: string,
      ) => Promise<WorkspaceSnapshot["tree"][number] | null>;
      getNoteBrowserEntries: (targetPath: string | null) => Promise<NoteBrowserEntry[]>;
      getNoteBrowserEntriesBatch: (
        targetPaths: Array<string | null>,
      ) => Promise<NoteBrowserEntry[][]>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      getAppInfo: () => Promise<AppInfo>;
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => Promise<UpdateState>;
      downloadUpdate: () => Promise<UpdateState>;
      installUpdate: () => Promise<void>;
      onWorkspaceChanged: (listener: (event: WorkspaceChangeEvent) => void) => () => void;
      onSkillLibraryChanged: (listener: (event: SkillLibraryChangeEvent) => void) => () => void;
      onTasksChanged: (listener: (snapshot: TaskIndexSnapshot) => void) => () => void;
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
