import { useEffect } from "react";

import { matchShortcut, isPrimaryModifierPressed, MODIFIER_TOKENS } from "@/shared/shortcuts";
import type { FileDocument, ShortcutSetting, WorkspaceSnapshot } from "@/shared/workspace";

type UseKeyboardShortcutsOptions = {
  glyph: NonNullable<Window["glyph"]>;
  shortcuts: ShortcutSetting[];
  platform: string;
  activeFile: FileDocument | null;
  saveActiveNote: () => Promise<void>;
  createNote: () => Promise<void>;
  createFolder: () => Promise<void>;
  closeActiveTab: () => Promise<void>;
  closeOtherTabs: () => Promise<void>;
  activateTabByIndex: (index: number) => Promise<void>;
  activateNextTab: () => Promise<void>;
  activatePreviousTab: () => Promise<void>;
  syncOpenedFile: (file: FileDocument, options?: { recordHistory?: boolean }) => Promise<void>;
  syncWorkspace: (workspace: WorkspaceSnapshot) => void;
  setIsWorkspaceMode: React.Dispatch<React.SetStateAction<boolean>>;
  navigateBack: () => Promise<void>;
  navigateForward: () => Promise<void>;
  requestFindInNote: () => void;
  triggerUpdateAction: () => Promise<void>;
  splitRight: () => void;
  splitDown: () => void;
  closeActivePane: () => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;
  isPaletteOpen: boolean;
  isSettingsOpen: boolean;
  setIsPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleFocusMode: () => Promise<void>;
  setEditorScale: (scale: number) => Promise<void>;
  editorScale: number;
};

