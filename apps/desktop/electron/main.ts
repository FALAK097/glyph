import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { watch } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AppCommand,
  AppSettings,
  DirectoryNode,
  FileOpenResult,
  SearchResult,
  WorkspaceSnapshot
} from "../src/shared/workspace.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const devServerUrl = "http://127.0.0.1:5173";

let mainWindow: BrowserWindow | null = null;
let activeWatcher: ReturnType<typeof watch> | null = null;
let activeWorkspaceRoot: string | null = null;
let searchableFilesCache: string[] = [];
let settingsUpdatePromise: Promise<AppSettings> | null = null;

function isMarkdownFile(fileName: string) {
  return fileName.endsWith(".md") || fileName.endsWith(".markdown");
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getDefaultWorkspacePath() {
  return path.join(app.getPath("documents"), "Typist");
}

function getDefaultSettings(): AppSettings {
  return {
    defaultWorkspacePath: getDefaultWorkspacePath(),
    themeId: "aura",
    themeMode: "light",
    recentFiles: []
  };
}

function isThemeMode(value: unknown): value is AppSettings["themeMode"] {
  return value === "light" || value === "dark";
}

function sanitizeSettings(input: unknown): AppSettings {
  const defaults = getDefaultSettings();

  if (!input || typeof input !== "object") {
    return defaults;
  }

  const candidate = input as Partial<AppSettings>;

  return {
    defaultWorkspacePath:
      typeof candidate.defaultWorkspacePath === "string" && candidate.defaultWorkspacePath.trim().length > 0
        ? candidate.defaultWorkspacePath
        : defaults.defaultWorkspacePath,
    themeId: typeof candidate.themeId === "string" && candidate.themeId.trim().length > 0 ? candidate.themeId : defaults.themeId,
    themeMode: isThemeMode(candidate.themeMode) ? candidate.themeMode : defaults.themeMode,
    recentFiles: Array.isArray(candidate.recentFiles) ? candidate.recentFiles.filter((entry): entry is string => typeof entry === "string") : defaults.recentFiles
  };
}

function sanitizeSettingsPatch(patch: unknown): Partial<AppSettings> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Invalid settings payload.");
  }

  const candidate = patch as Record<string, unknown>;
  const nextPatch: Partial<AppSettings> = {};

  if ("defaultWorkspacePath" in candidate) {
    if (typeof candidate.defaultWorkspacePath !== "string" || candidate.defaultWorkspacePath.trim().length === 0) {
      throw new Error("defaultWorkspacePath must be a non-empty string.");
    }

    nextPatch.defaultWorkspacePath = candidate.defaultWorkspacePath;
  }

  if ("themeId" in candidate) {
    if (typeof candidate.themeId !== "string" || candidate.themeId.trim().length === 0) {
      throw new Error("themeId must be a non-empty string.");
    }

    nextPatch.themeId = candidate.themeId;
  }

  if ("themeMode" in candidate) {
    if (!isThemeMode(candidate.themeMode)) {
      throw new Error("themeMode must be 'light' or 'dark'.");
    }

    nextPatch.themeMode = candidate.themeMode;
  }

  if ("recentFiles" in candidate) {
    if (!Array.isArray(candidate.recentFiles) || candidate.recentFiles.some((entry) => typeof entry !== "string")) {
      throw new Error("recentFiles must be an array of strings.");
    }

    nextPatch.recentFiles = candidate.recentFiles;
  }

  const invalidKeys = Object.keys(candidate).filter(
    (key) => !["defaultWorkspacePath", "themeId", "themeMode", "recentFiles"].includes(key)
  );

  if (invalidKeys.length > 0) {
    throw new Error(`Unsupported settings keys: ${invalidKeys.join(", ")}`);
  }

  return nextPatch;
}

async function loadSettings(): Promise<AppSettings> {
  const settingsPath = getSettingsPath();

  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return getDefaultSettings();
  }
}

async function saveSettings(nextSettings: AppSettings) {
  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(nextSettings, null, 2), "utf8");
  return nextSettings;
}

