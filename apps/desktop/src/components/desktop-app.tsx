import { getShortcutDisplay } from "@/shared/shortcuts";

import type { ThemeMode } from "@/shared/workspace";
import type { DesktopAppProps } from "@/types/app";

import { useDesktopAppController } from "@/hooks/use-desktop-app-controller";

import { CommandPalette } from "./command-palette";
import { MarkdownEditor } from "./markdown-editor";
import { SettingsPanel } from "./settings-panel";
import { Sidebar } from "./sidebar";
import { TooltipProvider } from "./ui/tooltip";

export const DesktopApp = ({ glyph }: DesktopAppProps) => {
  const controller = useDesktopAppController(glyph);

  return (
    <TooltipProvider>
      <div
        className={`grid h-screen min-h-0 overflow-hidden transition-[grid-template-columns] duration-200 ${
          controller.isSidebarCollapsed
            ? "grid-cols-[0_minmax(0,1fr)]"
            : "grid-cols-[280px_minmax(0,1fr)]"
        }`}
      >
        {controller.isSidebarCollapsed ? (
          <div aria-hidden="true" className="w-0 min-w-0 overflow-hidden" />
        ) : (
          <Sidebar
            tree={controller.visibleSidebarNodes}
            activePath={controller.activeFile?.path ?? null}
            isCollapsed={controller.isSidebarCollapsed}
            onOpenFile={(filePath) => void controller.openFile(filePath)}
            onDeleteFile={controller.handleDeleteFile}
            onRemoveFolder={controller.handleRemoveFolder}
            onRenameFile={controller.handleRenameFile}
            onRevealInFinder={(targetPath) => void controller.revealInFinder(targetPath)}
            onToggleFolder={controller.handleToggleFolder}
            onReorderNodes={controller.handleReorderNodes}
          />
        )}
        <main className="relative h-full min-h-0 overflow-hidden bg-background">
          {controller.error ? (
            <div className="mx-10 mt-4 mb-2 px-4 py-3 rounded-lg bg-destructive text-destructive-foreground text-sm">
              {controller.error}
            </div>
          ) : null}
          <MarkdownEditor
            content={controller.draftContent}
            fileName={controller.activeFile?.name ?? null}
            filePath={controller.activeFile?.path ?? null}
            saveStateLabel={controller.saveStateLabel}
            wordCount={controller.wordCount}
            readingTime={controller.readingTime}
            onChange={controller.updateDraftContent}
            onToggleSidebar={() => controller.setIsSidebarCollapsed(!controller.isSidebarCollapsed)}
            isSidebarCollapsed={controller.isSidebarCollapsed}
            onCreateNote={() => void controller.createNote()}
            toggleSidebarShortcut={getShortcutDisplay(controller.shortcuts, "toggle-sidebar")}
            newNoteShortcut={getShortcutDisplay(controller.shortcuts, "new-note")}
            onOpenSettings={() => controller.setIsSettingsOpen(true)}
            onOpenCommandPalette={() => controller.setIsPaletteOpen(true)}
            onOpenLinkedFile={(path) => void controller.openFile(path)}
            commandPaletteShortcut={
              getShortcutDisplay(controller.shortcuts, "command-palette") ?? "⌘P"
            }
            onNavigateBack={() => void controller.navigateBack()}
            onNavigateForward={() => void controller.navigateForward()}
            navigateBackShortcut={getShortcutDisplay(controller.shortcuts, "navigate-back")}
            navigateForwardShortcut={getShortcutDisplay(controller.shortcuts, "navigate-forward")}
            canGoBack={controller.canGoBack()}
            canGoForward={controller.canGoForward()}
            autoOpenPDFSetting={controller.settings?.autoOpenPDF ?? true}
            updateState={controller.updateState}
            onUpdateAction={() => void controller.triggerUpdateAction()}
          />
        </main>
        <CommandPalette
          isOpen={controller.isPaletteOpen}
          query={controller.paletteQuery}
          items={controller.paletteItems}
          selectedIndex={controller.selectedIndex}
          onChangeQuery={controller.setPaletteQuery}
          onClose={() => {
            controller.setIsPaletteOpen(false);
          }}
          onHoverItem={controller.setSelectedIndex}
          onMove={(direction) => {
            if (controller.paletteItems.length === 0) {
              return;
            }

            controller.setSelectedIndex(
              (value) =>
                (value + direction + controller.paletteItems.length) %
                controller.paletteItems.length,
            );
          }}
          onSelect={() => controller.paletteItems[controller.selectedIndex]?.onSelect()}
        />
        <SettingsPanel
          isOpen={controller.isSettingsOpen}
          settings={controller.settings}
          appInfo={controller.appInfo}
          onClose={() => controller.setIsSettingsOpen(false)}
          onChooseFolder={() => void controller.chooseFolderAndUpdateWorkspace()}
          onChangeMode={(mode: ThemeMode) => void controller.changeThemeMode(mode)}
          onChangeShortcuts={(shortcuts) => void controller.changeShortcuts(shortcuts)}
          onChangeAutoOpenPDF={(enabled) => void controller.saveSettings({ autoOpenPDF: enabled })}
        />
      </div>
    </TooltipProvider>
  );
};
