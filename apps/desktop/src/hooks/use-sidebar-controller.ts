import { useCallback, useEffect, useMemo, useState } from "react";

import type { DirectoryNode, FileDocument, WorkspaceSnapshot } from "@/core/workspace";
import type { AppSettings } from "@/core/workspace";
import type { SidebarItemSetting } from "@/core/workspace";
import type { DragPosition, SidebarTopLevelNode } from "@/types/sidebar";

import { isPathInside, isSamePath, normalizePath } from "@/core/paths";
import {
  filterSidebarNodes,
  removeSidebarPath,
  reorderSidebarNodes,
  toSidebarItemSetting,
  upsertSidebarFolder,
} from "@/core/sidebar-tree";

type UseSidebarControllerOptions = {
  glyph: NonNullable<Window["glyph"]>;
  settings: AppSettings | null;
  saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  rootPath: string | null;
  setWorkspace: (payload: {
    rootPath: string;
    tree: DirectoryNode[];
    activeFile: FileDocument | null;
  }) => void;
  setIsWorkspaceMode: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarNodes: DirectoryNode[];
  setSidebarNodes: React.Dispatch<React.SetStateAction<DirectoryNode[]>>;
  hasHydratedSidebar: boolean;
  _setHasHydratedSidebar: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useSidebarController({
  glyph,
  settings,
  saveSettings,
  rootPath,
  setWorkspace,
  setIsWorkspaceMode,
  sidebarNodes,
  setSidebarNodes,
  hasHydratedSidebar,
  _setHasHydratedSidebar,
}: UseSidebarControllerOptions) {
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<string[]>([]);

  const hiddenFilePaths = settings?.hiddenFiles ?? [];
  const hiddenFileKeys = useMemo(
    () => new Set(hiddenFilePaths.map((filePath) => normalizePath(filePath).toLowerCase())),
    [hiddenFilePaths],
  );

  const visibleSidebarNodes = useMemo<SidebarTopLevelNode[]>(() => {
    const expanded = new Set(expandedFolderPaths.map((p) => normalizePath(p).toLowerCase()));
    const filteredNodes = filterSidebarNodes(sidebarNodes, (targetPath) =>
      hiddenFileKeys.has(normalizePath(targetPath).toLowerCase()),
    );

    return filteredNodes.map((node) => ({
      node,
      isExpanded:
        node.type === "directory" ? expanded.has(normalizePath(node.path).toLowerCase()) : true,
    }));
  }, [expandedFolderPaths, hiddenFileKeys, sidebarNodes]);

  const persistedSidebar = useMemo(
    () => ({
      items: sidebarNodes.map(toSidebarItemSetting),
      expandedFolders: expandedFolderPaths,
    }),
    [expandedFolderPaths, sidebarNodes],
  );

  const restoreSidebarNodes = useCallback(
    async (items: SidebarItemSetting[]) => {
      const resolved = await Promise.all(
        items.map((item) => glyph.getSidebarNode(item.kind, item.path)),
      );
      return resolved.filter((node): node is DirectoryNode => node !== null);
    },
    [glyph],
  );

  const syncWorkspace = useCallback(
    (workspace: WorkspaceSnapshot) => {
      setWorkspace(workspace);
      setSidebarNodes((prev) => upsertSidebarFolder(prev, workspace));
      setExpandedFolderPaths((prev) =>
        prev.some((p) => isSamePath(p, workspace.rootPath)) ? prev : [...prev, workspace.rootPath],
      );
    },
    [setWorkspace, setSidebarNodes],
  );

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolderPaths((prev) =>
      prev.some((path) => isSamePath(path, folderPath))
        ? prev.filter((path) => !isSamePath(path, folderPath))
        : [...prev, folderPath],
    );
  }, []);

  const handleReorderNodes = useCallback(
    (sourcePath: string, targetPath: string, position: DragPosition) => {
      setSidebarNodes((prev) => reorderSidebarNodes(prev, sourcePath, targetPath, position));
    },
    [setSidebarNodes],
  );

  const handleRemoveFolder = useCallback(
    (folderPath: string) => {
      setSidebarNodes((prev) => removeSidebarPath(prev, folderPath));
      setExpandedFolderPaths((prev) => prev.filter((path) => !isPathInside(path, folderPath)));

      if (rootPath && isSamePath(rootPath, folderPath)) {
        setWorkspace({ rootPath: "", tree: [], activeFile: null });
        setIsWorkspaceMode(false);
      }
    },
    [rootPath, setWorkspace, setIsWorkspaceMode, setSidebarNodes],
  );

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

  return {
    visibleSidebarNodes,
    hiddenFileKeys,
    expandedFolderPaths,
    setExpandedFolderPaths,
    restoreSidebarNodes,
    syncWorkspace,
    handleToggleFolder,
    handleReorderNodes,
    handleRemoveFolder,
  };
}
