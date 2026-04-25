const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

import type {
  AppCommand,
  AppInfo,
  AssetSelection,
  AppSettings,
  ContextIndexEntry,
  ContextIndexStatus,
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
} from "../src/shared/workspace.js";
import type {
  SkillDocument,
  SkillLibraryChangeEvent,
  SkillLibrarySnapshot,
} from "../src/shared/skills.js";

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
  getContextIndexStatus() {
    return ipcRenderer.invoke("context-index:getStatus") as Promise<ContextIndexStatus>;
  },
  getContextIndexEntry(filePath: string) {
    return ipcRenderer.invoke(
      "context-index:getEntry",
      filePath,
    ) as Promise<ContextIndexEntry | null>;
  },
  getSidebarNode(kind: "file" | "directory", targetPath: string) {
    return ipcRenderer.invoke("sidebar:getNode", kind, targetPath) as Promise<
      WorkspaceSnapshot["tree"][number] | null
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
  onContextIndexStatusChange(listener: (status: ContextIndexStatus) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, status: ContextIndexStatus) => {
      listener(status);
    };

    ipcRenderer.on("context-index:status", wrapped);

    return () => {
      ipcRenderer.removeListener("context-index:status", wrapped);
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