export function useKeyboardShortcuts({
  glyph,
  shortcuts,
  platform,
  activeFile,
  saveActiveNote,
  createNote,
  createFolder,
  closeActiveTab,
  closeOtherTabs,
  activateTabByIndex,
  activateNextTab,
  activatePreviousTab,
  syncOpenedFile,
  syncWorkspace,
  setIsWorkspaceMode,
  navigateBack,
  navigateForward,
  requestFindInNote,
  triggerUpdateAction,
  splitRight,
  splitDown,
  closeActivePane,
  focusNextPane,
  focusPreviousPane,
  isPaletteOpen,
  isSettingsOpen,
  setIsPaletteOpen,
  setIsSettingsOpen,
  setIsSidebarCollapsed,
  toggleFocusMode,
  setEditorScale,
  editorScale,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isEditableInput =
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable);

      // Escape always closes overlays, even from editable inputs
      if (event.key === "Escape") {
        if (isPaletteOpen || isSettingsOpen) {
          event.preventDefault();
          setIsPaletteOpen(false);
          setIsSettingsOpen(false);
          return;
        }

        if (!isEditableInput) {
          return;
        }
      }

      const hasConfiguredShortcutMatch = shortcuts.some((entry) =>
        matchShortcut(event, entry.keys, platform),
      );
      const primaryPressed = isPrimaryModifierPressed(event, platform);
      if (
        !hasConfiguredShortcutMatch &&
        primaryPressed &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        /^[1-9]$/.test(event.key)
      ) {
        event.preventDefault();
        void activateTabByIndex(Number(event.key) - 1);
        return;
      }

      const isPreviousBracketShortcut =
        primaryPressed &&
        !event.altKey &&
        matchShortcut(event, `${MODIFIER_TOKENS.shift} ${MODIFIER_TOKENS.cmdOrCtrl} [`, platform);
      const isNextBracketShortcut =
        primaryPressed &&
        !event.altKey &&
        matchShortcut(event, `${MODIFIER_TOKENS.shift} ${MODIFIER_TOKENS.cmdOrCtrl} ]`, platform);
      const isPreviousCtrlTabShortcut =
        !hasConfiguredShortcutMatch &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.shiftKey &&
        !event.repeat &&
        event.key === "Tab";
      const isNextCtrlTabShortcut =
        !hasConfiguredShortcutMatch &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        event.key === "Tab";

      if (!hasConfiguredShortcutMatch && (isPreviousBracketShortcut || isPreviousCtrlTabShortcut)) {
        event.preventDefault();
        void activatePreviousTab();
        return;
      }

      if (!hasConfiguredShortcutMatch && (isNextBracketShortcut || isNextCtrlTabShortcut)) {
        event.preventDefault();
        void activateNextTab();
        return;
      }

      const globalShortcutIds = new Set([
        "toggle-sidebar",
        "command-palette",
        "find-in-note",
        "settings",
        "navigate-back",
        "navigate-forward",
        "focus-mode",
        "check-updates",
        "new-note",
        "new-folder",
        "close-tab",
        "close-other-tabs",
        "zoom-in",
        "zoom-out",
        "zoom-reset",
        "split-right",
        "split-down",
        "close-pane",
        "focus-next-pane",
        "focus-previous-pane",
      ]);
      const globalShortcut = shortcuts.find(
        (entry) => globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys, platform),
      );
      if (globalShortcut) {
        event.preventDefault();
        switch (globalShortcut.id) {
          case "toggle-sidebar":
            setIsSidebarCollapsed((prev) => !prev);
            break;
          case "command-palette":
            setIsPaletteOpen((value) => !value);
            break;
          case "find-in-note":
            requestFindInNote();
            break;
          case "settings":
            setIsSettingsOpen((value) => !value);
            break;
          case "navigate-back":
            void navigateBack();
            break;
          case "navigate-forward":
            void navigateForward();
            break;
          case "focus-mode":
            void toggleFocusMode();
            break;
          case "check-updates":
            void triggerUpdateAction();
            break;
          case "new-note":
            void createNote();
            break;
          case "new-folder":
            void createFolder();
            break;
          case "close-tab":
            void closeActiveTab();
            break;
          case "close-other-tabs":
            void closeOtherTabs();
            break;
          case "zoom-in":
            void setEditorScale(Math.min(200, editorScale + 10));
            break;
          case "zoom-out":
            void setEditorScale(Math.max(50, editorScale - 10));
            break;
          case "zoom-reset":
            void setEditorScale(100);
            break;
          case "split-right":
            splitRight();
            break;
          case "split-down":
            splitDown();
            break;
          case "close-pane":
            closeActivePane();
            break;
          case "focus-next-pane":
            focusNextPane();
            break;
          case "focus-previous-pane":
            focusPreviousPane();
            break;
        }
        return;
      }

      // Allow save shortcut even inside editable inputs (e.g. the editor)
      if (isEditableInput) {
        const saveShortcut = shortcuts.find(
          (entry) => entry.id === "save" && matchShortcut(event, entry.keys, platform),
        );

        if (saveShortcut && activeFile) {
          event.preventDefault();
          await saveActiveNote();
          return;
        }
      }

      if (!isEditableInput) {
        const shortcut = shortcuts.find(
          (entry) => !globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys, platform),
        );

        if (shortcut) {
          event.preventDefault();

          switch (shortcut.id) {
            case "new-note":
              void createNote();
              break;
            case "new-folder":
              void createFolder();
              break;
            case "open-file": {
              const file = await glyph.openDocument();
              if (file) {
                await syncOpenedFile(file, { recordHistory: true });
              }
              break;
            }
            case "open-folder": {
              const workspace = await glyph.openFolder();
              if (workspace) {
                syncWorkspace(workspace);
                setIsWorkspaceMode(true);
              }
              break;
            }
            case "save":
              if (activeFile) {
                await saveActiveNote();
              }
              break;
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    shortcuts,
    platform,
    activeFile,
    saveActiveNote,
    glyph,
    createNote,
    createFolder,
    closeActiveTab,
    closeOtherTabs,
    activateTabByIndex,
    activateNextTab,
    activatePreviousTab,
    syncOpenedFile,
    syncWorkspace,
    setIsWorkspaceMode,
    navigateBack,
    navigateForward,
    requestFindInNote,
    triggerUpdateAction,
    splitRight,
    splitDown,
    closeActivePane,
    focusNextPane,
    focusPreviousPane,
    isPaletteOpen,
    isSettingsOpen,
    setIsPaletteOpen,
    setIsSettingsOpen,
    setIsSidebarCollapsed,
    toggleFocusMode,
    setEditorScale,
    editorScale,
  ]);
}
