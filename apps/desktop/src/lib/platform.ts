export function getFolderRevealLabel(platform: string | null | undefined) {
  if (platform === "win32") {
    return "Reveal in Explorer";
  }

  if (platform === "darwin") {
    return "Reveal in Finder";
  }

  return "Reveal in File Manager";
}
