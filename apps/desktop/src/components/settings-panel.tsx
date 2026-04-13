import { useDeferredValue, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import {
  DEFAULT_SHORTCUTS,
  canonicalizeShortcut,
  formatKeysForPlatform,
  isMacPlatform,
  mergeShortcutSettings,
  MODIFIER_TOKENS,
} from "../shared/shortcuts";

import type { ThemeMode } from "../shared/workspace";
import type { SettingsPanelProps } from "../types/settings-panel";
import { GearIcon, SearchIcon, ShortcutIcon } from "./icons";

export const SettingsPanel = ({
  isOpen,
  settings,
  appInfo,
  onClose,
  onChooseFolder,
  onChangeMode,
  onChangeShortcuts,
  onChangeAutoOpenPDF,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState("general");
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [capturedKeys, setCapturedKeys] = useState<string>("");
  const [shortcutFilter, setShortcutFilter] = useState("");
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [conflictIds, setConflictIds] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const generalButtonRef = useRef<HTMLButtonElement>(null);

  const deferredShortcutFilter = useDeferredValue(shortcutFilter);

  useEffect(() => {
    setShortcuts(mergeShortcutSettings(settings?.shortcuts));
  }, [settings]);

  useEffect(() => {
    if (editingShortcut && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingShortcut]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    requestAnimationFrame(() => generalButtonRef.current?.focus());
  }, [isOpen]);

  const formatKeyCombo = (e: React.KeyboardEvent<HTMLInputElement>): string => {
    const parts: string[] = [];
    const isMac = isMacPlatform(navigator.platform);

    // On macOS: Cmd (metaKey) is the primary modifier, Ctrl is separate.
    // On Windows/Linux: Ctrl (ctrlKey) is the primary modifier, ignore Win key (metaKey).
    if (isMac) {
      if (e.metaKey) parts.push(MODIFIER_TOKENS.cmdOrCtrl);
    } else {
      if (e.ctrlKey) parts.push(MODIFIER_TOKENS.cmdOrCtrl);
    }
    if (e.altKey) parts.push(MODIFIER_TOKENS.alt);
    if (e.shiftKey) parts.push(MODIFIER_TOKENS.shift);
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
      (shortcut) =>
        shortcut.id !== shortcutId && canonicalizeShortcut(shortcut.keys) === normalizedKeys,
    );

    if (conflict) {
      setShortcutError(`${normalizedKeys} is already assigned to ${conflict.label}.`);
      setConflictIds(new Set([shortcutId, conflict.id]));
      return false;
    }

    const updated = shortcuts.map((shortcut) =>
      shortcut.id === shortcutId ? { ...shortcut, keys: normalizedKeys } : shortcut,
    );
    setShortcuts(updated);
    onChangeShortcuts(updated.map(({ id, keys }) => ({ id, keys })));
    setShortcutError(null);
    setConflictIds(new Set());
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
    setConflictIds(new Set());
  };

  if (!settings) {
    return null;
  }

  const filteredShortcuts = shortcuts.filter((shortcut) => {
    const filter = deferredShortcutFilter.trim().toLowerCase();
    if (!filter) {
      return true;
    }

    return (
      shortcut.label.toLowerCase().includes(filter) || shortcut.keys.toLowerCase().includes(filter)
    );
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        aria-labelledby="settings-dialog-title"
        className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[900px] md:grid md:h-[550px] md:max-h-[85vh] md:grid-cols-[240px_1fr]"
      >
        <h2 id="settings-dialog-title" className="sr-only">
          Settings
        </h2>
        <div className="border-b border-border bg-muted/30 p-4 md:border-b-0 md:border-r md:border-border md:py-4 md:px-4 md:flex md:flex-col md:justify-between">
          <div className="space-y-8 md:mt-4">
            <div>
              <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Desktop
              </p>
              <div className="space-y-1">
                <Button
                  ref={generalButtonRef}
                  variant={activeTab === "general" ? "secondary" : "ghost"}
                  className="h-9 w-full justify-start gap-2 px-3 text-sm"
                  type="button"
                  onClick={() => setActiveTab("general")}
                >
                  <GearIcon size={16} />
                  General
                </Button>
                <Button
                  variant={activeTab === "shortcuts" ? "secondary" : "ghost"}
                  className="h-9 w-full justify-start gap-2 px-3 text-sm"
                  type="button"
                  onClick={() => setActiveTab("shortcuts")}
                >
                  <ShortcutIcon size={16} />
                  Shortcuts
                </Button>
              </div>
            </div>
          </div>
          <div className="hidden px-3 text-xs text-muted-foreground/60 md:block">
            Glyph Desktop
            <br />
            {appInfo
              ? `v${appInfo.version}${appInfo.isPackaged ? "" : " (dev)"}`
              : "Version unavailable"}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide p-6 md:max-h-none md:p-8">
          {activeTab === "general" ? (
            <div className="max-w-3xl space-y-12">
              <div>
                <h2 className="mb-6 text-lg font-medium">General</h2>

                <div className="space-y-6">
                  <div className="flex flex-col justify-between gap-4 border-b border-border/40 py-4 sm:flex-row sm:items-center sm:gap-8">
                    <div className="shrink-0 space-y-1">
                      <p className="text-sm font-medium">Default notes folder</p>
                      <p className="text-xs text-muted-foreground">
                        Where your new notes will be saved
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate rounded bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground">
                            {settings.defaultWorkspacePath}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {settings.defaultWorkspacePath}
                        </TooltipContent>
                      </Tooltip>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        type="button"
                        onClick={onChooseFolder}
                      >
                        Change
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4 border-b border-border/40 py-4 sm:flex-row sm:items-center sm:gap-8">
                    <div className="shrink-0 space-y-1">
                      <p className="text-sm font-medium">Appearance</p>
                      <p className="text-xs text-muted-foreground">
                        Customise how Glyph looks on your device
                      </p>
                    </div>
                    <Select
                      value={settings.themeMode}
                      onValueChange={(value) => onChangeMode(value as ThemeMode)}
                    >
                      <SelectTrigger className="w-[140px]" aria-label="Theme mode">
                        <SelectValue placeholder="Theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col justify-between gap-4 border-b border-border/40 py-4 sm:flex-row sm:items-center sm:gap-8">
                    <div className="shrink-0 space-y-1">
                      <p className="text-sm font-medium">PDF Export</p>
                      <p className="text-xs text-muted-foreground">Configure PDF export behavior</p>
                    </div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings?.autoOpenPDF ?? true}
                        onChange={(e) => {
                          onChangeAutoOpenPDF?.(e.target.checked);
                        }}
                        className="h-4 w-4 rounded border-border bg-background text-primary shadow-sm focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                      <span className="text-sm font-medium">Automatically open exported PDF</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "shortcuts" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-medium">Keyboard Shortcuts</h2>
                <Button variant="outline" size="sm" type="button" onClick={handleReset}>
                  Reset to defaults
                </Button>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <SearchIcon size={16} className="text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  placeholder="Search shortcuts"
                  value={shortcutFilter}
                  onChange={(event) => setShortcutFilter(event.target.value)}
                  className="h-9 bg-muted/30 pl-10"
                />
              </div>

              <div className="divide-y divide-border/40 border-t border-b border-border/40 bg-transparent">
                {filteredShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="mx-0 flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/30"
                  >
                    <span className="text-sm font-medium">{shortcut.label}</span>
                    {editingShortcut === shortcut.id ? (
                      <Input
                        ref={inputRef}
                        type="text"
                        className="h-8 w-32 border-primary bg-background text-center font-mono text-xs shadow-sm"
                        value={formatKeysForPlatform(capturedKeys, navigator.platform)}
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
                      <Button
                        variant="outline"
                        size="sm"
                        className={`min-w-[96px] font-mono transition-colors ${
                          conflictIds.has(shortcut.id)
                            ? "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                            : ""
                        }`}
                        type="button"
                        onClick={() => {
                          setEditingShortcut(shortcut.id);
                          setCapturedKeys(shortcut.keys);
                          setShortcutError(null);
                          setConflictIds(new Set());
                        }}
                      >
                        {formatKeysForPlatform(shortcut.keys, navigator.platform)}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {filteredShortcuts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No shortcuts found matching "{shortcutFilter}"
                </div>
              ) : null}
              {shortcutError ? (
                <p className="mt-3 text-sm text-destructive">{shortcutError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