async function updateSettings(patch: Partial<AppSettings>) {
  settingsUpdatePromise = (settingsUpdatePromise ?? Promise.resolve(getDefaultSettings())).then(async () => {
    const current = await loadSettings();
    return saveSettings({
      ...current,
      ...patch
    });
  });

  return settingsUpdatePromise;
}

async function recordRecentFile(filePath: string) {
  const settings = await loadSettings();
  const recentFiles = [filePath, ...settings.recentFiles.filter((entry) => entry !== filePath)].slice(0, 8);
  await saveSettings({
    ...settings,
    recentFiles
  });
}

async function ensureWorkspace(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readMarkdownFile(filePath: string, recordRecent = false) {
  const content = await fs.readFile(filePath, "utf8");

  if (recordRecent) {
    await recordRecentFile(filePath);
  }

  return {
    path: filePath,
    name: path.basename(filePath),
    content
  };
}

async function buildDirectoryTree(dirPath: string): Promise<DirectoryNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const sorted = entries.sort((left, right) => {
    if (left.isDirectory() && !right.isDirectory()) {
      return -1;
    }
    if (!left.isDirectory() && right.isDirectory()) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });

  return Promise.all(
    sorted
      .filter((entry) => entry.isDirectory() || isMarkdownFile(entry.name))
      .map(async (entry) => {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          return {
            type: "directory" as const,
            name: entry.name,
            path: entryPath,
            children: await buildDirectoryTree(entryPath)
          };
        }

        return {
          type: "file" as const,
          name: entry.name,
          path: entryPath
        };
      })
  );
}

async function collectMarkdownFiles(nodes: DirectoryNode[]): Promise<string[]> {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.type === "file") {
      paths.push(node.path);
      continue;
    }

    paths.push(...(await collectMarkdownFiles(node.children)));
  }

  return paths;
}

async function openWorkspace(dirPath: string): Promise<WorkspaceSnapshot> {
  await ensureWorkspace(dirPath);
  activeWorkspaceRoot = dirPath;

  const tree = await buildDirectoryTree(dirPath);
  searchableFilesCache = await collectMarkdownFiles(tree);
  const activeFilePath = searchableFilesCache[0] ?? null;
  const activeFile = activeFilePath ? await readMarkdownFile(activeFilePath, true) : null;

  if (activeWatcher) {
    await activeWatcher.close();
  }

  activeWatcher = watch(dirPath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 150,
      pollInterval: 50
    }
  });

  activeWatcher.on("all", async (_eventName, changedPath) => {
    if (!mainWindow || !isMarkdownFile(changedPath)) {
      return;
    }

    const nextTree = await buildDirectoryTree(dirPath);
    searchableFilesCache = await collectMarkdownFiles(nextTree);
    mainWindow.webContents.send("workspace:changed", {
      rootPath: dirPath,
      tree: nextTree,
      changedPath
    });
  });

  return {
    rootPath: dirPath,
    tree,
    activeFile
  };
}

async function searchWorkspace(query: string): Promise<SearchResult[]> {
  if (!activeWorkspaceRoot || !query.trim()) {
    return [];
  }

  const needle = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const filePath of searchableFilesCache) {
    if (results.length >= 50) {
      break;
    }

    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const [index, lineContent] of lines.entries()) {
      if (!lineContent.toLowerCase().includes(needle)) {
        continue;
      }

      results.push({
        path: filePath,
        name: path.basename(filePath),
        line: index + 1,
        snippet: lineContent.trim().slice(0, 180)
      });

      if (results.length >= 50) {
        break;
      }
    }
  }

  return results;
}

