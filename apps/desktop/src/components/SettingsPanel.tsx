import type { AppSettings, ThemeMode } from "../shared/workspace";
import { themes } from "../theme/themes";

type SettingsPanelProps = {
  isOpen: boolean;
  settings: AppSettings | null;
  onClose: () => void;
  onChooseFolder: () => void;
  onChangeMode: (mode: ThemeMode) => void;
  onChangeTheme: (themeId: string) => void;
};

export function SettingsPanel({
  isOpen,
  settings,
  onClose,
  onChooseFolder,
  onChangeMode,
  onChangeTheme
}: SettingsPanelProps) {
  if (!isOpen || !settings) {
    return null;
  }

  return (
    <section className="modal-shell">
      <div className="modal-card settings-card">
        <div className="modal-header">
          <div>
            <p className="panel-label">Settings</p>
            <h2>Workspace and appearance</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settings-group">
          <label className="settings-label">Default notes folder</label>
          <div className="settings-path-row">
            <input className="settings-path" readOnly value={settings.defaultWorkspacePath} />
            <button className="secondary-button" type="button" onClick={onChooseFolder}>
              Change
            </button>
          </div>
        </div>
        <div className="settings-group">
          <label className="settings-label">Appearance mode</label>
          <div className="mode-toggle">
            {(["light", "dark"] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                className={`mode-button ${settings.themeMode === mode ? "is-active" : ""}`}
                type="button"
                onClick={() => onChangeMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-group">
          <label className="settings-label">Theme family</label>
          <div className="theme-grid">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`theme-chip ${settings.themeId === theme.id ? "is-active" : ""}`}
                type="button"
                onClick={() => onChangeTheme(theme.id)}
              >
                {theme.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
