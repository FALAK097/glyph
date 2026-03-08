import { contextBridge, ipcRenderer } from "electron";
import type {
  AppCommand,
  AppSettings,
  FileDocument,
  FileOpenResult,
  SearchResult,
  WorkspaceChangeEvent,
  WorkspaceSnapshot
} from "../src/shared/workspace.js";

const api = {
  openDialog(kind: "file" | "directory") {
    return ipcRenderer.invoke("dialog:open", kind) as Promise<FileOpenResult | null>;
  },
  openFolder(dirPath?: string) {
    return ipcRenderer.invoke("workspace:openFolder", dirPath) as Promise<WorkspaceSnapshot | null>;
  },
  openDefaultWorkspace() {
    return ipcRenderer.invoke("workspace:openDefault") as Promise<WorkspaceSnapshot | null>;
  },
  openDocument() {
    return ipcRenderer.invoke("workspace:openDocument") as Promise<FileDocument | null>;
  },
  readFile(filePath: string) {
    return ipcRenderer.invoke("workspace:openFile", filePath) as Promise<FileDocument>;
  },
  saveFile(filePath: string, content: string) {
    return ipcRenderer.invoke("workspace:saveFile", filePath, content) as Promise<FileDocument>;
  },
  createFile(parentDir: string, fileName: string) {
    return ipcRenderer.invoke("workspace:createFile", parentDir, fileName) as Promise<FileDocument>;
  },
  createFolder(parentDir: string, folderName: string) {
    return ipcRenderer.invoke("workspace:createFolder", parentDir, folderName) as Promise<WorkspaceSnapshot["tree"]>;
  },
  searchWorkspace(query: string) {
    return ipcRenderer.invoke("workspace:search", query) as Promise<SearchResult[]>;
  },
  getSettings() {
    return ipcRenderer.invoke("settings:get") as Promise<AppSettings>;
  },
  updateSettings(patch: Partial<AppSettings>) {
    return ipcRenderer.invoke("settings:update", patch) as Promise<AppSettings>;
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
