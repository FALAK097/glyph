const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

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
} from "../src/core/workspace.js";
import type {
  SkillDocument,
  SkillLibraryChangeEvent,
  SkillLibrarySnapshot,
} from "../src/core/skills.js";
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
  TaskUnarchiveInput,
  TaskUpdateInput,
  ArchivedTaskEntry,
} from "../src/core/tasks.js";

/**
 * Retries an IPC invoke when the main process handler is not yet registered.
 * Only use for startup-critical calls that may fire before `app.whenReady()`
 * finishes wiring IPC handlers. User-initiated calls should use plain
 * `ipcRenderer.invoke` since handlers are guaranteed to exist by then.
 */
async function invokeWithRetry<T>(channel: string, ...args: unknown[]) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return (await ipcRenderer.invoke(channel, ...args)) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.includes("No handler registered") || attempt === 7) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  throw new Error(`IPC failed for channel ${channel}.`);
}

const api = {
  openDialog(kind: DialogKind) {
    return ipcRenderer.invoke("dialog:open", kind) as Promise<FileOpenResult | null>;
  },
  pickAsset(kind: "image" | "any-file") {
    return ipcRenderer.invoke("asset:pick", kind) as Promise<AssetSelection | null>;
  },
  resolveLinkTarget(currentFilePath: string | null, href: string) {
    return ipcRenderer.invoke(
      "app:resolveLinkTarget",
      currentFilePath,
      href,
    ) as Promise<ResolvedLinkTarget | null>;
  },
  getLinkPreview(currentFilePath: string | null, href: string) {
    return ipcRenderer.invoke(
      "app:getLinkPreview",
      currentFilePath,
      href,
    ) as Promise<NoteLinkPreview | null>;
  },
  openFolder(dirPath?: string) {
    return invokeWithRetry<WorkspaceSnapshot | null>("workspace:openFolder", dirPath);
  },
  openDefaultWorkspace() {
    return invokeWithRetry<WorkspaceSnapshot | null>("workspace:openDefault");
  },
  openDocument() {
    return ipcRenderer.invoke("workspace:openDocument") as Promise<FileDocument | null>;
  },
  readFile(filePath: string) {
    return ipcRenderer.invoke("workspace:openFile", filePath) as Promise<FileDocument>;
  },
  getSkillLibrary() {
    return invokeWithRetry<SkillLibrarySnapshot>("skills:getLibrary");
  },
  refreshSkillLibrary(changedPaths?: string[]) {
    return ipcRenderer.invoke("skills:refresh", changedPaths) as Promise<SkillLibrarySnapshot>;
  },
  searchSkillLibrary(query: string) {
    return ipcRenderer.invoke("skills:search", query) as Promise<string[]>;
  },
  readSkillDocument(filePath: string) {
    return ipcRenderer.invoke("skills:readDocument", filePath) as Promise<SkillDocument>;
  },
  saveSkillDocument(filePath: string, content: string) {
    return ipcRenderer.invoke("skills:saveDocument", filePath, content) as Promise<SkillDocument>;
  },
  saveFile(filePath: string, content: string) {
    return ipcRenderer.invoke("workspace:saveFile", filePath, content) as Promise<FileDocument>;
  },
  createFile(parentDir: string, fileName: string) {
    return ipcRenderer.invoke("workspace:createFile", parentDir, fileName) as Promise<FileDocument>;
  },
  renameFile(oldPath: string, newName: string) {
    return ipcRenderer.invoke("workspace:renameFile", oldPath, newName) as Promise<FileDocument>;
  },
  moveFile(oldPath: string, targetDir: string) {
    return ipcRenderer.invoke("workspace:moveFile", oldPath, targetDir) as Promise<FileDocument>;
  },
  renameFolder(oldPath: string, newName: string) {
    return ipcRenderer.invoke("workspace:renameFolder", oldPath, newName) as Promise<{
      oldPath: string;
      newPath: string;
    }>;
  },
  deleteFile(targetPath: string) {
    return ipcRenderer.invoke("workspace:deleteFile", targetPath) as Promise<string>;
  },
  deleteFolder(targetPath: string) {
    return ipcRenderer.invoke("workspace:deleteFolder", targetPath) as Promise<string>;
  },
  createFolder(parentDir: string, folderName: string) {
    return ipcRenderer.invoke("workspace:createFolder", parentDir, folderName) as Promise<
      WorkspaceSnapshot["tree"] | null
    >;
  },
  searchWorkspace(query: string) {
    return ipcRenderer.invoke("workspace:search", query) as Promise<SearchResult[]>;
  },
  listTasks() {
    return ipcRenderer.invoke("tasks:list") as Promise<TaskIndexSnapshot>;
  },
  refreshTasks() {
    return ipcRenderer.invoke("tasks:refresh") as Promise<TaskIndexSnapshot>;
  },
  updateTask(input: TaskUpdateInput) {
    return ipcRenderer.invoke("tasks:update", input) as Promise<TaskMutationResult>;
  },
  moveTask(input: TaskMoveInput) {
    return ipcRenderer.invoke("tasks:move", input) as Promise<TaskMutationResult>;
  },
  deleteTask(input: TaskDeleteInput) {
    return ipcRenderer.invoke("tasks:delete", input) as Promise<TaskMutationResult>;
  },
  createTask(input: TaskCreateInput) {
    return ipcRenderer.invoke("tasks:create", input) as Promise<TaskMutationResult>;
  },
  createTaskColumn(input: TaskColumnCreateInput) {
    return ipcRenderer.invoke("tasks:columns:create", input) as Promise<TaskMutationResult>;
  },
  updateTaskColumn(input: TaskColumnUpdateInput) {
    return ipcRenderer.invoke("tasks:columns:update", input) as Promise<TaskMutationResult>;
  },
  moveTaskColumn(input: TaskColumnMoveInput) {
    return ipcRenderer.invoke("tasks:columns:move", input) as Promise<TaskMutationResult>;
  },
  deleteTaskColumn(input: TaskColumnDeleteInput) {
    return ipcRenderer.invoke("tasks:columns:delete", input) as Promise<TaskMutationResult>;
  },
  archiveCompletedTasks() {
    return ipcRenderer.invoke("tasks:archive-completed") as Promise<TaskMutationResult>;
  },
  getArchivedTasks() {
    return ipcRenderer.invoke("tasks:get-archived") as Promise<ArchivedTaskEntry[]>;
  },
  unarchiveTask(input: TaskUnarchiveInput) {
    return ipcRenderer.invoke("tasks:unarchive", input) as Promise<TaskMutationResult>;
  },
  getSidebarNode(kind: "file" | "directory", targetPath: string) {
    return ipcRenderer.invoke("sidebar:getNode", kind, targetPath) as Promise<
      WorkspaceSnapshot["tree"][number] | null
    >;
  },
  getNoteBrowserEntries(targetPath: string | null) {
    return ipcRenderer.invoke("sidebar:getNoteBrowserEntries", targetPath) as Promise<
      import("../src/core/workspace.js").NoteBrowserEntry[]
    >;
  },
  getSettings() {
    return invokeWithRetry<AppSettings>("settings:get");
  },
  updateSettings(patch: Partial<AppSettings>) {
    return ipcRenderer.invoke("settings:update", patch) as Promise<AppSettings>;
  },
  getAppInfo() {
    return invokeWithRetry<AppInfo>("app:getInfo");
  },
  getUpdateState() {
    return invokeWithRetry<UpdateState>("app:getUpdateState");
  },
  checkForUpdates() {
    return ipcRenderer.invoke("app:checkForUpdates") as Promise<UpdateState>;
  },
  downloadUpdate() {
    return ipcRenderer.invoke("app:downloadUpdate") as Promise<UpdateState>;
  },
  installUpdate() {
    return ipcRenderer.invoke("app:installUpdate") as Promise<void>;
  },
  onWorkspaceChanged(listener: (event: WorkspaceChangeEvent) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: WorkspaceChangeEvent) => {
      listener(payload);
    };

    ipcRenderer.on("workspace:changed", wrapped);

    return () => {
      ipcRenderer.removeListener("workspace:changed", wrapped);
    };
  },
  onSkillLibraryChanged(listener: (event: SkillLibraryChangeEvent) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: SkillLibraryChangeEvent) => {
      listener(payload);
    };

    ipcRenderer.on("skills:changed", wrapped);

    return () => {
      ipcRenderer.removeListener("skills:changed", wrapped);
    };
  },
  onTasksChanged(listener: (snapshot: TaskIndexSnapshot) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TaskIndexSnapshot) => {
      listener(payload);
    };

    ipcRenderer.on("tasks:changed", wrapped);

    return () => {
      ipcRenderer.removeListener("tasks:changed", wrapped);
    };
  },
  onCommand(listener: (command: AppCommand) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, command: AppCommand) => {
      listener(command);
    };

    ipcRenderer.on("app:command", wrapped);

    return () => {
      ipcRenderer.removeListener("app:command", wrapped);
    };
  },
  getPendingExternalPath() {
    return invokeWithRetry<ExternalFileTarget | null>("app:getPendingExternalPath");
  },
  revealInFinder(targetPath: string) {
    return ipcRenderer.invoke("app:revealInFinder", targetPath) as Promise<boolean>;
  },
  onExternalFile(listener: (target: ExternalFileTarget) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, target: ExternalFileTarget) => {
      listener(target);
    };

    ipcRenderer.on("app:open-external", wrapped);

    return () => {
      ipcRenderer.removeListener("app:open-external", wrapped);
    };
  },
  onUpdateStateChange(listener: (state: UpdateState) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, state: UpdateState) => {
      listener(state);
    };

    ipcRenderer.on("app:updateState", wrapped);

    return () => {
      ipcRenderer.removeListener("app:updateState", wrapped);
    };
  },
  openExternal(path: string) {
    return ipcRenderer.invoke("app:openExternal", path);
  },
  saveBlob(filePath: string, base64Data: string) {
    return ipcRenderer.invoke("app:saveBlob", filePath, base64Data);
  },
  exportMarkdownToPDF(markdown: string, filename: string) {
    return ipcRenderer.invoke("app:exportPDF", markdown, filename) as Promise<string>;
  },
};

contextBridge.exposeInMainWorld("glyph", api);
