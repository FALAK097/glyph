import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  shell,
} from "electron";
import electronUpdater from "electron-updater";
import { watch } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createSkillsService } from "./skills-service.js";
import type {
  AppCommand,
  AppInfo,
  AssetSelection,
  AppSettings,
  DialogKind,
  DirectoryNode,
  FileOpenResult,
  ResolvedLinkTarget,
  SearchResult,
  UpdateState,
  WorkspaceSnapshot,
} from "../src/shared/workspace.js";
import {
  DEFAULT_SHORTCUTS,
  canonicalizeShortcut,
  mergeShortcutSettings,
  toElectronAccelerator,
} from "../src/shared/shortcuts.js";

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged || process.env.GLYPH_DEV_APP === "1";
const devServerUrl = "http://127.0.0.1:5173";
const localAssetProtocol = "glyph-local";
const APP_NAME = "Glyph";
const STARTUP_LIGHT_BACKGROUND = "#f8f7fb";
const STARTUP_DARK_BACKGROUND = "#1f1b26";
const GITHUB_RELEASES_URL = "https://github.com/FALAK097/glyph/releases";
const GITHUB_LATEST_RELEASE_API_URL = "https://api.github.com/repos/FALAK097/glyph/releases/latest";

type PersistedUpdateState = {
  stagedVersion: string | null;
  stagedReleaseName: string | null;
  stagedReleaseNotes: string | null;
  recentlyInstalledVersion: string | null;
};

// Set app name early
app.setName(APP_NAME);
app.setAppUserModelId("com.glyph.app");

const iconFileName =
  process.platform === "win32"
    ? "icon.ico"
    : process.platform === "darwin"
      ? "icon.icns"
      : "icon.png";
const iconPath = path.join(__dirname, "../public", iconFileName);

let mainWindow: BrowserWindow | null = null;
let activeWatcher: ReturnType<typeof watch> | null = null;
let activeWorkspaceRoot: string | null = null;
let searchableFilesCache: string[] = [];
let settingsUpdatePromise: Promise<AppSettings> | null = null;
let pendingExternalPath: string | null = null;
let updateCheckInterval: NodeJS.Timeout | null = null;
const MARKDOWN_EXTENSIONS = [".md", ".mdx", ".markdown"] as const;
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6;
const skillsService = createSkillsService({
  projectRoot: null,
  onLibraryChanged: (event) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send("skills:changed", event);
  },
});

function createDefaultPersistedUpdateState(): PersistedUpdateState {
  return {
    stagedVersion: null,
    stagedReleaseName: null,
    stagedReleaseNotes: null,
    recentlyInstalledVersion: null,
  };
}

function buildRendererFailurePage() {
  const message = isDev
    ? "Check the dev server logs and restart <code>pnpm dev:desktop</code>."
    : "The packaged renderer bundle could not be loaded. Please reinstall Glyph or download the latest release.";

  return `<!doctype html><meta charset='utf-8'><style>body{font-family:system-ui;padding:24px;line-height:1.5}</style><h1>Glyph could not start the renderer.</h1><p>${message}</p>`;
}

function createDefaultUpdateState(): UpdateState {
  return {
    status: "idle",
    currentVersion: app.getVersion(),
    availableVersion: null,
    downloadedVersion: null,
    recentlyInstalledVersion: null,
    releasePageUrl: null,
    releaseName: null,
    releaseNotes: null,
    progressPercent: null,
    checkedAt: null,
    errorMessage: null,
  };
}

let updateState: UpdateState = createDefaultUpdateState();
let persistedUpdateState = createDefaultPersistedUpdateState();
let persistedUpdateStateWritePromise: Promise<PersistedUpdateState> | null = null;

function getUpdatesMode(): AppInfo["updatesMode"] {
  if (!app.isPackaged || isDev) {
    return "none";
  }

  if (process.platform === "win32") {
    return "automatic";
  }

  if (process.platform === "darwin") {
    return "manual";
  }

  return "none";
}

function getAppInfo(): AppInfo {
  const updatesMode = getUpdatesMode();

  return {
    name: APP_NAME,
    version: app.getVersion(),
    isPackaged: app.isPackaged && !isDev,
    platform: process.platform,
    updatesEnabled: updatesMode !== "none",
    updatesMode,
  };
}

function broadcastUpdateState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("app:updateState", updateState);
}

function setUpdateState(patch: Partial<UpdateState>) {
  updateState = {
    ...updateState,
    currentVersion: app.getVersion(),
    ...patch,
  };
  broadcastUpdateState();
}

function normalizeReleaseNotes(
  releaseNotes: string | Array<{ note?: string | null }> | null | undefined,
) {
  if (typeof releaseNotes === "string") {
    return releaseNotes.trim() || null;
  }

  if (Array.isArray(releaseNotes)) {
    const notes = releaseNotes
      .map((entry) => entry.note?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");
    return notes || null;
  }

  return null;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "");
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left)
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10));
  const rightParts = normalizeVersion(right)
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

type GitHubLatestReleaseResponse = {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  html_url?: string;
};

function sanitizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

