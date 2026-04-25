import type { UpdateState } from "./workspace";

export function getDevPreviewUpdateState(): UpdateState | null {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const previewStatus = window.localStorage.getItem("glyph.dev.update-preview");

  if (previewStatus === "available") {
    return {
      status: "available",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: null,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloading") {
    return {
      status: "downloading",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: 68,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloaded") {
    return {
      status: "downloaded",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: "0.2.0",
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: 100,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "installed") {
    return {
      status: "not-available",
      currentVersion: "0.2.0",
      availableVersion: null,
      downloadedVersion: null,
      recentlyInstalledVersion: "0.2.0",
      releasePageUrl: null,
      releaseName: null,
      releaseNotes: null,
      progressPercent: null,
      checkedAt: null,
      errorMessage: null,
    };
  }

  return null;
}
