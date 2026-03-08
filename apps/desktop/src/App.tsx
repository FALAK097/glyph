import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import type { AppSettings, DirectoryNode, SearchResult, ThemeMode } from "./shared/workspace";
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
    setError
  } = useWorkspaceStore();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(true);
  const deferredPaletteQuery = useDeferredValue(paletteQuery);

  const files = useMemo(() => flattenFiles(tree, rootPath), [rootPath, tree]);
  const wordCount = useMemo(() => {
    const text = draftContent.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [draftContent]);
  const readingTime = Math.max(1, Math.round(wordCount / 200));

  useEffect(() => {
    const boot = async () => {
      const nextSettings = await typist.getSettings();
      setSettings(nextSettings);
      applyTheme(nextSettings.themeMode);

      const target = await typist.getPendingExternalPath();
      if (target) {
        if (target.isDirectory) {
          const workspace = await typist.openFolder(target.path);
          if (workspace) {
            setWorkspace(workspace);
            setIsWorkspaceMode(true);
          }
        } else {
          // It's a file, open default workspace then load this file
          const workspace = await typist.openDefaultWorkspace();
          if (workspace) {
            setWorkspace(workspace);
          }
          const file = await typist.readFile(target.path);
          setActiveFile(file);
          setIsWorkspaceMode(false);
        }
      } else {
        const workspace = await typist.openDefaultWorkspace();
        if (workspace) {
          setWorkspace(workspace);
          setIsWorkspaceMode(true);
        }
      }
    };

    void boot();
  }, [setWorkspace, setActiveFile, typist]);

  useEffect(() => {
    return typist.onExternalFile(async (target) => {
      if (target.isDirectory) {
        const workspace = await typist.openFolder(target.path);
        if (workspace) {
          setWorkspace(workspace);
          setIsWorkspaceMode(true);
        }
      } else {
        const file = await typist.readFile(target.path);
        setActiveFile(file);
        setIsWorkspaceMode(false);
      }
    });
  }, [setActiveFile, setWorkspace, typist]);

  useEffect(() => {
    return typist.onWorkspaceChanged(async ({ tree: nextTree, changedPath }) => {
      setTree(nextTree);

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

  const openFile = useCallback(async (filePath: string) => {
    const file = await typist.readFile(filePath);
    setActiveFile(file);
    setIsWorkspaceMode(isFileInsideWorkspace(file.path, rootPath));
    const nextSettings = await typist.getSettings();
    setSettings(nextSettings);
    setIsPaletteOpen(false);
  }, [rootPath, setActiveFile, typist]);

  const createNote = useCallback(async () => {
    const baseDir = isWorkspaceMode ? rootPath : settings?.defaultWorkspacePath ?? null;

    if (!baseDir) {
      return;
    }

    const file = await typist.createFile(baseDir, `Untitled-${Date.now()}.md`);
    setActiveFile(file);
    setIsWorkspaceMode(true);
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

  const handleDeleteFile = useCallback(async (filePath: string) => {
    if (!confirm("Are you sure you want to delete this note? This action cannot be undone.")) {
      return;
    }

    try {
      await typist.deleteFile(filePath);
      
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
      if (activeFile?.path === filePath) {
        setActiveFile(renamedFile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename file");
    }
  }, [activeFile?.path, setActiveFile, setError, typist]);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const query = paletteQuery.trim().toLowerCase();
    const items: PaletteItem[] = [];

    const baseCommands: PaletteItem[] = [
      {
        id: "new-note",
        title: "New note",
        subtitle: "Create a fresh markdown note",
        shortcut: "⇧⌘S",
        section: "Actions",
        kind: "command",
        onSelect: () => void createNote()
      },
      {
        id: "open-file",
        title: "Open File",
        subtitle: "Open an existing markdown file",
        shortcut: "⌘O",
        section: "Actions",
        kind: "command",
        onSelect: async () => {
          const file = await typist.openDocument();
          if (file) {
            setActiveFile(file);
            setIsWorkspaceMode(false);
          }
          setIsPaletteOpen(false);
        }
      },
      {
        id: "open-folder",
        title: "Open Folder",
        subtitle: "Open a folder as a workspace",
        section: "Actions",
        kind: "command",
        onSelect: async () => {
          const workspace = await typist.openFolder();
          if (workspace) {
            setWorkspace(workspace);
            setIsWorkspaceMode(true);
          }
          setIsPaletteOpen(false);
        }
      },
      {
        id: "previous-note",
        title: "Previous note",
        subtitle: "Jump to previous note",
        shortcut: "⌥↑",
        section: "Actions",
        kind: "command",
        onSelect: () => { void moveNote(-1); setIsPaletteOpen(false); }
      },
      {
        id: "next-note",
        title: "Next note",
        subtitle: "Jump to next note",
        shortcut: "⌥↓",
        section: "Actions",
        kind: "command",
        onSelect: () => { void moveNote(1); setIsPaletteOpen(false); }
      },
      {
        id: "settings",
        title: "Settings",
        subtitle: "Adjust workspace defaults",
        shortcut: "⌘,",
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
  }, [createNote, files, moveNote, openFile, paletteQuery, saveSettings, searchResults, setActiveFile, setIsWorkspaceMode, setWorkspace]);

  useEffect(() => {
    if (!isPaletteOpen) {
      setPaletteQuery("");
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex(0);
  }, [isPaletteOpen, paletteQuery]);

  const parseShortcut = (keys: string): { meta: boolean; alt: boolean; shift: boolean; key: string } | null => {
    const parts = keys.trim().split(/\s+/);
    if (parts.length === 0) return null;
    
    const key = parts[parts.length - 1].toLowerCase();
    return {
      meta: keys.includes("⌘"),
      alt: keys.includes("⌥"),
      shift: keys.includes("⇧"),
      key
    };
  };

  const matchShortcut = (event: KeyboardEvent, shortcut: string): boolean => {
    const parsed = parseShortcut(shortcut);
    if (!parsed) return false;
    
    const eventKey = event.key.toLowerCase();
    const keyMatch = parsed.key === eventKey || 
      (parsed.key === " " && event.key === " ") ||
      (parsed.key === "p" && eventKey === "p") ||
      (parsed.key === "s" && eventKey === "s") ||
      (parsed.key === "o" && eventKey === "o");
    
    const modifierMatch = 
      (!!event.metaKey || !!event.ctrlKey) === parsed.meta &&
      !!event.altKey === parsed.alt &&
      !!event.shiftKey === parsed.shift;
    
    return keyMatch && modifierMatch;
  };

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (!settings?.shortcuts) return;

      if (event.key === "Escape") {
        setIsPaletteOpen(false);
        setIsSettingsOpen(false);
        return;
      }

      const shortcut = settings.shortcuts.find(s => matchShortcut(event, s.keys));
      
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
              setActiveFile(file);
              setIsWorkspaceMode(false);
            }
            break;
          }
          case "open-folder": {
            const workspace = await typist.openFolder();
            if (workspace) {
              setWorkspace(workspace);
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
          case "next-note":
            void moveNote(1);
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
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settings, activeFile, draftContent, markSaved, setError, setSaving, typist, createNote, moveNote, setActiveFile, setWorkspace]);

  useEffect(() => {
    return typist.onCommand(async (command) => {
      if (command === "quick-open") {
        setIsPaletteOpen(true);
        return;
      }

      if (command === "new-file") {
        await createNote();
        return;
      }

      if (command === "open-file") {
        const file = await typist.openDocument();
        if (file) {
          setActiveFile(file);
          setIsWorkspaceMode(false);
        }
        return;
      }

      if (command === "open-folder") {
        const workspace = await typist.openFolder();
        if (workspace) {
          setWorkspace(workspace);
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
  }, [activeFile, createNote, draftContent, markSaved, setActiveFile, setError, setSaving, setWorkspace, typist]);

  const saveStateLabel = isSaving
    ? "Saving..."
    : isDirty
      ? "Unsaved"
      : lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "Ready";

  return (
    <div className="app-shell">
      <Sidebar
        rootPath={rootPath}
        tree={tree}
        activePath={activeFile?.path ?? null}
        recentFiles={settings?.recentFiles ?? []}
        noteCount={files.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenFile={(filePath) => void openFile(filePath)}
        onCreateNote={() => void createNote()}
        onOpenPalette={() => setIsPaletteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDeleteFile={handleDeleteFile}
        onRenameFile={handleRenameFile}
      />
      <main className={`workspace-shell single-pane relative transition-all duration-200 ${isSidebarCollapsed ? 'ml-0' : ''}`}>
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4 mb-6">
          <button 
            className="flex items-center justify-between w-full px-3 py-1.5 bg-transparent border border-border rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
            onClick={() => setIsPaletteOpen(true)}
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <span className="text-base">Search typist</span>
            </div>
            <span className="font-mono text-xs opacity-60">⌘P</span>
          </button>
        </div>
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
            setWorkspace(workspace);
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