async function fetchLatestGitHubRelease() {
  const response = await net.fetch(GITHUB_LATEST_RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": APP_NAME,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GitHubLatestReleaseResponse;
  const version = sanitizeNullableString(payload.tag_name);

  if (!version) {
    throw new Error("GitHub latest release did not include a version tag.");
  }

  const normalizedVersion = normalizeVersion(version);
  return {
    version: normalizedVersion,
    releaseName: sanitizeNullableString(payload.name) ?? `${APP_NAME} ${normalizedVersion}`,
    releaseNotes: sanitizeNullableString(payload.body),
    releasePageUrl: sanitizeNullableString(payload.html_url) ?? GITHUB_RELEASES_URL,
  };
}

function getPersistedUpdateStatePath() {
  return path.join(app.getPath("userData"), "update-state.json");
}

function sanitizePersistedUpdateState(input: unknown): PersistedUpdateState {
  if (!input || typeof input !== "object") {
    return createDefaultPersistedUpdateState();
  }

  const candidate = input as Record<string, unknown>;
  return {
    stagedVersion: sanitizeNullableString(candidate.stagedVersion),
    stagedReleaseName: sanitizeNullableString(candidate.stagedReleaseName),
    stagedReleaseNotes: sanitizeNullableString(candidate.stagedReleaseNotes),
    recentlyInstalledVersion: sanitizeNullableString(candidate.recentlyInstalledVersion),
  };
}

async function loadPersistedUpdateState() {
  try {
    const raw = await fs.readFile(getPersistedUpdateStatePath(), "utf8");
    return sanitizePersistedUpdateState(JSON.parse(raw));
  } catch {
    return createDefaultPersistedUpdateState();
  }
}

async function savePersistedUpdateState(next: PersistedUpdateState) {
  const statePath = getPersistedUpdateStatePath();
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function queuePersistedUpdateStateWrite(next: PersistedUpdateState) {
  persistedUpdateState = next;

  const write = async () => {
    try {
      return await savePersistedUpdateState(next);
    } catch (error) {
      console.error("Failed to persist updater state:", error);
      return next;
    }
  };

  persistedUpdateStateWritePromise = (
    persistedUpdateStateWritePromise ?? Promise.resolve(next)
  ).then(write, write);

  return persistedUpdateStateWritePromise;
}

function persistUpdateStatePatch(patch: Partial<PersistedUpdateState>) {
  const next = {
    ...persistedUpdateState,
    ...patch,
  };

  void queuePersistedUpdateStateWrite(next);
}

async function hydratePersistedUpdateState() {
  const loadedState = await loadPersistedUpdateState();
  const currentVersion = app.getVersion();
  let nextPersistedUpdateState = loadedState;

  if (loadedState.stagedVersion === currentVersion) {
    nextPersistedUpdateState = {
      ...loadedState,
      stagedVersion: null,
      stagedReleaseName: null,
      stagedReleaseNotes: null,
      recentlyInstalledVersion: currentVersion,
    };
  } else if (
    loadedState.recentlyInstalledVersion &&
    loadedState.recentlyInstalledVersion !== currentVersion
  ) {
    nextPersistedUpdateState = {
      ...loadedState,
      recentlyInstalledVersion: null,
    };
  }

  persistedUpdateState = nextPersistedUpdateState;

  if (JSON.stringify(nextPersistedUpdateState) !== JSON.stringify(loadedState)) {
    void queuePersistedUpdateStateWrite(nextPersistedUpdateState);
  }

  if (
    nextPersistedUpdateState.stagedVersion &&
    nextPersistedUpdateState.stagedVersion !== currentVersion
  ) {
    setUpdateState({
      status: "downloaded",
      availableVersion: nextPersistedUpdateState.stagedVersion,
      downloadedVersion: nextPersistedUpdateState.stagedVersion,
      recentlyInstalledVersion: nextPersistedUpdateState.recentlyInstalledVersion,
      releasePageUrl: null,
      releaseName: nextPersistedUpdateState.stagedReleaseName,
      releaseNotes: nextPersistedUpdateState.stagedReleaseNotes,
      progressPercent: 100,
      checkedAt: new Date().toISOString(),
      errorMessage: null,
    });
    return;
  }

  setUpdateState({
    recentlyInstalledVersion: nextPersistedUpdateState.recentlyInstalledVersion,
  });
}

function shouldPreserveUpdateState(updateStatus: UpdateState["status"]) {
  return updateStatus === "downloading" || updateStatus === "downloaded";
}

function handleAutoUpdaterError(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const checkedAt = new Date().toISOString();

  if (updateState.status === "downloaded") {
    setUpdateState({
      checkedAt,
      errorMessage,
      progressPercent: 100,
    });
    return;
  }

  if (updateState.status === "downloading" || updateState.status === "available") {
    setUpdateState({
      status: "available",
      checkedAt,
      errorMessage,
      progressPercent: null,
    });
    return;
  }

  setUpdateState({
    status: "error",
    checkedAt,
    errorMessage,
    progressPercent: null,
  });
}

async function checkForManualReleaseUpdates() {
  try {
    const latestRelease = await fetchLatestGitHubRelease();
    const checkedAt = new Date().toISOString();

    if (compareVersions(latestRelease.version, app.getVersion()) <= 0) {
      setUpdateState({
        status: "not-available",
        availableVersion: null,
        downloadedVersion: null,
        recentlyInstalledVersion: updateState.recentlyInstalledVersion,
        releasePageUrl: null,
        releaseName: null,
        releaseNotes: null,
        checkedAt,
        errorMessage: null,
        progressPercent: null,
      });
      return updateState;
    }

    setUpdateState({
      status: "available",
      availableVersion: latestRelease.version,
      downloadedVersion: null,
      releasePageUrl: latestRelease.releasePageUrl,
      releaseName: latestRelease.releaseName,
      releaseNotes: latestRelease.releaseNotes,
      checkedAt,
      errorMessage: null,
      progressPercent: null,
    });
  } catch (error) {
    setUpdateState({
      status: "error",
      availableVersion: null,
      downloadedVersion: null,
      releasePageUrl: null,
      releaseName: null,
      releaseNotes: null,
      checkedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
      progressPercent: null,
    });
  }

  return updateState;
}

function wireAutoUpdater() {
  if (getUpdatesMode() !== "automatic") {
    setUpdateState({
      status: "idle",
      releasePageUrl: null,
      checkedAt: new Date().toISOString(),
      errorMessage: null,
    });
    return;
  }

  autoUpdater.autoDownload = false;
  // Keep the downloaded update staged until the user explicitly installs it.
  // On macOS, enabling install-on-quit starts an extra native updater handoff
  // immediately after download, which can emit an error and clear the install CTA
  // before the user gets a chance to apply the update.
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    if (shouldPreserveUpdateState(updateState.status)) {
      setUpdateState({
        checkedAt: new Date().toISOString(),
        errorMessage: null,
      });
      return;
    }

    setUpdateState({
      status: "checking",
      releasePageUrl: null,
      checkedAt: new Date().toISOString(),
      errorMessage: null,
      progressPercent: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    setUpdateState({
      status: "available",
      availableVersion: info.version ?? null,
      downloadedVersion: null,
      releasePageUrl: null,
      releaseName: info.releaseName ?? null,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      checkedAt: new Date().toISOString(),
      errorMessage: null,
      progressPercent: null,
    });

    if (updateState.status !== "downloading" && updateState.status !== "downloaded") {
      void downloadAppUpdate();
    }
  });

  autoUpdater.on("update-not-available", () => {
    if (shouldPreserveUpdateState(updateState.status)) {
      setUpdateState({
        checkedAt: new Date().toISOString(),
        errorMessage: null,
      });
      return;
    }

    setUpdateState({
      status: "not-available",
      availableVersion: null,
      downloadedVersion: null,
      releasePageUrl: null,
      releaseName: null,
      releaseNotes: null,
      checkedAt: new Date().toISOString(),
      errorMessage: null,
      progressPercent: null,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setUpdateState({
      status: "downloading",
      progressPercent: progress.percent,
      errorMessage: null,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    const releaseNotes = normalizeReleaseNotes(info.releaseNotes);

    persistUpdateStatePatch({
      stagedVersion: info.version ?? null,
      stagedReleaseName: info.releaseName ?? null,
      stagedReleaseNotes: releaseNotes,
    });

    setUpdateState({
      status: "downloaded",
      availableVersion: info.version ?? null,
      downloadedVersion: info.version ?? null,
      recentlyInstalledVersion: persistedUpdateState.recentlyInstalledVersion,
      releasePageUrl: null,
      releaseName: info.releaseName ?? null,
      releaseNotes,
      checkedAt: new Date().toISOString(),
      errorMessage: null,
      progressPercent: 100,
    });
  });

  autoUpdater.on("error", (error) => {
    handleAutoUpdaterError(error);
  });
}

async function checkForAppUpdates() {
  const updatesMode = getUpdatesMode();

  if (updatesMode === "none") {
    return updateState;
  }

  if (updatesMode === "manual") {
    if (updateState.status === "downloading" || updateState.status === "downloaded") {
      return updateState;
    }

    return checkForManualReleaseUpdates();
  }

  if (shouldPreserveUpdateState(updateState.status)) {
    return updateState;
  }

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    handleAutoUpdaterError(error);
  }

  return updateState;
}

async function downloadAppUpdate() {
  if (getUpdatesMode() !== "automatic") {
    return updateState;
  }

  if (updateState.status === "downloaded" || updateState.status === "downloading") {
    return updateState;
  }

  setUpdateState({
    status: "downloading",
    releasePageUrl: null,
    progressPercent: 0,
    errorMessage: null,
  });

  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    handleAutoUpdaterError(error);
  }

  return updateState;
}

function getMarkdownExtension(fileName: string) {
  const normalizedFileName = fileName.toLowerCase();
  return MARKDOWN_EXTENSIONS.find((extension) => normalizedFileName.endsWith(extension)) ?? null;
}

function isMarkdownFile(fileName: string) {
  return getMarkdownExtension(fileName) !== null;
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getDefaultWorkspacePath() {
  return path.join(app.getPath("documents"), "Glyph");
}

function buildLocalAssetUrl(targetPath: string) {
  return `${localAssetProtocol}://asset?path=${encodeURIComponent(targetPath)}`;
}

function stripLocalLinkSuffix(target: string) {
  const match = target.match(/[?#]/);
  if (!match || match.index === undefined) {
    return target;
  }

  return target.slice(0, match.index);
}

function normalizePathForComparison(targetPath: string) {
  return path.normalize(targetPath).toLowerCase();
}

function isMarkdownReference(target: string) {
  const normalizedTarget = stripLocalLinkSuffix(target).toLowerCase();
  return (
    MARKDOWN_EXTENSIONS.some((extension) => normalizedTarget.endsWith(extension)) ||
    (!path.extname(normalizedTarget) &&
      !normalizedTarget.includes(".") &&
      normalizedTarget.length > 0)
  );
}

async function resolveExistingFilePath(targetPath: string) {
  const candidates = [targetPath];

  if (!path.extname(targetPath)) {
    candidates.push(...MARKDOWN_EXTENSIONS.map((extension) => `${targetPath}${extension}`));
  }

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveWorkspaceMarkdownTarget(target: string) {
  if (!activeWorkspaceRoot || !isMarkdownReference(target)) {
    return null;
  }

  const localTarget = stripLocalLinkSuffix(target);
  const workspaceRelativePath = path.join(activeWorkspaceRoot, localTarget);
  const workspaceRelativeMatch = await resolveExistingFilePath(workspaceRelativePath);
  if (workspaceRelativeMatch) {
    return workspaceRelativeMatch;
  }

  const normalizedTarget = normalizePathForComparison(localTarget);
  const normalizedBaseName = normalizePathForComparison(path.basename(localTarget));
  const matches = searchableFilesCache.filter((filePath) => {
    const normalizedFilePath = normalizePathForComparison(filePath);
    const normalizedRelativePath = normalizePathForComparison(
      path.relative(activeWorkspaceRoot as string, filePath),
    );

    return (
      normalizedFilePath === normalizedTarget ||
      normalizedRelativePath === normalizedTarget ||
      normalizePathForComparison(path.basename(filePath)) === normalizedBaseName
    );
  });

  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

async function resolveLinkTarget(
  currentFilePath: string | null,
  href: string,
): Promise<ResolvedLinkTarget | null> {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: "external", target: trimmed };
  }

  if (trimmed.startsWith("#")) {
    return null;
  }

  if (trimmed.startsWith(`${localAssetProtocol}://`)) {
    const target = new URL(trimmed).searchParams.get("path");
    if (!target) {
      return null;
    }

    return {
      kind: isMarkdownFile(target) ? "markdown-file" : "file",
      target: path.normalize(target),
    };
  }

  if (trimmed.startsWith("file://")) {
    const target = fileURLToPath(trimmed);
    return {
      kind: isMarkdownFile(target) ? "markdown-file" : "file",
      target,
    };
  }

  const localTarget = stripLocalLinkSuffix(trimmed);
  const resolvedPath = path.isAbsolute(localTarget)
    ? path.normalize(localTarget)
    : currentFilePath
      ? path.resolve(path.dirname(currentFilePath), localTarget)
      : activeWorkspaceRoot
        ? path.resolve(activeWorkspaceRoot, localTarget)
        : null;

  if (!resolvedPath) {
    return null;
  }

  const existingPath =
    (await resolveExistingFilePath(resolvedPath)) ??
    (await resolveWorkspaceMarkdownTarget(trimmed));
  if (!existingPath) {
    if (/^[\w-]+(?:\.[\w-]+)+(?:[/?#].*)?$/i.test(trimmed)) {
      return { kind: "external", target: `https://${trimmed}` };
    }

    return null;
  }

  return {
    kind: isMarkdownFile(existingPath) ? "markdown-file" : "file",
    target: existingPath,
  };
}

function getDefaultSettings(): AppSettings {
  return {
    defaultWorkspacePath: getDefaultWorkspacePath(),
    themeId: "aura",
    themeMode: "light",
    hiddenFiles: [],
    pinnedFiles: [],
    shortcuts: DEFAULT_SHORTCUTS,
    sidebar: {
      items: [],
      expandedFolders: [],
    },
    editorPreferences: {
      focusMode: false,
      showOutline: true,
    },
    autoOpenPDF: true,
  };
}

function normalizeSidebarState(sidebar: Partial<AppSettings["sidebar"]> | undefined) {
  const items = Array.isArray(sidebar?.items)
    ? sidebar.items.filter(
        (entry): entry is AppSettings["sidebar"]["items"][number] =>
          (entry?.kind === "file" || entry?.kind === "directory") &&
          typeof entry.path === "string" &&
          entry.path.trim().length > 0,
      )
    : [];

  const expandedFolders = Array.isArray(sidebar?.expandedFolders)
    ? sidebar.expandedFolders.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

  return {
    items,
    expandedFolders: Array.from(new Set(expandedFolders)),
  };
}

function isThemeMode(value: unknown): value is AppSettings["themeMode"] {
  return value === "light" || value === "dark" || value === "system";
}

function normalizeShortcutSettings(shortcuts: AppSettings["shortcuts"] | undefined) {
  return mergeShortcutSettings(shortcuts).map(({ id, keys }) => ({ id, keys }));
}

function normalizePersistedFileList(input: unknown) {
  return Array.isArray(input)
    ? input.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function normalizeEditorPreferences(
  input: Partial<AppSettings["editorPreferences"]> | undefined,
): AppSettings["editorPreferences"] {
  return {
    focusMode: typeof input?.focusMode === "boolean" ? input.focusMode : false,
    showOutline: typeof input?.showOutline === "boolean" ? input.showOutline : true,
  };
}

function validateShortcutSettings(shortcuts: AppSettings["shortcuts"]) {
  const normalized = normalizeShortcutSettings(shortcuts);
  const seen = new Map<string, string>();

  for (const shortcut of normalized) {
    const key = canonicalizeShortcut(shortcut.keys);
    if (!key) {
      throw new Error(`Invalid shortcut for ${shortcut.id}.`);
    }

    const duplicate = seen.get(key);
    if (duplicate && duplicate !== shortcut.id) {
      throw new Error(`Duplicate shortcut assigned to ${duplicate} and ${shortcut.id}.`);
    }

    seen.set(key, shortcut.id);
  }

  return normalized;
}

function buildApplicationMenu(shortcuts: AppSettings["shortcuts"]) {
  const resolvedShortcuts = normalizeShortcutSettings(shortcuts);
  const getAccelerator = (id: string) => {
    const keys = resolvedShortcuts.find((shortcut) => shortcut.id === id)?.keys;
    return keys ? toElectronAccelerator(keys) : undefined;
  };
  const checkForUpdatesItem: Electron.MenuItemConstructorOptions = {
    label: "Check for Updates",
    accelerator: getAccelerator("check-updates"),
    click: () =>
      mainWindow?.webContents.send("app:command", "check-updates" satisfies AppCommand),
  };
  const focusModeItem: Electron.MenuItemConstructorOptions = {
    label: "Toggle Focus Mode",
    accelerator: getAccelerator("focus-mode"),
    click: () => mainWindow?.webContents.send("app:command", "focus-mode" satisfies AppCommand),
  };

  const viewSubmenu: Electron.MenuItemConstructorOptions[] = isDev
    ? [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        focusModeItem,
      ]
    : [{ role: "togglefullscreen" }, { type: "separator" }, focusModeItem];

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Note",
          accelerator: getAccelerator("new-note"),
          click: () => mainWindow?.webContents.send("app:command", "new-file" satisfies AppCommand),
        },
        {
          label: "Open File",
          accelerator: getAccelerator("open-file"),
          click: () =>
            mainWindow?.webContents.send("app:command", "open-file" satisfies AppCommand),
        },
        {
          label: "Open Folder",
          accelerator: getAccelerator("open-folder"),
          click: () =>
            mainWindow?.webContents.send("app:command", "open-folder" satisfies AppCommand),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: getAccelerator("save"),
          click: () => mainWindow?.webContents.send("app:command", "save" satisfies AppCommand),
        },
        { type: "separator" },
        {
          label: "Toggle Sidebar",
          accelerator: getAccelerator("toggle-sidebar"),
          click: () =>
            mainWindow?.webContents.send("app:command", "toggle-sidebar" satisfies AppCommand),
        },
        { type: "separator" },
        {
          label: "Command Palette",
          accelerator: getAccelerator("command-palette"),
          click: () =>
            mainWindow?.webContents.send("app:command", "quick-open" satisfies AppCommand),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: viewSubmenu,
    },
  ];

  if (process.platform === "darwin") {
    menuTemplate.unshift({
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        checkForUpdatesItem,
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  } else {
    menuTemplate.push({
      label: "Help",
      submenu: [checkForUpdatesItem],
    });
  }

  return Menu.buildFromTemplate(menuTemplate);
}

function refreshApplicationMenu(shortcuts: AppSettings["shortcuts"]) {
  Menu.setApplicationMenu(buildApplicationMenu(shortcuts));
}

async function sanitizeSettingsWithFileValidation(input: unknown): Promise<AppSettings> {
  const defaults = getDefaultSettings();

  if (!input || typeof input !== "object") {
    return defaults;
  }

  const candidate = input as Partial<AppSettings>;
  const validPinnedFiles: string[] = [];
  const validHiddenFiles: string[] = [];
  const persistedFileGroups = [
    [normalizePersistedFileList(candidate.hiddenFiles), validHiddenFiles],
    [normalizePersistedFileList(candidate.pinnedFiles), validPinnedFiles],
  ] as const;

  for (const [inputPaths, target] of persistedFileGroups) {
    for (const filePath of inputPaths) {
      try {
        await fs.access(filePath);
        target.push(filePath);
      } catch {
        // Skip files that don't exist or can't be accessed.
      }
    }
  }

  const validSidebar = normalizeSidebarState(candidate.sidebar);
  const validSidebarItems: AppSettings["sidebar"]["items"] = [];

  for (const item of validSidebar.items) {
    try {
      const stats = await fs.stat(item.path);
      if (
        (item.kind === "file" && stats.isFile()) ||
        (item.kind === "directory" && stats.isDirectory())
      ) {
        validSidebarItems.push(item);
      }
    } catch {
      // Skip sidebar entries that no longer exist.
    }
  }

  const validExpandedFolders: string[] = [];
  for (const folderPath of validSidebar.expandedFolders) {
    try {
      const stats = await fs.stat(folderPath);
      if (stats.isDirectory()) {
        validExpandedFolders.push(folderPath);
      }
    } catch {
      // Skip folders that no longer exist.
    }
  }

  return {
    defaultWorkspacePath:
      typeof candidate.defaultWorkspacePath === "string" &&
      candidate.defaultWorkspacePath.trim().length > 0
        ? candidate.defaultWorkspacePath
        : defaults.defaultWorkspacePath,
    themeId:
      typeof candidate.themeId === "string" && candidate.themeId.trim().length > 0
        ? candidate.themeId
        : defaults.themeId,
    themeMode: isThemeMode(candidate.themeMode) ? candidate.themeMode : defaults.themeMode,
    hiddenFiles: Array.from(new Set(validHiddenFiles)),
    pinnedFiles: Array.from(new Set(validPinnedFiles)),
    shortcuts: Array.isArray(candidate.shortcuts)
      ? normalizeShortcutSettings(
          candidate.shortcuts.filter(
            (s): s is { id: string; keys: string } =>
              typeof s?.id === "string" && typeof s?.keys === "string",
          ),
        )
      : defaults.shortcuts,
    sidebar: {
      items: validSidebarItems,
      expandedFolders: Array.from(new Set(validExpandedFolders)),
    },
    editorPreferences: normalizeEditorPreferences(candidate.editorPreferences),
    autoOpenPDF:
      typeof candidate.autoOpenPDF === "boolean" ? candidate.autoOpenPDF : defaults.autoOpenPDF,
  };
}

function sanitizeSettingsPatch(patch: unknown): Partial<AppSettings> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Invalid settings payload.");
  }

  const candidate = patch as Record<string, unknown>;
  const nextPatch: Partial<AppSettings> = {};

  if ("defaultWorkspacePath" in candidate) {
    if (
      typeof candidate.defaultWorkspacePath !== "string" ||
      candidate.defaultWorkspacePath.trim().length === 0
    ) {
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
      throw new Error("themeMode must be 'light', 'dark', or 'system'.");
    }

    nextPatch.themeMode = candidate.themeMode;
  }

  if ("pinnedFiles" in candidate) {
    if (
      !Array.isArray(candidate.pinnedFiles) ||
      candidate.pinnedFiles.some((entry) => typeof entry !== "string")
    ) {
      throw new Error("pinnedFiles must be an array of strings.");
    }

    nextPatch.pinnedFiles = candidate.pinnedFiles;
  }

  if ("hiddenFiles" in candidate) {
    if (
      !Array.isArray(candidate.hiddenFiles) ||
      candidate.hiddenFiles.some((entry) => typeof entry !== "string")
    ) {
      throw new Error("hiddenFiles must be an array of strings.");
    }

    nextPatch.hiddenFiles = candidate.hiddenFiles;
  }

  if ("shortcuts" in candidate) {
    if (
      !Array.isArray(candidate.shortcuts) ||
      candidate.shortcuts.some((s) => typeof s?.id !== "string" || typeof s?.keys !== "string")
    ) {
      throw new Error("shortcuts must be an array of { id: string, keys: string }.");
    }

    nextPatch.shortcuts = validateShortcutSettings(candidate.shortcuts);
  }

  if ("sidebar" in candidate) {
    if (
      !candidate.sidebar ||
      typeof candidate.sidebar !== "object" ||
      Array.isArray(candidate.sidebar)
    ) {
      throw new Error("sidebar must be an object.");
    }

    nextPatch.sidebar = normalizeSidebarState(candidate.sidebar as Partial<AppSettings["sidebar"]>);
  }

  if ("editorPreferences" in candidate) {
    if (
      !candidate.editorPreferences ||
      typeof candidate.editorPreferences !== "object" ||
      Array.isArray(candidate.editorPreferences)
    ) {
      throw new Error("editorPreferences must be an object.");
    }

    nextPatch.editorPreferences = normalizeEditorPreferences(
      candidate.editorPreferences as Partial<AppSettings["editorPreferences"]>,
    );
  }

  if ("autoOpenPDF" in candidate) {
    if (typeof candidate.autoOpenPDF !== "boolean") {
      throw new Error("autoOpenPDF must be a boolean.");
    }

    nextPatch.autoOpenPDF = candidate.autoOpenPDF;
  }

  const invalidKeys = Object.keys(candidate).filter(
    (key) =>
      ![
        "defaultWorkspacePath",
        "themeId",
        "themeMode",
        "hiddenFiles",
        "pinnedFiles",
        "shortcuts",
        "sidebar",
        "editorPreferences",
        "autoOpenPDF",
      ].includes(key),
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
    return await sanitizeSettingsWithFileValidation(JSON.parse(raw));
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
  settingsUpdatePromise = (settingsUpdatePromise ?? Promise.resolve(getDefaultSettings())).then(
    async () => {
      const current = await loadSettings();
      return saveSettings({
        ...current,
        ...patch,
      });
    },
  );

  return settingsUpdatePromise;
}
async function ensureWorkspace(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readMarkdownFile(filePath: string) {
  try {
    // Check if file exists first
    await fs.access(filePath);
  } catch (err) {
    const code =
      typeof err === "object" && err && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }

  const content = (await fs.readFile(filePath, "utf8")).replace(/\r\n?/g, "\n");

  return {
    path: filePath,
    name: path.basename(filePath),
    content,
  };
}

async function getSidebarNode(
  kind: "file" | "directory",
  targetPath: string,
): Promise<DirectoryNode | null> {
  try {
    const stats = await fs.stat(targetPath);

    if (kind === "file") {
      if (!stats.isFile() || !isMarkdownFile(targetPath)) {
        return null;
      }

      return {
        type: "file",
        name: path.basename(targetPath),
        path: targetPath,
      };
    }

    if (!stats.isDirectory()) {
      return null;
    }

    return {
      type: "directory",
      name: path.basename(targetPath),
      path: targetPath,
      children: await buildDirectoryTree(targetPath),
    };
  } catch {
    return null;
  }
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

  const results = await Promise.all(
    sorted
      .filter((entry) => entry.isDirectory() || isMarkdownFile(entry.name))
      .map(async (entry) => {
        const entryPath = path.join(dirPath, entry.name);

        try {
          if (entry.isDirectory()) {
            return {
              type: "directory" as const,
              name: entry.name,
              path: entryPath,
              children: await buildDirectoryTree(entryPath),
            };
          }

          return {
            type: "file" as const,
            name: entry.name,
            path: entryPath,
          };
        } catch {
          // Skip files/directories that can't be accessed
          return null;
        }
      }),
  );

  // Filter out null values (inaccessible entries)
  return results.filter((node) => node !== null) as DirectoryNode[];
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

function getPreferredWorkspaceFilePath(filePaths: string[]) {
  return filePaths[0] ?? null;
}

async function openWorkspace(dirPath: string): Promise<WorkspaceSnapshot> {
  await ensureWorkspace(dirPath);
  activeWorkspaceRoot = dirPath;
  await skillsService.setProjectRoot(dirPath);

  const tree = await buildDirectoryTree(dirPath);
  searchableFilesCache = await collectMarkdownFiles(tree);
  const activeFilePath = getPreferredWorkspaceFilePath(searchableFilesCache);
  const activeFile = activeFilePath ? await readMarkdownFile(activeFilePath) : null;

  if (activeWatcher) {
    await activeWatcher.close();
  }

  activeWatcher = watch(dirPath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 150,
      pollInterval: 50,
    },
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
      changedPath,
    });
  });

  return {
    rootPath: dirPath,
    tree,
    activeFile,
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
        snippet: lineContent.trim().slice(0, 180),
      });

      if (results.length >= 50) {
        break;
      }
    }
  }

  return results;
}

async function showOpenDialog(kind: DialogKind): Promise<FileOpenResult | null> {
  const properties: Array<"openFile" | "openDirectory" | "createDirectory"> =
    kind === "directory" ? ["openDirectory", "createDirectory"] : ["openFile"];

  const result = await dialog.showOpenDialog({
    properties,
    filters:
      kind === "file"
        ? [{ name: "Markdown", extensions: ["md", "mdx", "markdown"] }]
        : kind === "image"
          ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"] }]
          : undefined,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return {
    kind: kind === "directory" ? "directory" : "file",
    path: result.filePaths[0],
  };
}

async function pickAsset(kind: "image" | "any-file"): Promise<AssetSelection | null> {
  const selection = await showOpenDialog(kind);
  if (!selection) {
    return null;
  }

  return {
    path: selection.path,
    name: path.basename(selection.path),
    url: kind === "image" ? buildLocalAssetUrl(selection.path) : pathToFileURL(selection.path).href,
  };
}

async function loadRenderer(window: BrowserWindow) {
  if (!isDev) {
    await window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
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
    icon: iconPath,
    titleBarStyle: "hiddenInset",
    backgroundColor: nativeTheme.shouldUseDarkColors
      ? STARTUP_DARK_BACKGROUND
      : STARTUP_LIGHT_BACKGROUND,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      devTools: isDev,
      sandbox: true,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    console.error("Renderer load failed:", {
      code,
      description,
      validatedUrl,
    });
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("Preload failed:", preloadPath, error);
  });

  try {
    await loadRenderer(mainWindow);
  } catch (error) {
    console.error("Renderer bootstrap failed:", error);
    await mainWindow.loadURL(`data:text/html,${encodeURIComponent(buildRendererFailurePage())}`);
  }

  const settings = await loadSettings();
  refreshApplicationMenu(settings.shortcuts);
  broadcastUpdateState();
}

ipcMain.handle("dialog:open", async (_event, kind: DialogKind) => showOpenDialog(kind));

ipcMain.handle("asset:pick", async (_event, kind: "image" | "any-file") => pickAsset(kind));

ipcMain.handle(
  "app:resolveLinkTarget",
  async (_event, currentFilePath: string | null, href: string) =>
    resolveLinkTarget(currentFilePath, href),
);

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

function assertBasename(name: string) {
  if (path.basename(name) !== name) {
    throw new Error("Names must not contain path separators.");
  }
}

function assertWithinWorkspace(targetPath: string) {
  if (!activeWorkspaceRoot) {
    throw new Error("No workspace is open.");
  }

  const root = path.resolve(activeWorkspaceRoot);
  const resolved = path.resolve(targetPath);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path is outside the active workspace.");
  }
}

ipcMain.handle("workspace:openFile", async (_event, filePath: string) =>
  readMarkdownFile(filePath),
);

ipcMain.handle("workspace:saveFile", async (_event, filePath: string, content: string) => {
  let nextContent = content;

  try {
    const existingContent = await fs.readFile(filePath, "utf8");
    if (existingContent.includes("\r\n")) {
      nextContent = content.replace(/\r?\n/g, "\r\n");
    }
  } catch {
    // If we can't read the existing file, fall back to the normalized editor content.
  }

  await fs.writeFile(filePath, nextContent, "utf8");
  return readMarkdownFile(filePath);
});

ipcMain.handle("workspace:createFile", async (_event, parentDir: string, fileName: string) => {
  assertWithinWorkspace(parentDir);
  assertBasename(fileName);
  const normalizedFileName = getMarkdownExtension(fileName) !== null ? fileName : `${fileName}.md`;
  const targetPath = path.join(parentDir, normalizedFileName);
  await fs.writeFile(targetPath, "", { flag: "wx" });
  return readMarkdownFile(targetPath);
});

ipcMain.handle("workspace:renameFile", async (_event, oldPath: string, newName: string) => {
  assertWithinWorkspace(oldPath);
  assertBasename(newName);
  const currentExtension = getMarkdownExtension(oldPath) ?? ".md";
  const normalizedFileName =
    getMarkdownExtension(newName) !== null ? newName : `${newName}${currentExtension}`;
  const newPath = path.join(path.dirname(oldPath), normalizedFileName);
  await fs.rename(oldPath, newPath);
  return readMarkdownFile(newPath);
});

ipcMain.handle("workspace:deleteFile", async (_event, targetPath: string) => {
  assertWithinWorkspace(targetPath);
  await fs.unlink(targetPath);
  return targetPath;
});

ipcMain.handle("workspace:createFolder", async (_event, parentDir: string, folderName: string) => {
  assertWithinWorkspace(parentDir);
  assertBasename(folderName);
  await fs.mkdir(path.join(parentDir, folderName), { recursive: false });

  if (!activeWorkspaceRoot) {
    return [];
  }

  return buildDirectoryTree(activeWorkspaceRoot);
});

ipcMain.handle("workspace:search", async (_event, query: string) => searchWorkspace(query));

ipcMain.handle("sidebar:getNode", async (_event, kind: "file" | "directory", targetPath: string) =>
  getSidebarNode(kind, targetPath),
);

ipcMain.handle("workspace:openDocument", async () => {
  const selection = await showOpenDialog("file");

  if (!selection) {
    return null;
  }

  return readMarkdownFile(selection.path);
});

ipcMain.handle("skills:getLibrary", async () => skillsService.getSnapshot());

ipcMain.handle("skills:refresh", async (_event, changedPaths?: string[]) =>
  skillsService.refresh(changedPaths),
);

ipcMain.handle("skills:search", async (_event, query: unknown) => {
  if (typeof query !== "string") {
    throw new Error("query must be a string.");
  }

  return skillsService.search(query);
});

ipcMain.handle("skills:readDocument", async (_event, filePath: unknown) => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("filePath must be a non-empty string.");
  }

  return skillsService.readDocument(path.normalize(filePath));
});

ipcMain.handle("skills:saveDocument", async (_event, filePath: unknown, content: unknown) => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("filePath must be a non-empty string.");
  }

  if (typeof content !== "string") {
    throw new Error("content must be a string.");
  }

  return skillsService.saveDocument(path.normalize(filePath), content);
});

