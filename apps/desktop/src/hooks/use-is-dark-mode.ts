import { useEffect, useState } from "react";

let sharedObserver: MutationObserver | null = null;
let sharedMediaQuery: MediaQueryList | null = null;
let listenerCount = 0;
let cachedIsDarkMode = false;
const listeners = new Set<(value: boolean) => void>();

function getSnapshot() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function syncAll() {
  cachedIsDarkMode = getSnapshot();
  for (const fn of listeners) {
    fn(cachedIsDarkMode);
  }
}

function startSharedObserver() {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  sharedObserver = new MutationObserver(syncAll);
  sharedObserver.observe(root, {
    attributes: true,
    attributeFilter: ["class"],
  });
  sharedMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  sharedMediaQuery.addEventListener("change", syncAll);
}

function stopSharedObserver() {
  sharedObserver?.disconnect();
  sharedObserver = null;
  sharedMediaQuery?.removeEventListener("change", syncAll);
  sharedMediaQuery = null;
}

/**
 * Subscribe to dark mode changes using a shared MutationObserver.
 */
export function useIsDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(getSnapshot);

  useEffect(() => {
    setIsDarkMode(cachedIsDarkMode);

    const handler = (value: boolean) => setIsDarkMode(value);
    listeners.add(handler);
    listenerCount += 1;

    if (listenerCount === 1) {
      startSharedObserver();
    }

    return () => {
      listeners.delete(handler);
      listenerCount -= 1;

      if (listenerCount === 0) {
        stopSharedObserver();
      }
    };
  }, []);

  return isDarkMode;
}
