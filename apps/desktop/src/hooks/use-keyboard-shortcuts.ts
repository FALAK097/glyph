import { useEffect } from "react";

import { matchShortcut } from "@/shared/shortcuts";
import type { FileDocument, ShortcutSetting, WorkspaceSnapshot } from "@/shared/workspace";

import { getErrorMessage } from "@/lib/errors";

type UseKeyboardShortcutsOptions = {
  glyph: NonNullable<Window["glyph"]>;
  shortcuts: ShortcutSetting[];
  activeFile: FileDocument | null;
  draftContent: string;
  markSaved: (file: FileDocument) => void;
  setError: (message: string | null) => void;
  setSaving: (isSaving: boolean) => void;
  createNote: () => Promise<void>;
  createFolder: () => Promise<void>;
  syncOpenedFile: (file: FileDocument, options?: { recordHistory?: boolean }) => Promise<void>;
  syncWorkspace: (workspace: WorkspaceSnapshot) => void;
  setIsWorkspaceMode: React.Dispatch<React.SetStateAction<boolean>>;
  navigateBack: () => Promise<void>;
  navigateForward: () => Promise<void>;
  triggerUpdateAction: () => Promise<void>;
  isPaletteOpen: boolean;
  isSettingsOpen: boolean;
  setIsPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleFocusMode: () => Promise<void>;
};

export function useKeyboardShortcuts({
  glyph,
  shortcuts,
  activeFile,
  draftContent,
  markSaved,
  setError,
  setSaving,
  createNote,
  createFolder,
  syncOpenedFile,
  syncWorkspace,
  setIsWorkspaceMode,
  navigateBack,
  navigateForward,
  triggerUpdateAction,
  isPaletteOpen,
  isSettingsOpen,
  setIsPaletteOpen,
  setIsSettingsOpen,
  setIsSidebarCollapsed,
  toggleFocusMode,
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

      const globalShortcutIds = new Set([
        "toggle-sidebar",
        "command-palette",
        "settings",
        "navigate-back",
        "navigate-forward",
        "focus-mode",
        "check-updates",
        "new-note",
        "new-folder",
      ]);
      const globalShortcut = shortcuts.find(
        (entry) => globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys),
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
        }
        return;
      }

      // Allow save shortcut even inside editable inputs (e.g. the editor)
      if (isEditableInput) {
        const saveShortcut = shortcuts.find(
          (entry) => entry.id === "save" && matchShortcut(event, entry.keys),
        );

        if (saveShortcut && activeFile) {
          event.preventDefault();
          setSaving(true);
          try {
            const savedFile = await glyph.saveFile(activeFile.path, draftContent);
            markSaved(savedFile);
          } catch (saveError) {
            console.error("Manual save failed:", saveError);
            setError(getErrorMessage(saveError));
          } finally {
            setSaving(false);
          }
          return;
        }
      }

      if (!isEditableInput) {
        const shortcut = shortcuts.find(
          (entry) => !globalShortcutIds.has(entry.id) && matchShortcut(event, entry.keys),
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
                setSaving(true);
                try {
                  const savedFile = await glyph.saveFile(activeFile.path, draftContent);
                  markSaved(savedFile);
                } catch (saveError) {
                  console.error("Manual save failed:", saveError);
                  setError(getErrorMessage(saveError));
                } finally {
                  setSaving(false);
                }
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
    activeFile,
    draftContent,
    markSaved,
    setError,
    setSaving,
    glyph,
    createNote,
    createFolder,
    syncOpenedFile,
    syncWorkspace,
    setIsWorkspaceMode,
    navigateBack,
    navigateForward,
    triggerUpdateAction,
    isPaletteOpen,
    isSettingsOpen,
    setIsPaletteOpen,
    setIsSettingsOpen,
    setIsSidebarCollapsed,
    toggleFocusMode,
  ]);
}