ipcMain.handle("settings:get", async () => loadSettings());

ipcMain.handle("settings:update", async (_event, patch: unknown) => {
  const sanitizedPatch = sanitizeSettingsPatch(patch);
  const nextSettings = await updateSettings(sanitizedPatch);
  refreshApplicationMenu(nextSettings.shortcuts);
  return nextSettings;
});

ipcMain.handle("app:getInfo", async () => getAppInfo());

ipcMain.handle("app:getUpdateState", async () => updateState);

ipcMain.handle("app:checkForUpdates", async () => checkForAppUpdates());

ipcMain.handle("app:downloadUpdate", async () => downloadAppUpdate());

ipcMain.handle("app:installUpdate", async () => {
  if (getUpdatesMode() !== "automatic" || updateState.status !== "downloaded") {
    return;
  }

  setUpdateState({
    errorMessage: null,
  });

  setImmediate(() => {
    try {
      const installScheduled = autoUpdater.quitAndInstall(false, true) as boolean | void;
      if (installScheduled === false) {
        handleAutoUpdaterError(new Error("Installation was not scheduled."));
        return;
      }

      setTimeout(() => {
        if (updateState.status === "downloaded") {
          handleAutoUpdaterError(
            new Error("Installation did not start. Please try downloading the update again."),
          );
        }
      }, 5000);
    } catch (error) {
      handleAutoUpdaterError(error);
    }
  });
});

