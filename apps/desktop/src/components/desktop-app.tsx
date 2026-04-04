import { useCallback, useEffect, useMemo, useState } from "react";

import { countGroupedSkills, groupSkillsForBrowse } from "@/lib/skill-groups";
import { formatByteSize } from "@/lib/format-byte-size";
import { getShortcutDisplay } from "@/shared/shortcuts";
import type { SkillEntry, SkillSourceKind } from "@/shared/skills";
import type { ThemeMode } from "@/shared/workspace";
import type { DesktopAppProps } from "@/types/app";

import { useDesktopAppController } from "@/hooks/use-desktop-app-controller";
import { useSkillLibraryController } from "@/hooks/use-skill-library-controller";

import { CommandPalette } from "./command-palette";
import { MarkdownEditor } from "./markdown-editor";
import { SettingsPanel } from "./settings-panel";
import { Sidebar } from "./sidebar";
import { SkillDocumentPane } from "./skill-document-pane";
import { SkillsBrowserPane } from "./skills-browser-pane";
import { SkillEmptyPane } from "./skill-empty-pane";
import { TooltipProvider } from "./ui/tooltip";

type SkillCollection = {
  id: string;
  fallbackLabel: string;
  iconKind?: "all-agents" | "all-skills" | "global";
  label: string;
  sourceKind?: SkillSourceKind;
  count: number;
  matches: (skill: SkillEntry) => boolean;
};

