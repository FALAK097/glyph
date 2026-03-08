const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

import type {
  AppCommand,
  AppSettings,
  FileDocument,
  FileOpenResult,
  SearchResult,
  WorkspaceChangeEvent,
  WorkspaceSnapshot
} from "../src/shared/workspace.js";

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
  openDialog(kind: "file" | "directory") {
    return invokeWithRetry<FileOpenResult | null>("dialog:open", kind);
  },
  openFolder(dirPath?: string) {
    return invokeWithRetry<WorkspaceSnapshot | null>("workspace:openFolder", dirPath);
  },
  openDefaultWorkspace() {
    return invokeWithRetry<WorkspaceSnapshot | null>("workspace:openDefault");
  },
  openDocument() {
    return invokeWithRetry<FileDocument | null>("workspace:openDocument");
  },
  readFile(filePath: string) {
    return invokeWithRetry<FileDocument>("workspace:openFile", filePath);
  },
  saveFile(filePath: string, content: string) {
    return invokeWithRetry<FileDocument>("workspace:saveFile", filePath, content);
  },
  createFile(parentDir: string, fileName: string) {
    return invokeWithRetry<FileDocument>("workspace:createFile", parentDir, fileName);
  },
  createFolder(parentDir: string, folderName: string) {
    return invokeWithRetry<WorkspaceSnapshot["tree"]>("workspace:createFolder", parentDir, folderName);
  },
  searchWorkspace(query: string) {
    return invokeWithRetry<SearchResult[]>("workspace:search", query);
  },
  getSettings() {
    return invokeWithRetry<AppSettings>("settings:get");
  },
  updateSettings(patch: Partial<AppSettings>) {
    return invokeWithRetry<AppSettings>("settings:update", patch);
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
  onCommand(listener: (command: AppCommand) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, command: AppCommand) => {
      listener(command);
    };

    ipcRenderer.on("app:command", wrapped);

    return () => {
      ipcRenderer.removeListener("app:command", wrapped);
    };
  }
};

contextBridge.exposeInMainWorld("typist", api);
