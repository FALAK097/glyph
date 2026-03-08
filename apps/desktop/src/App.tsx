import { useEffect, useMemo, useState } from "react";
import { EditorPane } from "./components/EditorPane";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { QuickOpenPanel } from "./components/QuickOpenPanel";
import { SearchPanel } from "./components/SearchPanel";
import { Sidebar } from "./components/Sidebar";
import type { DirectoryNode, SearchResult } from "./shared/workspace";
import { useWorkspaceStore } from "./store/workspace";

type QuickOpenItem = {
  path: string;
  name: string;
  relativePath: string;
};

function flattenFiles(nodes: DirectoryNode[], rootPath: string | null): QuickOpenItem[] {
  const items: QuickOpenItem[] = [];

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
          <p>
            The desktop window loaded, but the secure preload bridge was not available in the renderer. Check the
            terminal for Electron preload errors, then restart `pnpm dev:desktop`.
          </p>
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

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");

  const quickOpenItems = useMemo(() => {
    const files = flattenFiles(tree, rootPath);
    const needle = quickOpenQuery.trim().toLowerCase();

    if (!needle) {
      return files.slice(0, 30);
    }

    return files
      .filter((item) => {
        const candidate = `${item.name} ${item.relativePath}`.toLowerCase();
        return candidate.includes(needle);
      })
      .slice(0, 30);
  }, [quickOpenQuery, rootPath, tree]);

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
    if (!isSearchOpen || !rootPath || !searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const results = await typist.searchWorkspace(searchQuery);

        if (!cancelled) {
          setSearchResults(results);
          setIsSearching(false);
        }
      } catch (searchError) {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : "Unable to search workspace.");
          setIsSearching(false);
        }
      }
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSearchOpen, rootPath, searchQuery, setError, typist]);

  const confirmDiscardChanges = () => {
    if (!isDirty) {
      return true;
    }

    return window.confirm("You have unsaved changes. Discard them?");
  };

  const handleSave = async () => {
    if (!activeFile) {
      return;
    }

    setSaving(true);
    try {
      const savedFile = await typist.saveFile(activeFile.path, draftContent);
      markSaved(savedFile);
    } catch (saveError) {
      setSaving(false);
      setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
    }
  };

  useEffect(() => {
    if (!activeFile || !isDirty || isSaving) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleSave();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [activeFile?.path, draftContent, isDirty, isSaving]);

  const closeTransientPanels = () => {
    setIsSearchOpen(false);
    setIsQuickOpenOpen(false);
  };

  const handleOpenFolder = async () => {
    if (!confirmDiscardChanges()) {
      return;
    }

    try {
      const workspace = await typist.openFolder();
      if (workspace) {
        setWorkspace(workspace);
        setSearchQuery("");
        setSearchResults([]);
        setQuickOpenQuery("");
        closeTransientPanels();
      }
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open folder.");
    }
  };

  const handleOpenDocument = async () => {
    if (!confirmDiscardChanges()) {
      return;
    }

    try {
      const file = await typist.openDocument();
      if (file) {
        setWorkspace({
          rootPath: file.path,
          tree: [],
          activeFile: file
        });
        closeTransientPanels();
      }
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open file.");
    }
  };

  const handleFileOpen = async (filePath: string) => {
    if (filePath === activeFile?.path) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    try {
      const file = await typist.readFile(filePath);
      setActiveFile(file);
      closeTransientPanels();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to read file.");
    }
  };

  const handleOpenSearchResult = async (result: SearchResult) => {
    await handleFileOpen(result.path);
  };

  const handleOpenQuickItem = async (item: QuickOpenItem) => {
    await handleFileOpen(item.path);
  };

  const resolveCurrentDirectory = () => {
    if (activeFile?.path) {
      return activeFile.path.split("/").slice(0, -1).join("/");
    }

    return rootPath;
  };

  const handleCreateFile = async () => {
    const parentDir = resolveCurrentDirectory();

    if (!parentDir) {
      setError("Open a folder before creating a file.");
      return;
    }

    const nextName = window.prompt("New markdown file name", "untitled.md");
    if (!nextName) {
      return;
    }

    try {
      const file = await typist.createFile(parentDir, nextName);
      setActiveFile(file);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create file.");
    }
  };

  const handleCreateFolder = async () => {
    const parentDir = resolveCurrentDirectory();

    if (!parentDir || !rootPath) {
      setError("Open a folder before creating a folder.");
      return;
    }

    const nextName = window.prompt("New folder name", "notes");
    if (!nextName) {
      return;
    }

    try {
      const nextTree = await typist.createFolder(parentDir, nextName);
      setTree(nextTree);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create folder.");
    }
  };

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (!modifier) {
        return;
      }

      if (event.key.toLowerCase() === "o" && !event.shiftKey) {
        event.preventDefault();
        await handleOpenDocument();
      }

      if (event.key.toLowerCase() === "o" && event.shiftKey) {
        event.preventDefault();
        await handleOpenFolder();
      }

      if (event.key.toLowerCase() === "s" && activeFile && isDirty) {
        event.preventDefault();
        await handleSave();
      }

      if (event.key.toLowerCase() === "n" && !event.shiftKey) {
        event.preventDefault();
        await handleCreateFile();
      }

      if (event.key.toLowerCase() === "n" && event.shiftKey) {
        event.preventDefault();
        await handleCreateFolder();
      }

      if (event.key.toLowerCase() === "f" && event.shiftKey) {
        event.preventDefault();
        setIsQuickOpenOpen(false);
        setIsSearchOpen(true);
      }

      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        setIsSearchOpen(false);
        setIsQuickOpenOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeFile, isDirty, rootPath, typist]);

  useEffect(() => {
    return typist.onCommand(async (command) => {
      if (command === "open-file") {
        await handleOpenDocument();
        return;
      }

      if (command === "open-folder") {
        await handleOpenFolder();
        return;
      }

      if (command === "save") {
        await handleSave();
        return;
      }

      if (command === "new-file") {
        await handleCreateFile();
        return;
      }

      if (command === "new-folder") {
        await handleCreateFolder();
        return;
      }

      if (command === "search") {
        setIsQuickOpenOpen(false);
        setIsSearchOpen(true);
        return;
      }

      if (command === "quick-open") {
        setIsSearchOpen(false);
        setIsQuickOpenOpen(true);
      }
    });
  }, [activeFile, draftContent, isDirty, rootPath, typist]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const saveStateLabel = isSaving
    ? "Saving changes..."
    : isDirty
      ? "Unsaved changes"
      : lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "Open a markdown file to start editing";

  return (
    <div className="app-shell">
      <Sidebar
        rootPath={rootPath}
        tree={tree}
        activePath={activeFile?.path ?? null}
        onOpenFile={handleFileOpen}
      />
      <main className="workspace-shell">
        <header className="hero">
          <div>
            <p className="hero-eyebrow">Minimal Markdown Workspace</p>
            <h1>Typist</h1>
            <p className="hero-copy">
              The desktop app now supports workspace browsing, quick open, markdown editing, live preview, autosave,
              and global search while the richer inline editor is still in progress.
            </p>
          </div>
          <div className="hero-actions">
            <button className="secondary-button" onClick={() => {
              setIsSearchOpen(false);
              setIsQuickOpenOpen(true);
            }} type="button">
              Quick Open
            </button>
            <button className="secondary-button" onClick={() => {
              setIsQuickOpenOpen(false);
              setIsSearchOpen(true);
            }} type="button">
              Search
            </button>
            <button className="secondary-button" onClick={handleCreateFile} type="button">
              New File
            </button>
            <button className="secondary-button" onClick={handleCreateFolder} type="button">
              New Folder
            </button>
            <button className="secondary-button" onClick={handleOpenDocument} type="button">
              Open File
            </button>
            <button className="primary-button" onClick={handleOpenFolder} type="button">
              Open Folder
            </button>
          </div>
        </header>
        {error ? <div className="error-banner">{error}</div> : null}
        <QuickOpenPanel
          query={quickOpenQuery}
          items={quickOpenItems}
          isOpen={isQuickOpenOpen}
          onChangeQuery={setQuickOpenQuery}
          onClose={() => setIsQuickOpenOpen(false)}
          onOpenItem={handleOpenQuickItem}
        />
        <SearchPanel
          query={searchQuery}
          results={searchResults}
          isLoading={isSearching}
          isOpen={isSearchOpen}
          onChangeQuery={setSearchQuery}
          onClose={() => setIsSearchOpen(false)}
          onOpenResult={handleOpenSearchResult}
        />
        <section className="workspace-panels">
          <EditorPane
            content={draftContent}
            path={activeFile?.path ?? null}
            isDirty={isDirty}
            isSaving={isSaving}
            saveStateLabel={saveStateLabel}
            onChange={updateDraftContent}
            onSave={handleSave}
          />
          <MarkdownPreview content={draftContent} />
        </section>
      </main>
    </div>
  );
}