export const DesktopApp = ({ glyph }: DesktopAppProps) => {
  const controller = useDesktopAppController(glyph);
  const skillsController = useSkillLibraryController(glyph, {
    enabled: true,
  });
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);
  const [selectedSkillCollectionId, setSelectedSkillCollectionId] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<"note" | "skill">("note");
  const shouldCollapseSidebar =
    controller.isSidebarCollapsed || (viewerMode === "note" && controller.isFocusMode);
  const allSkills = skillsController.snapshot?.skills ?? [];
  const globalSkills = useMemo(
    () => allSkills.filter((skill) => skill.sourceId === "agents-global"),
    [allSkills],
  );

  const skillCollections = useMemo<SkillCollection[]>(() => {
    const collections: SkillCollection[] = [
      {
        id: "all-skills",
        fallbackLabel: "All Skills",
        iconKind: "all-skills",
        label: "All Skills",
        count: countGroupedSkills(allSkills),
        matches: () => true,
      },
      {
        id: "all-agents",
        fallbackLabel: "All Agents",
        iconKind: "all-agents",
        label: "All Agents",
        count: countGroupedSkills(allSkills.filter((skill) => skill.hasAgentsFile)),
        matches: (skill) => skill.hasAgentsFile,
      },
    ];
    const globalSkillCount = countGroupedSkills(globalSkills);

    if (globalSkillCount > 0) {
      collections.push({
        id: "global-skills",
        fallbackLabel: "Global",
        iconKind: "global",
        label: "Global",
        count: globalSkillCount,
        matches: (skill) => skill.sourceId === "agents-global",
      });
    }

    skillsController.sources
      .filter((source) => !["agents-global", "project-skills"].includes(source.id))
      .forEach((source) => {
        const sourceSkills = allSkills.filter((skill) => skill.sourceId === source.id);
        const skillCount = countGroupedSkills(sourceSkills);
        if (skillCount === 0) {
          return;
        }

        collections.push({
          id: source.id,
          fallbackLabel: source.name,
          label: source.name,
          sourceKind: source.kind,
          count: skillCount,
          matches: (skill) => skill.sourceId === source.id,
        });
      });

    return collections;
  }, [allSkills, globalSkills, skillsController.sources]);

  const sidebarSkillCollections = useMemo(
    () =>
      skillCollections.map((collection) => ({
        id: collection.id,
        fallbackLabel: collection.fallbackLabel,
        iconKind: collection.iconKind,
        label: collection.label,
        sourceKind: collection.sourceKind,
        count: collection.count,
        isActive: selectedSkillCollectionId === collection.id,
      })),
    [selectedSkillCollectionId, skillCollections],
  );

  const activeSkillCollection = useMemo(
    () =>
      skillCollections.find((collection) => collection.id === selectedSkillCollectionId) ?? null,
    [selectedSkillCollectionId, skillCollections],
  );
  const noteFileSizeLabel = useMemo(() => {
    const bytes = new TextEncoder().encode(controller.draftContent).length;
    return formatByteSize(bytes);
  }, [controller.draftContent]);

  const visibleSkills = useMemo(() => {
    if (!activeSkillCollection) {
      return [];
    }

    return allSkills.filter((skill) => activeSkillCollection.matches(skill));
  }, [activeSkillCollection, allSkills]);
  const visibleSkillItems = useMemo(() => groupSkillsForBrowse(visibleSkills), [visibleSkills]);

  useEffect(() => {
    if (!selectedSkillCollectionId || viewerMode !== "skill") {
      return;
    }

    if (!activeSkillCollection) {
      setSelectedSkillCollectionId(null);
      setViewerMode("note");
      return;
    }

    if (visibleSkills.length === 0) {
      skillsController.clearActiveSelection();
      return;
    }

    const isActiveSkillVisible = skillsController.activeSkill
      ? visibleSkills.some((skill) => skill.id === skillsController.activeSkill?.id)
      : false;

    if (!isActiveSkillVisible) {
      void skillsController.openSkill(
        visibleSkillItems[0]?.representativeSkillId ?? visibleSkills[0].id,
      );
    }
  }, [
    activeSkillCollection,
    selectedSkillCollectionId,
    skillsController.activeSkill,
    skillsController.clearActiveSelection,
    skillsController.openSkill,
    visibleSkillItems,
    viewerMode,
    visibleSkills,
  ]);

  const handleToggleSkillsSection = useCallback(() => {
    const nextValue = !isSkillsExpanded;
    setIsSkillsExpanded(nextValue);

    if (!nextValue) {
      setSelectedSkillCollectionId(null);
      setViewerMode("note");
    }
  }, [isSkillsExpanded]);

  const handleToggleNotesSection = useCallback(() => {
    setIsNotesExpanded((value) => !value);
  }, []);

  const handleSelectSkillCollection = useCallback(
    (collectionId: string) => {
      setIsSkillsExpanded(true);
      const isSameCollection = selectedSkillCollectionId === collectionId;
      setSelectedSkillCollectionId(isSameCollection ? null : collectionId);
      setViewerMode(isSameCollection ? "note" : "skill");
      if (!isSameCollection) {
        skillsController.clearActiveSelection();
      }
    },
    [selectedSkillCollectionId, skillsController],
  );

  const handleSelectSkill = useCallback(
    async (skillId: string) => {
      await skillsController.openSkill(skillId);
      setViewerMode("skill");
    },
    [skillsController],
  );

  const handleOpenNoteFile = useCallback(
    async (filePath: string) => {
      setSelectedSkillCollectionId(null);
      setViewerMode("note");
      await controller.openFile(filePath);
    },
    [controller],
  );

  const handleOpenSkillLink = useCallback(
    async (targetPath: string) => {
      const openedSkill = await skillsController.openSkillByPath(targetPath);
      if (openedSkill) {
        setViewerMode("skill");
        return;
      }

      setViewerMode("note");
      await controller.openFile(targetPath);
    },
    [controller, skillsController],
  );

  const isSkillSurfaceVisible = viewerMode === "skill";
  const isActiveSkillVisible =
    !selectedSkillCollectionId ||
    (skillsController.activeSkill
      ? visibleSkills.some((skill) => skill.id === skillsController.activeSkill?.id)
      : false);
  const skillEmptyState = useMemo(() => {
    if (!selectedSkillCollectionId) {
      return {
        title: "No skill selected",
        description: "Choose a skill from the library to preview it inside Glyph.",
      };
    }

    if (visibleSkills.length === 0) {
      return {
        title: `No ${activeSkillCollection?.label ?? "skills"} yet`,
        description:
          activeSkillCollection?.id === "all-agents"
            ? "Glyph could not find any local agents in the connected tool folders yet."
            : "This source does not have any local skills available right now.",
      };
    }

    return {
      title: "Select a skill",
      description: "Pick a skill from the list to preview its markdown content here.",
    };
  }, [activeSkillCollection, selectedSkillCollectionId, visibleSkills.length]);

  return (
    <TooltipProvider>
      <div
        className={`grid h-screen min-h-0 overflow-hidden transition-[grid-template-columns] duration-200 ${
          shouldCollapseSidebar ? "grid-cols-[0_minmax(0,1fr)]" : "grid-cols-[280px_minmax(0,1fr)]"
        }`}
      >
        {shouldCollapseSidebar ? (
          <div aria-hidden="true" className="w-0 min-w-0 overflow-hidden" />
        ) : (
          <Sidebar
            tree={controller.visibleSidebarNodes}
            activePath={viewerMode === "note" ? (controller.activeFile?.path ?? null) : null}
            isCollapsed={controller.isSidebarCollapsed}
            isNotesExpanded={isNotesExpanded}
            isSkillsExpanded={isSkillsExpanded}
            openInFolderLabel={controller.folderRevealLabel}
            pinnedNotes={controller.pinnedNotes}
            skillCollections={sidebarSkillCollections}
            onToggleNotesSection={handleToggleNotesSection}
            onToggleSkillsSection={handleToggleSkillsSection}
            onSelectSkillCollection={handleSelectSkillCollection}
            onOpenFile={(filePath) => void handleOpenNoteFile(filePath)}
            onOpenCommandPalette={() => controller.setIsPaletteOpen(true)}
            onDeleteFile={controller.handleDeleteFile}
            onRemoveFileFromGlyph={(filePath) =>
              void controller.handleRemoveFileFromGlyph(filePath)
            }
            onTogglePinnedFile={(filePath) => void controller.togglePinnedFile(filePath)}
            onRemoveFolder={controller.handleRemoveFolder}
            onRenameFile={controller.handleRenameFile}
            onRevealInFinder={(targetPath) => void controller.revealInFinder(targetPath)}
            onToggleFolder={controller.handleToggleFolder}
            onReorderNodes={controller.handleReorderNodes}
          />
        )}

        <main className="relative h-full min-h-0 overflow-hidden bg-background">
          {controller.error && viewerMode === "note" ? (
            <div className="mx-10 mt-4 mb-2 rounded-lg bg-destructive px-4 py-3 text-sm text-destructive-foreground">
              {controller.error}
            </div>
          ) : null}

          <div
            className={`grid h-full min-h-0 ${
              selectedSkillCollectionId
                ? "grid-cols-[292px_minmax(0,1fr)]"
                : "grid-cols-[minmax(0,1fr)]"
            }`}
          >
            {selectedSkillCollectionId ? (
              <SkillsBrowserPane
                activeSkillId={
                  viewerMode === "skill" ? (skillsController.activeSkill?.id ?? null) : null
                }
                items={visibleSkillItems}
                onSelectSkill={(skillId) => void handleSelectSkill(skillId)}
                title={activeSkillCollection?.label ?? "Skills"}
              />
            ) : null}

            <div className="min-h-0 min-w-0">
              {isSkillSurfaceVisible ? (
                skillsController.activeDocument && isActiveSkillVisible ? (
                  <SkillDocumentPane
                    activeDocument={skillsController.activeDocument}
                    draftContent={skillsController.draftContent}
                    fileLabel={
                      skillsController.activeSkill?.name ?? skillsController.activeDocument.name
                    }
                    commandPaletteShortcut={
                      getShortcutDisplay(controller.shortcuts, "command-palette") ?? "⌘P"
                    }
                    isSidebarCollapsed={controller.isSidebarCollapsed}
                    saveStateLabel={skillsController.saveStateLabel}
                    onChange={skillsController.setDraftContent}
                    toggleSidebarShortcut={getShortcutDisplay(
                      controller.shortcuts,
                      "toggle-sidebar",
                    )}
                    folderRevealLabel={controller.folderRevealLabel}
                    onOpenCommandPalette={() => controller.setIsPaletteOpen(true)}
                    onOpenLinkedFile={(targetPath) => void handleOpenSkillLink(targetPath)}
                    onOpenSettings={() => controller.setIsSettingsOpen(true)}
                    onToggleSidebar={() =>
                      controller.setIsSidebarCollapsed(!controller.isSidebarCollapsed)
                    }
                  />
                ) : (
                  <SkillEmptyPane
                    commandPaletteShortcut={
                      getShortcutDisplay(controller.shortcuts, "command-palette") ?? "⌘P"
                    }
                    description={skillEmptyState.description}
                    isSidebarCollapsed={controller.isSidebarCollapsed}
                    onOpenCommandPalette={() => controller.setIsPaletteOpen(true)}
                    onOpenSettings={() => controller.setIsSettingsOpen(true)}
                    onToggleSidebar={() =>
                      controller.setIsSidebarCollapsed(!controller.isSidebarCollapsed)
                    }
                    title={skillEmptyState.title}
                    titleLabel={activeSkillCollection?.label ?? "Skills"}
                  />
                )
              ) : (
                <MarkdownEditor
                  content={controller.draftContent}
                  fileName={controller.activeFile?.name ?? null}
                  filePath={controller.activeFile?.path ?? null}
                  editorFocusRequest={controller.editorFocusRequest}
                  saveStateLabel={controller.saveStateLabel}
                  footerMetaLabel={noteFileSizeLabel}
                  wordCount={controller.wordCount}
                  readingTime={controller.readingTime}
                  onChange={controller.updateDraftContent}
                  onToggleSidebar={() =>
                    controller.setIsSidebarCollapsed(!controller.isSidebarCollapsed)
                  }
                  isSidebarCollapsed={controller.isSidebarCollapsed}
                  onCreateNote={() => void controller.createNote()}
                  toggleSidebarShortcut={getShortcutDisplay(controller.shortcuts, "toggle-sidebar")}
                  newNoteShortcut={getShortcutDisplay(controller.shortcuts, "new-note")}
                  onOpenSettings={() => controller.setIsSettingsOpen(true)}
                  onOpenCommandPalette={() => controller.setIsPaletteOpen(true)}
                  onOpenLinkedFile={(path) => void handleOpenNoteFile(path)}
                  commandPaletteShortcut={
                    getShortcutDisplay(controller.shortcuts, "command-palette") ?? "⌘P"
                  }
                  onNavigateBack={() => void controller.navigateBack()}
                  onNavigateForward={() => void controller.navigateForward()}
                  navigateBackShortcut={getShortcutDisplay(controller.shortcuts, "navigate-back")}
                  navigateForwardShortcut={getShortcutDisplay(
                    controller.shortcuts,
                    "navigate-forward",
                  )}
                  focusModeShortcut={getShortcutDisplay(controller.shortcuts, "focus-mode")}
                  onDeleteNote={
                    controller.activeFile
                      ? () => void controller.handleDeleteFile(controller.activeFile!.path)
                      : undefined
                  }
                  onOpenNewWindow={
                    controller.activeFile
                      ? () => void window.glyph?.openExternal(controller.activeFile!.path)
                      : undefined
                  }
                  canGoBack={controller.canGoBack()}
                  canGoForward={controller.canGoForward()}
                  autoOpenPDFSetting={controller.settings?.autoOpenPDF ?? true}
                  folderRevealLabel={controller.folderRevealLabel}
                  isActiveFilePinned={controller.isActiveFilePinned}
                  isFocusMode={controller.isFocusMode}
                  onOutlineJumpHandled={controller.clearOutlineJumpRequest}
                  onToggleFocusMode={() => void controller.toggleFocusMode()}
                  onTogglePinnedFile={
                    controller.activeFile
                      ? () => void controller.togglePinnedFile(controller.activeFile!.path)
                      : undefined
                  }
                  outlineItems={controller.outlineItems}
                  outlineJumpRequest={controller.outlineJumpRequest}
                  showOutline={controller.showOutline}
                  updateState={controller.updateState}
                  onUpdateAction={() => void controller.triggerUpdateAction()}
                />
              )}
            </div>
          </div>
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
