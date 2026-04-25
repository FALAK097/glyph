export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function isSamePath(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase();
}

export function isPathInside(targetPath: string, parentPath: string): boolean {
  const normalizedTarget = normalizePath(targetPath).toLowerCase();
  const normalizedParent = normalizePath(parentPath).replace(/\/+$/, "").toLowerCase();

  return (
    normalizedTarget === normalizedParent || normalizedTarget.startsWith(`${normalizedParent}/`)
  );
}

export function getBaseName(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

const MARKDOWN_FILE_SUFFIX_PATTERN = /\.(md|mdx|markdown)$/i;

export function getDisplayFileName(fileName: string): string {
  const trimmedName = fileName.trim();

  if (!trimmedName) {
    return fileName;
  }

  const strippedName = trimmedName.replace(MARKDOWN_FILE_SUFFIX_PATTERN, "");

  // Preserve dotfiles like ".md" instead of rendering an empty label.
  return strippedName.length > 0 ? strippedName : trimmedName;
}

export function getRelativePath(filePath: string, rootPath: string | null): string {
  if (!rootPath) {
    return getBaseName(filePath);
  }

  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath).replace(/\/+$/, "");

  const fileLower = normalizedFilePath.toLowerCase();
  const rootLower = normalizedRootPath.toLowerCase();

  if (fileLower.startsWith(`${rootLower}/`)) {
    return normalizedFilePath.slice(normalizedRootPath.length + 1);
  }

  return getBaseName(normalizedFilePath);
}

export function isFileInsideWorkspace(filePath: string, rootPath: string | null): boolean {
  if (!rootPath) {
    return false;
  }

  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath).replace(/\/+$/, "");
  return normalizedFilePath.toLowerCase().startsWith(`${normalizedRootPath.toLowerCase()}/`);
}

export function getDirName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  if (parts.length <= 1) {
    return "";
  }
  parts.pop();
  return parts.join("/");
}
