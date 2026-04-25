import type { BreadcrumbItem, OutlineItem } from "@/types/navigation";

import { getBaseName, getDisplayFileName, getRelativePath, normalizePath } from "./paths";

const HEADING_PATTERN = /^(#{1,4})\s+(.*)$/;

export function createHeadingId(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\]()>#+.!?,:;'"/\\]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return normalized || "section";
}

export function extractMarkdownOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split(/\r?\n/);
  const counts = new Map<string, number>();
  const items: OutlineItem[] = [];

  lines.forEach((lineText, index) => {
    const match = lineText.match(HEADING_PATTERN);
    if (!match) {
      return;
    }

    const [, hashes, rawTitle] = match;
    const title = rawTitle.trim();
    if (!title) {
      return;
    }

    const baseId = createHeadingId(title);
    const instanceCount = counts.get(baseId) ?? 0;
    counts.set(baseId, instanceCount + 1);

    items.push({
      id: instanceCount === 0 ? baseId : `${baseId}-${instanceCount + 1}`,
      depth: hashes.length,
      title,
      line: index + 1,
    });
  });

  return items;
}

export function buildBreadcrumbs(filePath: string | null, rootPath: string | null) {
  if (!filePath) {
    return [] satisfies BreadcrumbItem[];
  }

  const normalizedFilePath = normalizePath(filePath);
  const fileName = getBaseName(normalizedFilePath);
  const directoryPath = normalizedFilePath.slice(0, normalizedFilePath.length - fileName.length);
  const directoryParts = directoryPath
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!rootPath) {
    const parent = directoryParts.at(-1);
    return [
      ...(parent
        ? [
            {
              id: "standalone-parent",
              label: parent,
              path: directoryPath.replace(/\/$/, ""),
            },
          ]
        : []),
      {
        id: "standalone-file",
        label: getDisplayFileName(fileName),
        path: normalizedFilePath,
      },
    ];
  }

  const relativePath = getRelativePath(normalizedFilePath, rootPath);
  const parts = relativePath.split("/").filter(Boolean);
  const rootName = getBaseName(rootPath);
  const breadcrumbs: BreadcrumbItem[] = [
    {
      id: rootPath,
      label: rootName,
      path: rootPath,
    },
  ];

  let currentPath = normalizePath(rootPath).replace(/\/+$/, "");
  parts.forEach((part, index) => {
    currentPath = `${currentPath}/${part}`;
    breadcrumbs.push({
      id: `${currentPath}:${index}`,
      label: index === parts.length - 1 ? getDisplayFileName(part) : part,
      path: currentPath,
    });
  });

  return breadcrumbs;
}
