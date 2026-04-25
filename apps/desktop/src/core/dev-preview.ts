import type { UpdateState } from "./workspace";

const PREVIEW_STORAGE_KEY = "glyph.dev.update-preview";
const CURRENT_VERSION = "0.1.0";
const NEXT_VERSION = "0.2.0";
const RELEASE_NAME = "Glyph 0.2.0";

export function getDevPreviewUpdateState(): UpdateState | null {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const previewStatus = window.localStorage.getItem(PREVIEW_STORAGE_KEY);

  if (previewStatus === "available") {
    return {
      status: "available",
      currentVersion: CURRENT_VERSION,
      availableVersion: NEXT_VERSION,
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: RELEASE_NAME,
      releaseNotes: null,
      progressPercent: null,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloading") {
    return {
      status: "downloading",
      currentVersion: CURRENT_VERSION,
      availableVersion: NEXT_VERSION,
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: RELEASE_NAME,
      releaseNotes: null,
      progressPercent: 68,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloaded") {
    return {
      status: "downloaded",
      currentVersion: CURRENT_VERSION,
      availableVersion: NEXT_VERSION,
      downloadedVersion: NEXT_VERSION,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: RELEASE_NAME,
      releaseNotes: null,
      progressPercent: 100,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "installed") {
    return {
      status: "not-available",
      currentVersion: NEXT_VERSION,
      availableVersion: null,
      downloadedVersion: null,
      recentlyInstalledVersion: NEXT_VERSION,
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