async function showOpenDialog(kind: "file" | "directory"): Promise<FileOpenResult | null> {
  const properties: Array<"openFile" | "openDirectory" | "createDirectory"> =
    kind === "file" ? ["openFile"] : ["openDirectory", "createDirectory"];

  const result = await dialog.showOpenDialog({
    properties,
    filters:
      kind === "file"
        ? [{ name: "Markdown", extensions: ["md", "markdown"] }]
        : undefined
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return {
    kind,
    path: result.filePaths[0]
  };
}

async function loadRenderer(window: BrowserWindow) {
  if (!isDev) {
    await window.loadFile(path.join(__dirname, "../dist/index.html"));
    return;
  }

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await window.loadURL(devServerUrl);
      return;
    } catch (error) {
      if (attempt === 20) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f8f6f1",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    console.error("Renderer load failed:", { code, description, validatedUrl });
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("Preload failed:", preloadPath, error);
  });

  try {
    await loadRenderer(mainWindow);
  } catch (error) {
    console.error("Renderer bootstrap failed:", error);
    await mainWindow.loadURL(
      `data:text/html,${encodeURIComponent(
        "<!doctype html><meta charset='utf-8'><style>body{font-family:system-ui;padding:24px;line-height:1.5}</style><h1>Typist could not start the renderer.</h1><p>Check the dev server logs and restart <code>pnpm dev:desktop</code>.</p>"
      )}`
    );
  }

  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "New Note",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("app:command", "new-file" satisfies AppCommand)
        },
        {
          label: "Open File",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("app:command", "open-file" satisfies AppCommand)
        },
        {
          label: "Open Folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => mainWindow?.webContents.send("app:command", "open-folder" satisfies AppCommand)
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("app:command", "save" satisfies AppCommand)
        },
        { type: "separator" },
        {
          label: "Command Palette",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow?.webContents.send("app:command", "quick-open" satisfies AppCommand)
        }
      ]
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "toggleDevTools" }]
    }
  ]);

  Menu.setApplicationMenu(menu);
}

ipcMain.handle("dialog:open", async (_event, kind: "file" | "directory") => showOpenDialog(kind));

ipcMain.handle("workspace:openFolder", async (_event, dirPath?: string) => {
  let resolvedPath = dirPath;

  if (!resolvedPath) {
    const selection = await showOpenDialog("directory");
    resolvedPath = selection?.path;
  }

  if (!resolvedPath) {
    return null;
  }

  return openWorkspace(resolvedPath);
});

ipcMain.handle("workspace:openDefault", async () => {
  const settings = await loadSettings();
  return openWorkspace(settings.defaultWorkspacePath);
});

ipcMain.handle("workspace:openFile", async (_event, filePath: string) => readMarkdownFile(filePath, true));

ipcMain.handle("workspace:saveFile", async (_event, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, "utf8");
  return readMarkdownFile(filePath, false);
});

ipcMain.handle("workspace:createFile", async (_event, parentDir: string, fileName: string) => {
  const normalizedFileName = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const targetPath = path.join(parentDir, normalizedFileName);
  await fs.writeFile(targetPath, "", { flag: "wx" });
  return readMarkdownFile(targetPath, true);
});

ipcMain.handle("workspace:createFolder", async (_event, parentDir: string, folderName: string) => {
  await fs.mkdir(path.join(parentDir, folderName), { recursive: false });

  if (!activeWorkspaceRoot) {
    return [];
  }

  return buildDirectoryTree(activeWorkspaceRoot);
});

ipcMain.handle("workspace:search", async (_event, query: string) => searchWorkspace(query));

ipcMain.handle("workspace:openDocument", async () => {
  const selection = await showOpenDialog("file");

  if (!selection) {
    return null;
  }

  return readMarkdownFile(selection.path, true);
});

ipcMain.handle("settings:get", async () => loadSettings());

ipcMain.handle("settings:update", async (_event, patch: unknown) => {
  const sanitizedPatch = sanitizeSettingsPatch(patch);
  return updateSettings(sanitizedPatch);
});

app.whenReady().then(createWindow).catch((error) => {
  console.error("Failed to create initial window:", error);
});

app.on("window-all-closed", async () => {
  if (activeWatcher) {
    await activeWatcher.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createWindow();
    } catch (error) {
      console.error("Failed to recreate window on activate:", error);
    }
  }
});
