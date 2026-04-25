import type { DirectoryNode } from "./workspace";

import type { FlatFile } from "../types/app";

import { getRelativePath } from "./paths";

export function flattenFiles(nodes: DirectoryNode[], rootPath: string | null): FlatFile[] {
  const items: FlatFile[] = [];

  for (const node of nodes) {
    if (node.type === "file") {
      items.push({
        path: node.path,
        name: node.name,
        relativePath: getRelativePath(node.path, rootPath),
      });
      continue;
    }

    items.push(...flattenFiles(node.children, rootPath));
  }

  return items;
}
