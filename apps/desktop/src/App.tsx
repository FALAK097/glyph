import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import type { DragPosition, SidebarTopLevelNode } from "./components/Sidebar";
import { getShortcutDisplay, matchShortcut, mergeShortcutSettings } from "./shared/shortcuts";
import type { AppSettings, DirectoryNode, FileDocument, SearchResult, SidebarItemSetting, ThemeMode, WorkspaceSnapshot } from "./shared/workspace";
import { useWorkspaceStore } from "./store/workspace";
import { applyTheme } from "./theme/themes";

type PaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
  hint?: string;
  shortcut?: string;
  section: string;
  kind: "command" | "file";
  onSelect: () => void;
  onPreview?: () => void;
};

type FlatFile = {
  path: string;
  name: string;
  relativePath: string;
};

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function getBaseName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

function getRelativePath(filePath: string, rootPath: string | null) {
  if (!rootPath) {
    return filePath.split(/[\\/]/).at(-1) ?? filePath;
  }

  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath).replace(/\/+$/, "");

  if (normalizedFilePath.startsWith(`${normalizedRootPath}/`)) {
    return normalizedFilePath.slice(normalizedRootPath.length + 1);
  }

  return normalizedFilePath.split("/").at(-1) ?? normalizedFilePath;
}

function isFileInsideWorkspace(filePath: string, rootPath: string | null) {
  if (!rootPath) {
    return false;
  }

  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath).replace(/\/+$/, "");
  return normalizedFilePath.startsWith(`${normalizedRootPath}/`);
}

function flattenFiles(nodes: DirectoryNode[], rootPath: string | null): FlatFile[] {
  const items: FlatFile[] = [];

  for (const node of nodes) {
    if (node.type === "file") {
      items.push({
        path: node.path,
        name: node.name,
        relativePath: getRelativePath(node.path, rootPath)
      });
      continue;
    }

    items.push(...flattenFiles(node.children, rootPath));
  }

  return items;
}

function toSidebarItemSetting(node: DirectoryNode): SidebarItemSetting {
  return {
    kind: node.type,
    path: node.path
  };
}

function orderSidebarNodes(nodes: DirectoryNode[], orderedItems: SidebarItemSetting[]): DirectoryNode[] {
  const remaining = new Map(nodes.map((node) => [node.path, node]));
  const ordered: DirectoryNode[] = [];

  for (const item of orderedItems) {
    const match = remaining.get(item.path);
    if (!match || match.type !== item.kind) {
      continue;
    }

    ordered.push(match);
    remaining.delete(item.path);
  }

  return [...ordered, ...remaining.values()];
}

function reorderSidebarNodes(nodes: DirectoryNode[], sourcePath: string, targetPath: string, position: DragPosition): DirectoryNode[] {
  const sourceIndex = nodes.findIndex((node) => node.path === sourcePath);
  const targetIndex = nodes.findIndex((node) => node.path === targetPath);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return nodes;
  }

  const nextNodes = [...nodes];
  const [sourceNode] = nextNodes.splice(sourceIndex, 1);
  const adjustedTargetIndex = nextNodes.findIndex((node) => node.path === targetPath);
  const insertIndex = position === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
  nextNodes.splice(insertIndex, 0, sourceNode);
  return nextNodes;
}

function upsertSidebarFolder(nodes: DirectoryNode[], workspace: WorkspaceSnapshot): DirectoryNode[] {
  const nextFolder: DirectoryNode = {
    type: "directory",
    name: getBaseName(workspace.rootPath),
    path: workspace.rootPath,
    children: workspace.tree
  };

  const nextNodes = nodes.filter(
    (node) => !(node.type === "file" && isFileInsideWorkspace(node.path, workspace.rootPath))
  );
  const existingIndex = nextNodes.findIndex((node) => node.type === "directory" && node.path === workspace.rootPath);

  if (existingIndex === -1) {
    return [...nextNodes, nextFolder];
  }

  return nextNodes.map((node, index) => (index === existingIndex ? nextFolder : node));
}