ipcMain.handle("app:revealInFinder", async (_event, targetPath: string) => {
  try {
    shell.showItemInFolder(targetPath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("app:saveBlob", async (_event, filePath: string, base64Data: string) => {
  const buffer = Buffer.from(base64Data, "base64");
  await fs.writeFile(filePath, buffer);
});

ipcMain.handle("app:openExternal", async (_event, inputPath: string) => {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    throw new Error("Invalid path provided.");
  }

  const rawInput = inputPath.trim();
  if (rawInput.includes("\0")) {
    throw new Error("Path contains invalid characters.");
  }

  if (/^https?:\/\//i.test(rawInput) || /^file:\/\//i.test(rawInput)) {
    await shell.openExternal(rawInput);
    return;
  }

  if (rawInput.startsWith(`${localAssetProtocol}://`)) {
    const target = new URL(rawInput).searchParams.get("path");
    if (!target) {
      throw new Error("Local asset path is missing.");
    }

    const normalizedTarget = path.normalize(target);
    await fs.access(normalizedTarget);
    await shell.openPath(normalizedTarget);
    return;
  }

  const normalizedPath = path.normalize(rawInput);

  if (!path.isAbsolute(normalizedPath)) {
    throw new Error("Path must be absolute.");
  }

  try {
    await fs.access(normalizedPath);
  } catch {
    throw new Error("Path does not exist.");
  }

  await shell.openPath(normalizedPath);
});

ipcMain.handle("app:exportPDF", async (_event, markdown: string, filename: string) => {
  try {
    const PDFDocument = (await import("pdfkit")).default;
    const { marked } = await import("marked");
    const fs2 = await import("fs");

    // Convert markdown to plain text (strip markdown formatting)
    const tokens = marked.lexer(markdown);
    let plainText = "";

    for (const token of tokens) {
      if (token.type === "heading") {
        plainText += "\n" + (token as any).text + "\n";
      } else if (token.type === "paragraph") {
        plainText += (token as any).text + "\n";
      } else if (token.type === "list") {
        const items = (token as any).items as Array<{ text: string }>;
        items.forEach((item) => {
          plainText += "• " + item.text + "\n";
        });
      } else if (token.type === "code") {
        plainText += "\n" + (token as any).text + "\n\n";
      } else if (token.type === "blockquote") {
        plainText += "> " + (token as any).text + "\n";
      }
    }

    const savePath = path.join(app.getPath("downloads"), filename);
    const doc = new PDFDocument();
    const writeStream = fs2.createWriteStream(savePath);

    doc.pipe(writeStream);

    // Add title from filename
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(filename.replace(/\.pdf$/i, ""), { align: "left" })
      .moveDown();

    // Add content
    doc.fontSize(11).font("Helvetica").text(plainText, {
      align: "left",
      width: 500,
    });

    doc.end();

    // Wait for the file to be written
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", () => resolve());
      writeStream.on("error", reject);
      doc.on("error", reject);
    });

    return savePath;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to export PDF: ${message}`);
  }
});

async function getExternalPathTarget(targetPath: string) {
  try {
    const stat = await fs.stat(targetPath);
    return { path: targetPath, isDirectory: stat.isDirectory() };
  } catch {
    return null;
  }
}

ipcMain.handle("app:getPendingExternalPath", async () => {
  if (!pendingExternalPath) return null;
  const target = pendingExternalPath;
  pendingExternalPath = null;
  return getExternalPathTarget(target);
});

app.on("open-file", async (event, filePath) => {
  event.preventDefault();

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const target = await getExternalPathTarget(filePath);
    if (target) {
      mainWindow.webContents.send("app:open-external", target);
    }
  } else {
    pendingExternalPath = filePath;
  }
});

app
  .whenReady()
  .then(async () => {
    app.setAboutPanelOptions({ applicationName: APP_NAME });
    wireAutoUpdater();

    if (getUpdatesMode() === "automatic") {
      await hydratePersistedUpdateState();
    }

    if (process.platform === "darwin" && app.dock) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }

    protocol.handle(localAssetProtocol, (request) => {
      const target = new URL(request.url).searchParams.get("path");
      if (!target) {
        return new Response("Missing local asset path.", { status: 400 });
      }

      const normalizedTarget = path.normalize(target);
      return net.fetch(pathToFileURL(normalizedTarget).toString());
    });

    if (process.platform !== "darwin") {
      const args = process.argv.slice(1);
      const target = args.find(
        (arg) => arg !== "." && !arg.startsWith("-") && !arg.includes("node_modules"),
      );
      if (target) {
        pendingExternalPath = path.resolve(target);
      }
    }

    await createWindow();

    if (app.isPackaged && !isDev) {
      void checkForAppUpdates();
      updateCheckInterval = setInterval(() => {
        void checkForAppUpdates();
      }, UPDATE_CHECK_INTERVAL_MS);
    }
  })
  .catch((error) => {
    console.error("Failed to create initial window:", error);
  });

app.on("window-all-closed", async () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }

  if (activeWatcher) {
    await activeWatcher.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void skillsService.dispose();
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
