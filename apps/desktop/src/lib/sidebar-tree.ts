import type { DragPosition } from "../types/sidebar";
import type {
  DirectoryNode,
  FileDocument,
  SidebarItemSetting,
  WorkspaceSnapshot,
} from "../shared/workspace";

import { getBaseName, isFileInsideWorkspace, isSamePath, normalizePath } from "./paths";

export function toSidebarItemSetting(node: DirectoryNode): SidebarItemSetting {
  return {
    kind: node.type,
    path: node.path,
  };
}

export function orderSidebarNodes(
  nodes: DirectoryNode[],
  orderedItems: SidebarItemSetting[],
): DirectoryNode[] {
  const remaining = new Map(nodes.map((node) => [normalizePath(node.path).toLowerCase(), node]));
  const ordered: DirectoryNode[] = [];

  for (const item of orderedItems) {
    const key = normalizePath(item.path).toLowerCase();
    const match = remaining.get(key);
    if (!match || match.type !== item.kind) {
      continue;
    }

    ordered.push(match);
    remaining.delete(key);
  }

  return [...ordered, ...remaining.values()];
}

export function reorderSidebarNodes(
  nodes: DirectoryNode[],
  sourcePath: string,
  targetPath: string,
  position: DragPosition,
): DirectoryNode[] {
  const sourceIndex = nodes.findIndex((node) => isSamePath(node.path, sourcePath));
  const targetIndex = nodes.findIndex((node) => isSamePath(node.path, targetPath));

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return nodes;
  }

  const nextNodes = [...nodes];
  const [sourceNode] = nextNodes.splice(sourceIndex, 1);
  const adjustedTargetIndex = nextNodes.findIndex((node) => isSamePath(node.path, targetPath));
  const insertIndex = position === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
  nextNodes.splice(insertIndex, 0, sourceNode);
  return nextNodes;
}

export function upsertSidebarFolder(
  nodes: DirectoryNode[],
  workspace: WorkspaceSnapshot,
): DirectoryNode[] {
  const nextFolder: DirectoryNode = {
    type: "directory",
    name: getBaseName(workspace.rootPath),
    path: workspace.rootPath,
    children: workspace.tree,
  };

  const nextNodes = nodes.filter(
    (node) => !(node.type === "file" && isFileInsideWorkspace(node.path, workspace.rootPath)),
  );
  const existingIndex = nextNodes.findIndex(
    (node) => node.type === "directory" && isSamePath(node.path, workspace.rootPath),
  );

  if (existingIndex === -1) {
    return [...nextNodes, nextFolder];
  }

  return nextNodes.map((node, index) => (index === existingIndex ? nextFolder : node));
}

export function upsertSidebarFile(
  nodes: DirectoryNode[],
  file: Pick<FileDocument, "path" | "name">,
): DirectoryNode[] {
  const isCoveredByFolder = nodes.some(
    (node) => node.type === "directory" && isFileInsideWorkspace(file.path, node.path),
  );

  if (isCoveredByFolder) {
    return nodes.filter((node) => !(node.type === "file" && isSamePath(node.path, file.path)));
  }

  const nextFile: DirectoryNode = {
    type: "file",
    name: file.name,
    path: file.path,
  };

  const existingIndex = nodes.findIndex(
    (node) => node.type === "file" && isSamePath(node.path, file.path),
  );
  if (existingIndex === -1) {
    return [...nodes, nextFile];
  }

  return nodes.map((node, index) => (index === existingIndex ? nextFile : node));
}

export function removeSidebarPath(nodes: DirectoryNode[], targetPath: string): DirectoryNode[] {
  return nodes.flatMap<DirectoryNode>((node) => {
    if (isSamePath(node.path, targetPath)) {
      return [];
    }

    if (node.type === "directory") {
      return [{ ...node, children: removeSidebarPath(node.children, targetPath) }];
    }

    return [node];
  });
}

export function filterSidebarNodes(
  nodes: DirectoryNode[],
  shouldExcludePath: (targetPath: string) => boolean,
): DirectoryNode[] {
  return nodes.flatMap<DirectoryNode>((node) => {
    if (shouldExcludePath(node.path)) {
      return [];
    }

    if (node.type === "directory") {
      return [
        {
          ...node,
          children: filterSidebarNodes(node.children, shouldExcludePath),
        },
      ];
    }

    return [node];
  });
}

export function renameSidebarFile(
  nodes: DirectoryNode[],
  oldPath: string,
  renamedFile: Pick<FileDocument, "path" | "name">,
): DirectoryNode[] {
  return nodes.map((node) => {
    if (node.type === "directory") {
      return { ...node, children: renameSidebarFile(node.children, oldPath, renamedFile) };
    }

    if (!isSamePath(node.path, oldPath)) {
      return node;
    }

    return {
      type: "file",
      path: renamedFile.path,
      name: renamedFile.name,
    };
  });
}

/**
 * Remaps a single path's prefix from oldBase to newBase (case-insensitive).
 */
function remapPathPrefix(p: string, oldBase: string, newBase: string): string {
  const norm = normalizePath(p);
  const normalizedOld = normalizePath(oldBase).replace(/\/+$/, "");
  const normalizedNew = normalizePath(newBase).replace(/\/+$/, "");

  if (norm.toLowerCase() === normalizedOld.toLowerCase()) {
    return normalizedNew;
  }

  if (norm.toLowerCase().startsWith(`${normalizedOld.toLowerCase()}/`)) {
    return normalizedNew + norm.slice(normalizedOld.length);
  }

  return norm;
}

/**
 * Recursively remaps all paths inside a DirectoryNode subtree from oldBase to newBase.
 */
function remapNodePaths(node: DirectoryNode, oldBase: string, newBase: string): DirectoryNode {
  const newPath = remapPathPrefix(node.path, oldBase, newBase);

  if (node.type === "file") {
    return { ...node, path: newPath };
  }

  return {
    ...node,
    path: newPath,
    children: node.children.map((child) => remapNodePaths(child, oldBase, newBase)),
  };
}

/**
 * Renames a folder node in the sidebar tree and remaps all descendant paths.
 */
export function renameSidebarFolder(
  nodes: DirectoryNode[],
  oldPath: string,
  newPath: string,
  newName: string,
): DirectoryNode[] {
  return nodes.map((node) => {
    if (node.type === "file") {
      return node;
    }

    if (isSamePath(node.path, oldPath)) {
      return {
        ...node,
        path: newPath,
        name: newName,
        children: node.children.map((child) => remapNodePaths(child, oldPath, newPath)),
      };
    }

    return { ...node, children: renameSidebarFolder(node.children, oldPath, newPath, newName) };
  });
}
