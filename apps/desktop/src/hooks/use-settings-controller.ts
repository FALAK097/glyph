import { useCallback, useEffect, useMemo, useState } from "react";

import { mergeShortcutSettings } from "@/shared/shortcuts";
import type { AppInfo, AppSettings, ThemeMode, UpdateState } from "@/shared/workspace";
import { applyTheme } from "@/theme/themes";

type UseSettingsControllerOptions = {
  glyph: NonNullable<Window["glyph"]>;
};

export function useSettingsController({ glyph }: UseSettingsControllerOptions) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await glyph.updateSettings(patch);
      setSettings(next);
      return next;
    },
    [glyph],
  );

  const changeThemeMode = useCallback(
    async (mode: ThemeMode) => {
      await saveSettings({ themeMode: mode });
    },
    [saveSettings],
  );

  const changeShortcuts = useCallback(
    async (nextShortcuts: AppSettings["shortcuts"]) => {
      await saveSettings({ shortcuts: nextShortcuts });
    },
    [saveSettings],
  );

  const shortcuts = useMemo(() => {
    return mergeShortcutSettings(settings?.shortcuts ?? null);
  }, [settings?.shortcuts]);

  useEffect(() => {
    if (!settings) {
      return;
    }
    applyTheme(settings.themeMode);
  }, [settings]);

  useEffect(
    () =>
      glyph.onUpdateStateChange((nextUpdateState) => {
        setUpdateState(nextUpdateState);
      }),
    [glyph],
  );

  return {
    settings,
    setSettings,
    appInfo,
    setAppInfo,
    updateState,
    setUpdateState,
    isSettingsOpen,
    setIsSettingsOpen,
    saveSettings,
    changeThemeMode,
    changeShortcuts,
    shortcuts,
  };
}