function upsertSidebarFile(nodes: DirectoryNode[], file: Pick<FileDocument, "path" | "name">): DirectoryNode[] {
  const isCoveredByFolder = nodes.some(
    (node) => node.type === "directory" && isFileInsideWorkspace(file.path, node.path)
  );

  if (isCoveredByFolder) {
    return nodes.filter((node) => !(node.type === "file" && node.path === file.path));
  }

  const nextFile: DirectoryNode = {
    type: "file",
    name: file.name,
    path: file.path
  };

  const existingIndex = nodes.findIndex((node) => node.type === "file" && node.path === file.path);
  if (existingIndex === -1) {
    return [...nodes, nextFile];
  }

  return nodes.map((node, index) => (index === existingIndex ? nextFile : node));
}

function removeSidebarPath(nodes: DirectoryNode[], targetPath: string): DirectoryNode[] {
  return nodes.flatMap<DirectoryNode>((node) => {
    if (node.path === targetPath) {
      return [];
    }

    if (node.type === "directory") {
      return [{ ...node, children: removeSidebarPath(node.children, targetPath) }];
    }

    return [node];
  });
}

function renameSidebarFile(nodes: DirectoryNode[], oldPath: string, renamedFile: Pick<FileDocument, "path" | "name">): DirectoryNode[] {
  return nodes.map((node) => {
    if (node.type === "directory") {
      return { ...node, children: renameSidebarFile(node.children, oldPath, renamedFile) };
    }

    if (node.path !== oldPath) {
      return node;
    }

    return {
      type: "file",
      path: renamedFile.path,
      name: renamedFile.name
    };
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function App() {
  const typist = window.typist;

  if (!typist) {
    return (
      <main className="boot-error-shell">
        <section className="boot-error-card">
          <p className="panel-label">Renderer Boot Error</p>
          <h1>Typist could not connect to the Electron preload API.</h1>
          <p>Check the terminal for preload errors, then restart `pnpm dev:desktop`.</p>
        </section>
      </main>
    );
  }

  return <DesktopApp typist={typist} />;
}

function DesktopApp({ typist }: { typist: NonNullable<Window["typist"]> }) {
  const {
    rootPath,
    tree,
    activeFile,
    draftContent,
    isDirty,
    isSaving,
    lastSavedAt,
    error,
    setWorkspace,
    setTree,
    setActiveFile,
    updateActiveFile,
    updateDraftContent,
    markSaved,
    setSaving,
    setError,
    pushHistory,
    canGoBack,
    canGoForward,
    goBack,
    goForward
  } = useWorkspaceStore();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(true);
  const [sidebarNodes, setSidebarNodes] = useState<DirectoryNode[]>([]);
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<string[]>([]);
  const [hasHydratedSidebar, setHasHydratedSidebar] = useState(false);
  const deferredPaletteQuery = useDeferredValue(paletteQuery);

  const files = useMemo(() => flattenFiles(tree, rootPath), [rootPath, tree]);
  const wordCount = useMemo(() => {
    const text = draftContent.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [draftContent]);
  const readingTime = Math.max(1, Math.round(wordCount / 200));

  const visibleSidebarNodes = useMemo<SidebarTopLevelNode[]>(() => {
    const expanded = new Set(expandedFolderPaths);
    return sidebarNodes.map((node) => ({
      node,
      isExpanded: node.type === "directory" ? expanded.has(node.path) : true
    }));
  }, [expandedFolderPaths, sidebarNodes]);

  const persistedSidebar = useMemo(() => ({
    items: sidebarNodes.map(toSidebarItemSetting),
    expandedFolders: expandedFolderPaths
  }), [expandedFolderPaths, sidebarNodes]);

  const restoreSidebarNodes = useCallback(async (items: SidebarItemSetting[]) => {
    const resolved = await Promise.all(items.map((item) => typist.getSidebarNode(item.kind, item.path)));
    return resolved.filter((node): node is DirectoryNode => node !== null);
  }, [typist]);

  const syncWorkspace = useCallback((workspace: WorkspaceSnapshot) => {
    setWorkspace(workspace);
    setSidebarNodes((prev) => upsertSidebarFolder(prev, workspace));
    setExpandedFolderPaths((prev) => (prev.includes(workspace.rootPath) ? prev : [...prev, workspace.rootPath]));
  }, [setWorkspace]);

  const syncOpenedFile = useCallback(async (file: FileDocument) => {
    setActiveFile(file);
    setIsWorkspaceMode(isFileInsideWorkspace(file.path, rootPath));
    setSidebarNodes((prev) => upsertSidebarFile(prev, file));
    const nextSettings = await typist.getSettings();
    setSettings(nextSettings);
    setIsPaletteOpen(false);
  }, [rootPath, setActiveFile, typist]);

  useEffect(() => {
    const boot = async () => {
      const nextSettings = await typist.getSettings();
      setSettings(nextSettings);
      applyTheme(nextSettings.themeMode);

      let nextSidebarNodes = orderSidebarNodes(await restoreSidebarNodes(nextSettings.sidebar.items), nextSettings.sidebar.items);
      const nextExpandedFolders = new Set(nextSettings.sidebar.expandedFolders);

      const target = await typist.getPendingExternalPath();
      if (target) {
        if (target.isDirectory) {
          const workspace = await typist.openFolder(target.path);
          if (workspace) {
            setWorkspace(workspace);
            setIsWorkspaceMode(true);
            nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
            nextExpandedFolders.add(workspace.rootPath);
          }
        } else {
          const workspace = await typist.openDefaultWorkspace();
          if (workspace) {
            setWorkspace(workspace);
            nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
            nextExpandedFolders.add(workspace.rootPath);
          }
          const file = await typist.readFile(target.path);
          setActiveFile(file);
          setIsWorkspaceMode(Boolean(workspace && isFileInsideWorkspace(file.path, workspace.rootPath)));
          nextSidebarNodes = upsertSidebarFile(nextSidebarNodes, file);
        }
      } else {
        const workspace = await typist.openDefaultWorkspace();
        if (workspace) {
          setWorkspace(workspace);
          setIsWorkspaceMode(true);
          nextSidebarNodes = upsertSidebarFolder(nextSidebarNodes, workspace);
          nextExpandedFolders.add(workspace.rootPath);
        }
      }

      setSidebarNodes(nextSidebarNodes);
      setExpandedFolderPaths(Array.from(nextExpandedFolders));
      setHasHydratedSidebar(true);
    };

    void boot();
  }, [restoreSidebarNodes, setActiveFile, setWorkspace, typist]);

  useEffect(() => {
    return typist.onExternalFile(async (target) => {
      if (target.isDirectory) {
        const workspace = await typist.openFolder(target.path);
        if (workspace) {
          syncWorkspace(workspace);
          setIsWorkspaceMode(true);
        }
      } else {
        const file = await typist.readFile(target.path);
        await syncOpenedFile(file);
      }
    });
  }, [syncOpenedFile, syncWorkspace, typist]);

  useEffect(() => {
    return typist.onWorkspaceChanged(async ({ rootPath: changedRootPath, tree: nextTree, changedPath }) => {
      setTree(nextTree);
      setSidebarNodes((prev) => upsertSidebarFolder(prev, { rootPath: changedRootPath, tree: nextTree, activeFile: null }));

      if (changedPath === activeFile?.path && !isDirty) {
        const refreshedFile = await typist.readFile(changedPath);
        updateActiveFile(refreshedFile);
      }
    });
  }, [activeFile?.path, isDirty, updateActiveFile, setTree, typist]);

  useEffect(() => {
    if (!activeFile || !isDirty || isSaving) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        let currentPath = activeFile.path;
        let finalFile = activeFile;
        const isUntitled = activeFile.name.startsWith("Untitled-");
        
        if (isUntitled && draftContent.trim().length > 0) {
          const firstLine = draftContent.split(/\r?\n/)[0]?.replace(/^#+\s*/, "").trim() || "Untitled";
          const safeName = firstLine.replace(/[^a-zA-Z0-9-_\s]/g, "").trim().substring(0, 50);
          if (safeName && safeName !== "Untitled") {
            const newName = `${safeName}.md`;
            finalFile = await typist.renameFile(currentPath, newName);
            setSidebarNodes((prev) => upsertSidebarFile(renameSidebarFile(prev, currentPath, finalFile), finalFile));
            currentPath = finalFile.path;
            updateActiveFile(finalFile);
          }
        }

        const savedFile = await typist.saveFile(currentPath, draftContent);
        markSaved(savedFile);
      } catch (saveError) {
        setSaving(false);
        setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeFile?.path, draftContent, isDirty, isSaving, markSaved, setError, setSaving, setActiveFile, typist]);

  useEffect(() => {
    if (!isPaletteOpen) {
      setSearchResults([]);
      return;
    }

    const query = deferredPaletteQuery.trim().toLowerCase();

    if (!isWorkspaceMode || !query || query.startsWith("theme")) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const results = await typist.searchWorkspace(query);
      setSearchResults(results);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [deferredPaletteQuery, isPaletteOpen, isWorkspaceMode, typist]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    applyTheme(settings.themeMode);
  }, [settings]);

  const saveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await typist.updateSettings(patch);
    setSettings(next);
    return next;
  }, [typist]);

  useEffect(() => {
    if (!settings || !hasHydratedSidebar) {
      return;
    }

    const currentSidebar = JSON.stringify(persistedSidebar);
    const savedSidebar = JSON.stringify(settings.sidebar);
    if (currentSidebar === savedSidebar) {
      return;
    }

    void saveSettings({ sidebar: persistedSidebar });
  }, [hasHydratedSidebar, persistedSidebar, saveSettings, settings]);

  const openFile = useCallback(async (filePath: string) => {
    const file = await typist.readFile(filePath);
    await syncOpenedFile(file);
    pushHistory(filePath);
  }, [syncOpenedFile, typist, pushHistory]);

  const createNote = useCallback(async () => {
    const baseDir = isWorkspaceMode ? rootPath : settings?.defaultWorkspacePath ?? null;

    if (!baseDir) {
      return;
    }

    const file = await typist.createFile(baseDir, `Untitled-${Date.now()}.md`);
    setActiveFile(file);
    setIsWorkspaceMode(true);
    setSidebarNodes((prev) => upsertSidebarFile(prev, file));
    const nextSettings = await typist.getSettings();
    setSettings(nextSettings);
    setIsPaletteOpen(false);
  }, [isWorkspaceMode, rootPath, setActiveFile, settings?.defaultWorkspacePath, typist]);

  const currentFileIndex = files.findIndex((item) => item.path === activeFile?.path);

   const moveNote = useCallback(async (direction: 1 | -1) => {
     if (currentFileIndex === -1 || files.length === 0) {
       return;
     }

     const nextIndex = (currentFileIndex + direction + files.length) % files.length;
     await openFile(files[nextIndex].path);
   }, [currentFileIndex, files, openFile]);

   const navigateBack = useCallback(async () => {
     const prevPath = goBack();
     if (prevPath) {
       const file = await typist.readFile(prevPath);
       setActiveFile(file);
     }
   }, [goBack, typist, setActiveFile]);

   const navigateForward = useCallback(async () => {
     const nextPath = goForward();
     if (nextPath) {
       const file = await typist.readFile(nextPath);
       setActiveFile(file);
     }
   }, [goForward, typist, setActiveFile]);

  const handleDeleteFile = useCallback(async (filePath: string) => {
    try {
      await typist.deleteFile(filePath);
      setSidebarNodes((prev) => removeSidebarPath(prev, filePath));
      
      // If we deleted the active file, clear it
      if (activeFile?.path === filePath) {
        setActiveFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    }
  }, [activeFile?.path, setActiveFile, setError, typist]);

  const handleRenameFile = useCallback(async (filePath: string, newName: string) => {
    if (!newName.trim()) {
      return;
    }

    try {
      const renamedFile = await typist.renameFile(filePath, newName);
      setSidebarNodes((prev) => upsertSidebarFile(renameSidebarFile(prev, filePath, renamedFile), renamedFile));
      if (activeFile?.path === filePath) {
        setActiveFile(renamedFile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename file");
    }
  }, [activeFile?.path, setActiveFile, setError, typist]);

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolderPaths((prev) => (
      prev.includes(folderPath)
        ? prev.filter((path) => path !== folderPath)
        : [...prev, folderPath]
    ));
  }, []);

  const handleReorderNodes = useCallback((sourcePath: string, targetPath: string, position: DragPosition) => {
    setSidebarNodes((prev) => reorderSidebarNodes(prev, sourcePath, targetPath, position));
  }, []);

  const shortcuts = useMemo(() => mergeShortcutSettings(settings?.shortcuts), [settings?.shortcuts]);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const query = paletteQuery.trim().toLowerCase();
    const items: PaletteItem[] = [];

    const baseCommands: PaletteItem[] = [
      {
        id: "new-note",
        title: "New note",
        subtitle: "Create a fresh markdown note",
        shortcut: getShortcutDisplay(shortcuts, "new-note"),
        section: "Actions",
        kind: "command",
        onSelect: () => void createNote()
      },
      {
        id: "open-file",
        title: "Open File",
        subtitle: "Open an existing markdown file",
        shortcut: getShortcutDisplay(shortcuts, "open-file"),
        section: "Actions",
        kind: "command",
        onSelect: async () => {
          const file = await typist.openDocument();
          if (file) {
            await syncOpenedFile(file);
          }
          setIsPaletteOpen(false);
        }
      },
      {
        id: "open-folder",
        title: "Open Folder",
        subtitle: "Open a folder as a workspace",
        shortcut: getShortcutDisplay(shortcuts, "open-folder"),
        section: "Actions",
        kind: "command",
        onSelect: async () => {
          const workspace = await typist.openFolder();
          if (workspace) {
            syncWorkspace(workspace);
            setIsWorkspaceMode(true);
          }
          setIsPaletteOpen(false);
        }
      },
      {
        id: "previous-note",
        title: "Previous note",
        subtitle: "Jump to previous note",
        shortcut: getShortcutDisplay(shortcuts, "previous-note"),
        section: "Actions",
        kind: "command",
        onSelect: () => { void moveNote(-1); setIsPaletteOpen(false); }
      },
       {
         id: "next-note",
         title: "Next note",
         subtitle: "Jump to next note",
         shortcut: getShortcutDisplay(shortcuts, "next-note"),
         section: "Actions",
         kind: "command",
         onSelect: () => { void moveNote(1); setIsPaletteOpen(false); }
       },
       {
         id: "navigate-back",
         title: "Navigate Back",
         subtitle: "Go to previous file in history",
         shortcut: getShortcutDisplay(shortcuts, "navigate-back"),
         section: "Navigation",
         kind: "command",
         onSelect: () => { void navigateBack(); setIsPaletteOpen(false); }
       },
       {
         id: "navigate-forward",
         title: "Navigate Forward",
         subtitle: "Go to next file in history",
         shortcut: getShortcutDisplay(shortcuts, "navigate-forward"),
         section: "Navigation",
         kind: "command",
         onSelect: () => { void navigateForward(); setIsPaletteOpen(false); }
       },
       {
         id: "settings",
         title: "Settings",
         subtitle: "Adjust workspace defaults",
         shortcut: getShortcutDisplay(shortcuts, "settings"),
         section: "Actions",
         kind: "command",
         onSelect: () => {
           setIsSettingsOpen(true);
           setIsPaletteOpen(false);
         }
       },
      {
        id: "theme-light",
        title: "Theme: Light",
        subtitle: "Switch to light mode",
        section: "Theme",
        kind: "command",
        onSelect: () => {
          void saveSettings({ themeMode: "light" });
          setIsPaletteOpen(false);
        }
      },
      {
        id: "theme-dark",
        title: "Theme: Dark",
        subtitle: "Switch to dark mode",
        section: "Theme",
        kind: "command",
        onSelect: () => {
          void saveSettings({ themeMode: "dark" });
          setIsPaletteOpen(false);
        }
      },
      {
        id: "theme-system",
        title: "Theme: System",
        subtitle: "Sync theme with system",
        section: "Theme",
        kind: "command",
        onSelect: () => {
          void saveSettings({ themeMode: "system" });
          setIsPaletteOpen(false);
        }
      }
    ];

    if (!query) {
      items.push(...baseCommands);
    } else {
      const isThemeQuery = query.startsWith("theme");
      const filterQuery = isThemeQuery ? query.replace(/^theme\s*/, "").trim() : query;

      const matchedCommands = baseCommands.filter((cmd) => {
        if (isThemeQuery && cmd.section !== "Theme") return false;
        return cmd.title.toLowerCase().includes(filterQuery) || 
               (cmd.subtitle && cmd.subtitle.toLowerCase().includes(filterQuery));
      });
      items.push(...matchedCommands);
    }

    const matchingFiles = files.filter((file) => {
      if (!query) {
        return false;
      }
      return `${file.name} ${file.relativePath}`.toLowerCase().includes(query);
    });

    matchingFiles.slice(0, 12).forEach((file) => {
      items.push({
        id: file.path,
        title: file.name,
        subtitle: file.relativePath,
        hint: "File",
        section: "Files",
        kind: "file",
        onSelect: () => void openFile(file.path)
      });
    });

    searchResults.slice(0, 8).forEach((result) => {
      items.push({
        id: `search-${result.path}-${result.line}`,
        title: result.name,
        subtitle: `${result.snippet} · line ${result.line}`,
        hint: "Match",
        section: "Matches",
        kind: "file",
        onSelect: () => void openFile(result.path)
      });
    });

    return items;
  }, [createNote, files, moveNote, openFile, paletteQuery, saveSettings, searchResults, shortcuts, syncOpenedFile, syncWorkspace, navigateBack, navigateForward]);

  useEffect(() => {
    if (!isPaletteOpen) {
      setPaletteQuery("");
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex(0);
  }, [isPaletteOpen, paletteQuery]);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      // Check if the target is an editable input/textarea to allow normal text editing
      const target = event.target as HTMLElement;
      const isEditableInput = target && (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      );

      if (event.key === "Escape" && !isEditableInput) {
        setIsPaletteOpen(false);
        setIsSettingsOpen(false);
        return;
      }

      // Skip shortcut processing when in an editable input field
      if (!isEditableInput) {
        const shortcut = shortcuts.find((entry) => matchShortcut(event, entry.keys));
        
        if (shortcut) {
          event.preventDefault();
          
          switch (shortcut.id) {
            case "command-palette":
              setIsPaletteOpen((value) => !value);
              break;
            case "settings":
              setIsSettingsOpen((value) => !value);
              break;
            case "new-note":
              void createNote();
              break;
            case "open-file": {
              const file = await typist.openDocument();
              if (file) {
                await syncOpenedFile(file);
              }
              break;
            }
            case "open-folder": {
              const workspace = await typist.openFolder();
              if (workspace) {
                syncWorkspace(workspace);
                setIsWorkspaceMode(true);
              }
              break;
            }
            case "save":
              if (activeFile) {
                setSaving(true);
                try {
                  const savedFile = await typist.saveFile(activeFile.path, draftContent);
                  markSaved(savedFile);
                } catch (saveError) {
                  console.error("Manual save failed:", saveError);
                  setError(getErrorMessage(saveError));
                } finally {
                  setSaving(false);
                }
              }
              break;
            case "previous-note":
              void moveNote(-1);
              break;
            case "toggle-sidebar":
              setIsSidebarCollapsed((prev) => !prev);
              break;
            case "next-note":
              void moveNote(1);
              break;
            case "navigate-back":
              void navigateBack();
              break;
            case "navigate-forward":
              void navigateForward();
              break;
          }
          return;
        }

        if (event.ctrlKey && event.shiftKey && event.key === "[") {
          event.preventDefault();
          void moveNote(-1);
          return;
        }

        if (event.ctrlKey && event.shiftKey && event.key === "]") {
          event.preventDefault();
          void moveNote(1);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, activeFile, draftContent, markSaved, setError, setSaving, typist, createNote, moveNote, syncOpenedFile, syncWorkspace, navigateBack, navigateForward]);

  useEffect(() => {
    return typist.onCommand(async (command) => {
      if (command === "quick-open") {
        setIsPaletteOpen(true);
        return;
      }

      if (command === "toggle-sidebar") {
        setIsSidebarCollapsed((prev) => !prev);
        return;
      }

      if (command === "new-file") {
        await createNote();
        return;
      }

      if (command === "open-file") {
        const file = await typist.openDocument();
        if (file) {
          await syncOpenedFile(file);
        }
        return;
      }

      if (command === "open-folder") {
        const workspace = await typist.openFolder();
        if (workspace) {
          syncWorkspace(workspace);
          setIsWorkspaceMode(true);
        }
        return;
      }

      if (command === "save" && activeFile) {
        setSaving(true);
        try {
          const savedFile = await typist.saveFile(activeFile.path, draftContent);
          markSaved(savedFile);
        } catch (saveError) {
          console.error("Menu save failed:", saveError);
          setError(getErrorMessage(saveError));
        } finally {
          setSaving(false);
        }
      }
    });
  }, [activeFile, createNote, draftContent, markSaved, setError, setSaving, syncOpenedFile, syncWorkspace, typist]);

  const saveStateLabel = isSaving
    ? "Saving..."
    : isDirty
      ? "Unsaved"
      : lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "Ready";

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <Sidebar
        tree={visibleSidebarNodes}
        activePath={activeFile?.path ?? null}
        isCollapsed={isSidebarCollapsed}
        onOpenFile={(filePath) => void openFile(filePath)}
        onDeleteFile={handleDeleteFile}
        onRenameFile={handleRenameFile}
        onToggleFolder={handleToggleFolder}
        onReorderNodes={handleReorderNodes}
      />
      <main className={`workspace-shell single-pane relative transition-all duration-200 ${isSidebarCollapsed ? 'ml-0' : ''}`}>
        {error ? <div className="error-banner">{error}</div> : null}
        <MarkdownEditor
          content={draftContent}
          fileName={activeFile?.name ?? null}
          filePath={activeFile?.path ?? null}
          saveStateLabel={saveStateLabel}
          wordCount={wordCount}
          readingTime={readingTime}
          onChange={updateDraftContent}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isSidebarCollapsed={isSidebarCollapsed}
          onCreateNote={() => void createNote()}
          toggleSidebarShortcut={getShortcutDisplay(shortcuts, "toggle-sidebar")}
          newNoteShortcut={getShortcutDisplay(shortcuts, "new-note")}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
          commandPaletteShortcut={getShortcutDisplay(shortcuts, "command-palette") ?? "⌘P"}
          onNavigateBack={() => void navigateBack()}
          onNavigateForward={() => void navigateForward()}
          canGoBack={canGoBack()}
          canGoForward={canGoForward()}
        />
      </main>
      <CommandPalette
        isOpen={isPaletteOpen}
        query={paletteQuery}
        items={paletteItems}
        selectedIndex={selectedIndex}
        onChangeQuery={setPaletteQuery}
        onClose={() => {
          setIsPaletteOpen(false);
        }}
        onHoverItem={setSelectedIndex}
        onMove={(direction) => {
          if (paletteItems.length === 0) {
            return;
          }

          setSelectedIndex((value) => (value + direction + paletteItems.length) % paletteItems.length);
        }}
        onSelect={() => paletteItems[selectedIndex]?.onSelect()}
      />
      <SettingsPanel
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onChooseFolder={async () => {
          const selection = await typist.openDialog("directory");
          if (!selection) {
            return;
          }

          const nextSettings = await saveSettings({ defaultWorkspacePath: selection.path });
          const workspace = await typist.openFolder(nextSettings.defaultWorkspacePath);
          if (workspace) {
            syncWorkspace(workspace);
            setIsWorkspaceMode(true);
          }
        }}
        onChangeMode={async (mode: ThemeMode) => {
          await saveSettings({ themeMode: mode });
        }}
        onChangeShortcuts={async (shortcuts) => {
          await saveSettings({ shortcuts });
        }}
      />
    </div>
  );
}
