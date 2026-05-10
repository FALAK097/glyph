import type { AppInfo, AppSettings, ShortcutSetting } from "@/core/workspace";

export type SettingsPanelProps = {
  isOpen: boolean;
  settings: AppSettings | null;
  appInfo: AppInfo | null;
  onClose: () => void;
  onChooseFolder: () => void;
  onChangeShortcuts: (shortcuts: ShortcutSetting[]) => void;
};
