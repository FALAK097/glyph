import type { AppSettings, ShortcutSetting, ThemeMode } from "../shared/workspace";
import { useState, useEffect, useRef } from "react";
import { DEFAULT_SHORTCUTS, canonicalizeShortcut, mergeShortcutSettings } from "../shared/shortcuts";


function CustomSelect({ value, onChange, options }: { value: string; onChange: (val: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      aria-label="Theme mode"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-[120px] bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-primary/20"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

type SettingsPanelProps = {
  isOpen: boolean;
  settings: AppSettings | null;
  onClose: () => void;
  onChooseFolder: () => void;
  onChangeMode: (mode: ThemeMode) => void;
  onChangeShortcuts: (shortcuts: ShortcutSetting[]) => void;
};

export function SettingsPanel({
  isOpen,
  settings,
  onClose,
  onChooseFolder,
  onChangeMode,
  onChangeShortcuts
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [capturedKeys, setCapturedKeys] = useState<string>("");
  const [shortcutFilter, setShortcutFilter] = useState("");
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShortcuts(mergeShortcutSettings(settings?.shortcuts));
  }, [settings]);

  useEffect(() => {
    if (editingShortcut && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingShortcut]);

  const formatKeyCombo = (e: React.KeyboardEvent<HTMLInputElement>): string => {
    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push("⌘");
    if (e.altKey) parts.push("⌥");
    if (e.shiftKey) parts.push("⇧");
    const key = e.key;
    if (!["Meta", "Control", "Alt", "Shift"].includes(key)) {
      parts.push(key);
    }
    return canonicalizeShortcut(parts.join(" ")) ?? parts.join(" ");
  };

  const commitShortcutChange = (shortcutId: string, nextKeys: string) => {
    const normalizedKeys = canonicalizeShortcut(nextKeys);

    if (!normalizedKeys) {
      setShortcutError("Shortcut must include at least one non-modifier key.");
      return false;
    }

    const conflict = shortcuts.find(
      (shortcut) => shortcut.id !== shortcutId && canonicalizeShortcut(shortcut.keys) === normalizedKeys
    );

    if (conflict) {
      setShortcutError(`${normalizedKeys} is already assigned to ${conflict.label}.`);
      return false;
    }

    const updated = shortcuts.map((shortcut) =>
      shortcut.id === shortcutId ? { ...shortcut, keys: normalizedKeys } : shortcut
    );
    setShortcuts(updated);
    onChangeShortcuts(updated.map(({ id, keys }) => ({ id, keys })));
    setShortcutError(null);
    return true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      setEditingShortcut(null);
      setCapturedKeys("");
      setShortcutError(null);
      return;
    }
    if (e.key === "Enter") {
      if (capturedKeys && editingShortcut) {
        if (!commitShortcutChange(editingShortcut, capturedKeys)) {
          return;
        }
      }
      setEditingShortcut(null);
      setCapturedKeys("");
      return;
    }
    setCapturedKeys(formatKeyCombo(e));
  };

  const handleReset = () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    onChangeShortcuts(DEFAULT_SHORTCUTS.map(({ id, keys }) => ({ id, keys })));
    setShortcutFilter("");
    setCapturedKeys("");
    setEditingShortcut(null);
    setShortcutError(null);
  };

  if (!isOpen || !settings) {
    return null;
  }

  const filteredShortcuts = shortcuts.filter(s => 
    s.label.toLowerCase().includes(shortcutFilter.toLowerCase()) || 
    s.keys.toLowerCase().includes(shortcutFilter.toLowerCase())
  );

  return (
    <section className="modal-shell" role="presentation" onMouseDown={onClose}>
      <div
        className="w-full max-w-[900px] h-[550px] max-h-[85vh] bg-background border border-border shadow-xl rounded-xl flex overflow-hidden p-0 relative"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ padding: 0 }}
      >
        <div className="w-[240px] bg-muted/30 border-r border-border p-4 flex flex-col justify-between">
          <div className="space-y-8 mt-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Desktop</p>
              <div className="space-y-1">
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  onClick={() => setActiveTab('general')}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    General
                  </div>
                </button>
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'shortcuts' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  onClick={() => setActiveTab('shortcuts')}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>
                    Shortcuts
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div className="px-3 text-xs text-muted-foreground/60">
            Typist Desktop<br/>v1.0.0
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-12 max-w-3xl">
              <div>
                <h2 className="text-lg font-medium mb-6">General</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-border/40 gap-8">
                    <div className="space-y-1 shrink-0">
                      <p className="text-sm font-medium">Default notes folder</p>
                      <p className="text-xs text-muted-foreground">Where your new notes will be saved</p>
                    </div>
                    <div className="flex items-center gap-4 min-w-0 flex-1 justify-end">
                      <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded truncate" title={settings.defaultWorkspacePath}>
                        {settings.defaultWorkspacePath}
                      </div>
                      <button 
                        className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors shadow-sm shrink-0" 
                        type="button" 
                        onClick={onChooseFolder}
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-border/40 gap-8">
                     <div className="space-y-1 shrink-0">
                        <p className="text-sm font-medium">Appearance</p>
                        <p className="text-xs text-muted-foreground">Customise how Typist looks on your device</p>
                     </div>
                     <div className="relative">
                        <CustomSelect 
                          value={settings.themeMode} 
                          onChange={(val) => onChangeMode(val as ThemeMode)}
                          options={[
                            { value: 'light', label: 'Light' },
                            { value: 'dark', label: 'Dark' },
                            { value: 'system', label: 'System' }
                          ]}
                        />
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Keyboard Shortcuts</h2>
                <button
                  className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded hover:bg-muted transition-colors"
                  onClick={handleReset}
                >
                  Reset to defaults
                </button>
              </div>
              
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                 </div>
                 <input
                   type="text"
                   placeholder="Search shortcuts"
                   value={shortcutFilter}
                   onChange={(e) => setShortcutFilter(e.target.value)}
                   className="w-full bg-muted/30 border border-border text-sm rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                 />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground mt-6 mb-2">General</h3>
                <div className="bg-transparent divide-y divide-border/40 border-t border-b border-border/40">
                  {filteredShortcuts.map((shortcut) => (
                    <div 
                      key={shortcut.id} 
                      className="flex items-center justify-between py-3 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded-md"
                    >
                      <span className="text-sm font-medium">{shortcut.label}</span>
                      {editingShortcut === shortcut.id ? (
                        <input
                          ref={inputRef}
                          type="text"
                          className="px-3 py-1.5 bg-background border border-primary rounded-md text-xs font-mono w-32 text-center focus:outline-none shadow-sm"
                          value={capturedKeys}
                          onKeyDown={handleKeyDown}
                          onBlur={() => {
                            if (capturedKeys && editingShortcut) {
                              commitShortcutChange(editingShortcut, capturedKeys);
                            }
                            setEditingShortcut(null);
                            setCapturedKeys("");
                          }}
                          placeholder="Press keys..."
                          readOnly
                        />
                      ) : (
                        <button
                          className="px-2 py-1 bg-muted/50 hover:bg-muted rounded text-xs font-mono transition-colors min-w-[80px] text-center border border-border/50 hover:border-border"
                          onClick={() => {
                            setEditingShortcut(shortcut.id);
                            setCapturedKeys(shortcut.keys);
                            setShortcutError(null);
                          }}
                        >
                          {shortcut.keys}
                        </button>
                      )}
                    </div>
                  ))}
                  {filteredShortcuts.length === 0 && (
                     <div className="py-8 text-center text-sm text-muted-foreground">
                        No shortcuts found matching "{shortcutFilter}"
                     </div>
                  )}
                </div>
                {shortcutError ? <p className="mt-3 text-sm text-destructive">{shortcutError}</p> : null}
              </div>
            </div>
          )}
        </div>
        <button 
          className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </section>
  );
}
