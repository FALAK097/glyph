import { useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import type { AppSettings, DirectoryNode, SearchResult, ThemeMode } from "./shared/workspace";
import { useWorkspaceStore } from "./store/workspace";
import { applyTheme, themes } from "./theme/themes";

type PaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
  kind: "command" | "file" | "theme";
  onSelect: () => void;
  onPreview?: () => void;
};

type FlatFile = {
  path: string;
  name: string;
  relativePath: string;
};

function flattenFiles(nodes: DirectoryNode[], rootPath: string | null): FlatFile[] {
  const items: FlatFile[] = [];

  for (const node of nodes) {
    if (node.type === "file") {
      items.push({
        path: node.path,
        name: node.name,
        relativePath: rootPath ? node.path.replace(`${rootPath}/`, "") : node.name
      });
      continue;
    }

    items.push(...flattenFiles(node.children, rootPath));
  }

  return items;
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
    updateDraftContent,
    markSaved,
    setSaving,
    setError
  } = useWorkspaceStore();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);

  const files = useMemo(() => flattenFiles(tree, rootPath), [rootPath, tree]);

  useEffect(() => {
    const boot = async () => {
      const nextSettings = await typist.getSettings();
      setSettings(nextSettings);
      applyTheme(nextSettings.themeId, nextSettings.themeMode);

      const workspace = await typist.openDefaultWorkspace();
      if (workspace) {
        setWorkspace(workspace);
      }
    };

    void boot();
  }, [setWorkspace, typist]);

  useEffect(() => {
    return typist.onWorkspaceChanged(async ({ tree: nextTree, changedPath }) => {
      setTree(nextTree);

      if (changedPath === activeFile?.path && !isDirty) {
        const refreshedFile = await typist.readFile(changedPath);
        setActiveFile(refreshedFile);
      }
    });
  }, [activeFile?.path, isDirty, setActiveFile, setTree, typist]);

  useEffect(() => {
    if (!activeFile || !isDirty || isSaving) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const savedFile = await typist.saveFile(activeFile.path, draftContent);
        markSaved(savedFile);
      } catch (saveError) {
        setSaving(false);
        setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeFile?.path, draftContent, isDirty, isSaving, markSaved, setError, setSaving, typist]);

  useEffect(() => {
    const query = paletteQuery.trim().toLowerCase();

    if (!query || query.startsWith("theme")) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const results = await typist.searchWorkspace(query);
      setSearchResults(results);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [paletteQuery, typist]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    if (previewTheme) {
      applyTheme(previewTheme, settings.themeMode);
      return;
    }

    applyTheme(settings.themeId, settings.themeMode);
  }, [previewTheme, settings]);

  const saveSettings = async (patch: Partial<AppSettings>) => {
    const next = await typist.updateSettings(patch);
    setSettings(next);
    return next;
  };

  const openFile = async (filePath: string) => {
    const file = await typist.readFile(filePath);
    setActiveFile(file);
    const nextSettings = await typist.getSettings();
    setSettings(nextSettings);
    setIsPaletteOpen(false);
  };

  const createNote = async () => {
    const baseDir = rootPath ?? settings?.defaultWorkspacePath ?? null;

    if (!baseDir) {
      return;
    }

    const file = await typist.createFile(baseDir, `note-${Date.now()}.md`);
    setActiveFile(file);
    const nextSettings = await typist.getSettings();
    setSettings(nextSettings);
    setIsPaletteOpen(false);
  };

  const currentFileIndex = files.findIndex((item) => item.path === activeFile?.path);

  const moveNote = async (direction: 1 | -1) => {
    if (currentFileIndex === -1 || files.length === 0) {
      return;
    }

    const nextIndex = (currentFileIndex + direction + files.length) % files.length;
    await openFile(files[nextIndex].path);
  };

  const cycleTheme = async () => {
    if (!settings) {
      return;
    }

    const currentIndex = themes.findIndex((theme) => theme.id === settings.themeId);
    const nextTheme = themes[(currentIndex + 1 + themes.length) % themes.length];
    await saveSettings({ themeId: nextTheme.id });
  };

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const query = paletteQuery.trim().toLowerCase();
    const items: PaletteItem[] = [];

    if (!query) {
      items.push(
        { id: "new-note", title: "New note", subtitle: "Create a note in the default workspace", kind: "command", onSelect: () => void createNote() },
        { id: "previous-note", title: "Previous note", kind: "command", onSelect: () => void moveNote(-1) },
        { id: "next-note", title: "Next note", kind: "command", onSelect: () => void moveNote(1) },
        { id: "settings", title: "Settings", kind: "command", onSelect: () => { setIsSettingsOpen(true); setIsPaletteOpen(false); } }
      );
    }

    if (query.includes("theme") || query.includes("aura") || query.includes("night") || query.includes("ayu") || query.includes("forest")) {
      items.push({
        id: "cycle-theme",
        title: "Cycle theme",
        subtitle: "Move to the next theme family",
        kind: "command",
        onSelect: () => void cycleTheme()
      });

      themes.forEach((theme) => {
        const modeLabel = settings?.themeMode ?? "light";
        items.push({
          id: `theme-${theme.id}`,
          title: `Use theme: ${theme.name}`,
          subtitle: `${modeLabel}:${theme.id}`,
          kind: "theme",
          onPreview: () => setPreviewTheme(theme.id),
          onSelect: async () => {
            setPreviewTheme(null);
            await saveSettings({ themeId: theme.id });
            setIsPaletteOpen(false);
          }
        });
      });
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
        kind: "file",
        onSelect: () => void openFile(file.path)
      });
    });

    searchResults.slice(0, 8).forEach((result) => {
      items.push({
        id: `search-${result.path}-${result.line}`,
        title: result.name,
        subtitle: `${result.snippet} · line ${result.line}`,
        kind: "file",
        onSelect: () => void openFile(result.path)
      });
    });

    return items;
  }, [files, paletteQuery, searchResults, settings, rootPath]);

  useEffect(() => {
    if (!isPaletteOpen) {
      setPreviewTheme(null);
      setPaletteQuery("");
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex(0);
  }, [isPaletteOpen]);

  useEffect(() => {
    const candidate = paletteItems[selectedIndex];
    candidate?.onPreview?.();
  }, [paletteItems, selectedIndex]);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setIsPaletteOpen((value) => !value);
        return;
      }

      if (modifier && event.key.toLowerCase() === "s" && activeFile) {
        event.preventDefault();
        setSaving(true);
        const savedFile = await typist.saveFile(activeFile.path, draftContent);
        markSaved(savedFile);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeFile, draftContent, markSaved, setSaving, typist]);

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
        }
        return;
      }

      if (command === "open-folder") {
        const workspace = await typist.openFolder();
        if (workspace) {
          setWorkspace(workspace);
        }
        return;
      }

      if (command === "save" && activeFile) {
        const savedFile = await typist.saveFile(activeFile.path, draftContent);
        markSaved(savedFile);
      }
    });
  }, [activeFile, draftContent, markSaved, setActiveFile, setWorkspace, typist]);

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
        onOpenFile={(filePath) => void openFile(filePath)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <main className="workspace-shell single-pane">
        {error ? <div className="error-banner">{error}</div> : null}
        <MarkdownEditor
          content={draftContent}
          fileName={activeFile?.name ?? null}
          saveStateLabel={saveStateLabel}
          onChange={updateDraftContent}
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
          setPreviewTheme(null);
        }}
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
          }
        }}
        onChangeMode={async (mode: ThemeMode) => {
          await saveSettings({ themeMode: mode });
        }}
        onChangeTheme={async (themeId) => {
          await saveSettings({ themeId });
        }}
      />
    </div>
  );
}
