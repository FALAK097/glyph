import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { getDisplayFileName, isSamePath } from "@/lib/paths";
import { countGroupedSkills, groupSkillsForBrowse } from "@/lib/skill-groups";
import { formatByteSize } from "@/lib/format-byte-size";
import { getShortcutDisplay } from "@/shared/shortcuts";
import { SKILL_AGENT_CATALOG } from "@/shared/skill-agent-catalog";
import type { SkillEntry, SkillSourceKind, SkillToolKind } from "@/shared/skills";
import { useSessionStore } from "@/store/session";
import type { ThemeMode } from "@/shared/workspace";
import type { DesktopAppProps } from "@/types/app";
import type { CommandPaletteItem } from "@/types/command-palette";

import { useDesktopAppController } from "@/hooks/use-desktop-app-controller";
import { useSkillLibraryController } from "@/hooks/use-skill-library-controller";

import { AppLayout } from "./app-layout";
import { CommandPalette } from "./command-palette";
import { DefaultAppPrompt } from "./default-app-prompt";
import { NoteConfirmDialog } from "./note-confirm-dialog";
import { NoteRenameDialog } from "./note-rename-dialog";
import { NoteView } from "./note-view";
import { SettingsPanel } from "./settings-panel";
import { SkillView } from "./skill-view";
import { SkillsBrowserPane } from "./skills-browser-pane";
import { TooltipProvider } from "./ui/tooltip";

type SkillCollection = {
  id: string;
  fallbackLabel: string;
  iconKind?: "all-agents" | "all-skills" | "global" | "project";
  label: string;
  sourceKind?: SkillSourceKind;
  toolKind?: SkillToolKind;
  count: number;
  group: "scope" | "tool";
  matches: (skill: SkillEntry) => boolean;
};

type PendingNoteRename = {
  name: string;
  path: string;
  value: string;
};

type PendingNoteConfirm = {
  kind: "delete" | "remove";
  name: string;
  path: string;
};

function matchesPaletteQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(query));
}

function matchesSkillPaletteFallback(query: string, skill: SkillEntry) {
  if (!query) {
    return true;
  }

  return [skill.name, skill.description, skill.slug, skill.sourceName, skill.tags.join(" ")].some(
    (value) => value?.toLowerCase().includes(query),
  );
}

export const DesktopApp = ({ glyph }: DesktopAppProps) => {
  const sessionHasHydrated = useSessionStore((state) => state.hasHydrated);
  const viewerMode = useSessionStore((state) => state.viewerMode);
  const isNotesExpanded = useSessionStore((state) => state.isNotesExpanded);
  const isSkillsExpanded = useSessionStore((state) => state.isSkillsExpanded);
  const selectedSkillCollectionId = useSessionStore((state) => state.selectedSkillCollectionId);
  const noteWorkspacePath = useSessionStore((state) => state.noteWorkspacePath);
  const noteFilePath = useSessionStore((state) => state.noteFilePath);
  const noteTabPaths = useSessionStore((state) => state.noteTabPaths);
  const skillDocumentPath = useSessionStore((state) => state.skillDocumentPath);
  const getPreferredSkillDocumentKind = useSessionStore(
    (state) => state.getPreferredSkillDocumentKind,
  );
  const setViewerMode = useSessionStore((state) => state.setViewerMode);
  const setNotesExpanded = useSessionStore((state) => state.setNotesExpanded);
  const setSkillsExpanded = useSessionStore((state) => state.setSkillsExpanded);
  const setSelectedSkillCollectionId = useSessionStore(
    (state) => state.setSelectedSkillCollectionId,
  );
  const setDocumentScroll = useSessionStore((state) => state.setDocumentScroll);

  const hasCapturedInitialSessionRef = useRef(false);
  const initialNoteSessionRef = useRef<{
    filePath: string | null;
    tabPaths: string[];
    workspacePath: string | null;
  }>({
    filePath: null,
    tabPaths: [],
    workspacePath: null,
  });
  const initialSkillSessionRef = useRef<{
    collectionId: string | null;
    documentPath: string | null;
    viewerMode: "note" | "skill";
  }>({
    collectionId: null,
    documentPath: null,
    viewerMode: "note",
  });

  if (sessionHasHydrated && !hasCapturedInitialSessionRef.current) {
    initialNoteSessionRef.current = {
      filePath: noteFilePath,
      tabPaths: noteTabPaths.length > 0 ? noteTabPaths : noteFilePath ? [noteFilePath] : [],
      workspacePath: noteWorkspacePath,
    };
    initialSkillSessionRef.current = {
      collectionId: selectedSkillCollectionId,
      documentPath: skillDocumentPath,
      viewerMode,
    };
    hasCapturedInitialSessionRef.current = true;
  }

  const controller = useDesktopAppController(glyph, {
    initialFilePath: initialNoteSessionRef.current.filePath,
    initialTabPaths: initialNoteSessionRef.current.tabPaths,
    initialWorkspacePath: initialNoteSessionRef.current.workspacePath,
    sessionReady: sessionHasHydrated,
  });
  const skillsController = useSkillLibraryController(glyph, {
    enabled: true,
  });
  const [pendingNoteRename, setPendingNoteRename] = useState<PendingNoteRename | null>(null);
  const [pendingNoteConfirm, setPendingNoteConfirm] = useState<PendingNoteConfirm | null>(null);
  const [paletteSkillResultIds, setPaletteSkillResultIds] = useState<string[] | null>(null);
  const [resolvedPaletteSkillQuery, setResolvedPaletteSkillQuery] = useState("");
  const [noteInitialScrollTop, setNoteInitialScrollTop] = useState(0);
  const [skillInitialScrollTop, setSkillInitialScrollTop] = useState(0);
  const [pendingSkillRestorePath, setPendingSkillRestorePath] = useState<string | null>(null);
  const [isInitialSkillRestorePending, setIsInitialSkillRestorePending] = useState(false);
  const [showDefaultAppPrompt, setShowDefaultAppPrompt] = useState(false);
  const paletteSkillSearchNonceRef = useRef(0);
  const paletteFilterQuery = controller.paletteQuery.trim().toLowerCase();
  const shouldCollapseSidebar =
    controller.isSidebarCollapsed || (viewerMode === "note" && controller.isFocusMode);
  const allSkills = skillsController.snapshot?.skills ?? [];
  const globalSkills = useMemo(
    () => allSkills.filter((skill) => skill.sourceId === "agents-global"),
    [allSkills],
  );
  const projectSkills = useMemo(
    () => allSkills.filter((skill) => skill.sourceId === "project-skills"),
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
        group: "scope",
        matches: () => true,
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
        group: "tool",
        matches: (skill) => skill.sourceId === "agents-global",
      });
    }

    const projectSkillCount = countGroupedSkills(projectSkills);

    if (projectSkillCount > 0) {
      collections.push({
        id: "project-skills",
        fallbackLabel: "Project",
        iconKind: "project",
        label: "Project",
        count: projectSkillCount,
        group: "tool",
        matches: (skill) => skill.sourceId === "project-skills",
      });
    }

    SKILL_AGENT_CATALOG.forEach((tool) => {
      const toolSkills = allSkills.filter((skill) => skill.sourceKind === tool.kind);
      const skillCount = countGroupedSkills(toolSkills);

      if (skillCount === 0) {
        return;
      }

      collections.push({
        id: `${tool.kind}-tool`,
        fallbackLabel: tool.label,
        label: tool.label,
        sourceKind: tool.kind,
        toolKind: tool.kind,
        count: skillCount,
        group: "tool",
        matches: (skill) => skill.sourceKind === tool.kind,
      });
    });

    return collections;
  }, [allSkills, globalSkills, projectSkills]);

  const sidebarSkillCollections = useMemo(
    () =>
      skillCollections.map((collection) => ({
        id: collection.id,
        fallbackLabel: collection.fallbackLabel,
        group: collection.group,
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
  const currentNoteDisplayName = useMemo(
    () => (controller.activeFile ? getDisplayFileName(controller.activeFile.name) : ""),
    [controller.activeFile],
  );
  const handleDocumentScrollPositionChange = useCallback(
    (targetPath: string | null, scrollTop: number) => {
      setDocumentScroll(targetPath, scrollTop);
    },
    [setDocumentScroll],
  );

  useLayoutEffect(() => {
    setNoteInitialScrollTop(
      controller.activeFile
        ? useSessionStore.getState().getDocumentScroll(controller.activeFile.path)
        : 0,
    );
  }, [controller.activeFile, viewerMode]);

  useLayoutEffect(() => {
    setSkillInitialScrollTop(
      skillsController.activeDocument
        ? useSessionStore.getState().getDocumentScroll(skillsController.activeDocument.path)
        : 0,
    );
  }, [skillsController.activeDocument, viewerMode]);

  const visibleSkills = useMemo(() => {
    if (!activeSkillCollection) {
      return [];
    }

    return skillsController.filteredSkills.filter((skill) => activeSkillCollection.matches(skill));
  }, [activeSkillCollection, skillsController.filteredSkills]);
  const visibleSkillItems = useMemo(() => {
    return groupSkillsForBrowse(visibleSkills);
  }, [visibleSkills]);

  const handleToggleSkillsSection = useCallback(() => {
    const nextValue = !isSkillsExpanded;
    setSkillsExpanded(nextValue);

    if (!nextValue) {
      setSelectedSkillCollectionId(null);
      setViewerMode("note");
    }
  }, [isSkillsExpanded, setSelectedSkillCollectionId, setSkillsExpanded, setViewerMode]);

  const handleToggleNotesSection = useCallback(() => {
    setNotesExpanded(!isNotesExpanded);
  }, [isNotesExpanded, setNotesExpanded]);

  const activateSkillCollection = useCallback(
    (collectionId: string) => {
      setSkillsExpanded(true);
      setSelectedSkillCollectionId(collectionId);
      setViewerMode("skill");
    },
    [setSelectedSkillCollectionId, setSkillsExpanded, setViewerMode],
  );

  const openSkillInCollection = useCallback(
    async (skillId: string) => {
      const matchingSkill = allSkills.find((skill) => skill.id === skillId);
      if (!matchingSkill) {
        return;
      }

      const preferredDocumentKind = getPreferredSkillDocumentKind(skillId);
      const targetPath =
        preferredDocumentKind === "agents" && matchingSkill.agentsFilePath
          ? matchingSkill.agentsFilePath
          : matchingSkill.skillFilePath;

      const opened = await skillsController.openSkillByPath(targetPath);
      if (!opened) {
        await skillsController.openSkill(skillId);
      }

      setViewerMode("skill");
    },
    [allSkills, getPreferredSkillDocumentKind, setViewerMode, skillsController],
  );

  const handleSelectSkillCollection = useCallback(
    (collectionId: string) => {
      setSkillsExpanded(true);
      const isSameCollection = selectedSkillCollectionId === collectionId;
      setSelectedSkillCollectionId(isSameCollection ? null : collectionId);
      setViewerMode(isSameCollection ? "note" : "skill");

      if (isSameCollection) {
        return;
      }
    },
    [selectedSkillCollectionId, setSelectedSkillCollectionId, setSkillsExpanded, setViewerMode],
  );

  const handleSelectSkill = useCallback(
    async (skillId: string) => {
      await openSkillInCollection(skillId);
    },
    [openSkillInCollection],
  );

  useEffect(() => {
    if (!sessionHasHydrated) {
      return;
    }

    setIsInitialSkillRestorePending(initialSkillSessionRef.current.viewerMode === "skill");
  }, [sessionHasHydrated]);

  useEffect(() => {
    if (
      !isInitialSkillRestorePending ||
      !sessionHasHydrated ||
      !controller.hasBooted ||
      !skillsController.hasLoadedOnce ||
      initialSkillSessionRef.current.viewerMode !== "skill"
    ) {
      return;
    }

    const persistedCollectionId = initialSkillSessionRef.current.collectionId ?? "all-skills";
    const hasMatchingCollection = skillCollections.some(
      (collection) => collection.id === persistedCollectionId,
    );
    const nextCollectionId = hasMatchingCollection ? persistedCollectionId : "all-skills";

    setSkillsExpanded(true);
    setSelectedSkillCollectionId(nextCollectionId);
    setViewerMode("skill");

    const persistedDocumentPath = initialSkillSessionRef.current.documentPath;
    if (!persistedDocumentPath) {
      initialSkillSessionRef.current.viewerMode = "note";
      setIsInitialSkillRestorePending(false);
      return;
    }

    setPendingSkillRestorePath(persistedDocumentPath);
    void skillsController.openSkillByPath(persistedDocumentPath).then((opened) => {
      if (opened) {
        return;
      }

      setPendingSkillRestorePath(null);
      setSelectedSkillCollectionId(nextCollectionId);
      initialSkillSessionRef.current.viewerMode = "note";
      setIsInitialSkillRestorePending(false);
    });
  }, [
    controller.hasBooted,
    isInitialSkillRestorePending,
    sessionHasHydrated,
    setSelectedSkillCollectionId,
    setSkillsExpanded,
    setViewerMode,
    skillCollections,
    skillsController.hasLoadedOnce,
    skillsController.openSkillByPath,
  ]);

  useEffect(() => {
    if (!pendingSkillRestorePath || skillsController.isDocumentLoading) {
      return;
    }

    if (
      skillsController.activeDocument &&
      isSamePath(skillsController.activeDocument.path, pendingSkillRestorePath)
    ) {
      setPendingSkillRestorePath(null);
      initialSkillSessionRef.current.viewerMode = "note";
      setIsInitialSkillRestorePending(false);
      return;
    }

    if (!skillsController.activeDocument) {
      setPendingSkillRestorePath(null);
      initialSkillSessionRef.current.viewerMode = "note";
      setIsInitialSkillRestorePending(false);
    }
  }, [
    isInitialSkillRestorePending,
    pendingSkillRestorePath,
    skillsController.activeDocument,
    skillsController.isDocumentLoading,
  ]);

  useEffect(() => {
    if (!sessionHasHydrated || !controller.hasBooted || !controller.settings) {
      return;
    }

    const hasDismissed = controller.settings.dismissedDefaultAppPrompt === true;
    if (hasDismissed) {
      return;
    }

    if (!controller.defaultAppStatus) {
      controller.checkDefaultAppStatus();
      return;
    }

    const platform = controller.defaultAppStatus.platform;
    const isSupportedPlatform = platform === "darwin" || platform === "win32";
    if (!isSupportedPlatform) {
      return;
    }

    if (controller.defaultAppStatus.isDefault) {
      return;
    }

    setShowDefaultAppPrompt(true);
  }, [
    sessionHasHydrated,
    controller.hasBooted,
    controller.settings,
    controller.defaultAppStatus,
    controller.checkDefaultAppStatus,
  ]);

  useEffect(() => {
    if (controller.hasBooted && !controller.defaultAppStatus) {
      controller.checkDefaultAppStatus();
    }
  }, [controller.hasBooted, controller.defaultAppStatus, controller.checkDefaultAppStatus]);

  useEffect(() => {
    if (
      !selectedSkillCollectionId ||
      viewerMode !== "skill" ||
      pendingSkillRestorePath ||
      isInitialSkillRestorePending
    ) {
      return;
    }

    if (!activeSkillCollection) {
      setSelectedSkillCollectionId(null);
      setViewerMode("note");
      return;
    }

    if (visibleSkills.length === 0 || visibleSkillItems.length === 0) {
      skillsController.clearActiveSelection();
      return;
    }

    const isActiveSkillVisible = skillsController.activeSkill
      ? visibleSkillItems.some((item) =>
          item.memberSkillIds.includes(skillsController.activeSkill?.id ?? ""),
        )
      : false;

    if (!isActiveSkillVisible) {
      void openSkillInCollection(
        visibleSkillItems[0]?.representativeSkillId ?? visibleSkills[0].id,
      );
    }
  }, [
    activeSkillCollection,
    openSkillInCollection,
    selectedSkillCollectionId,
    setSelectedSkillCollectionId,
    setViewerMode,
    skillsController.activeSkill,
    skillsController.clearActiveSelection,
    viewerMode,
    isInitialSkillRestorePending,
    pendingSkillRestorePath,
    visibleSkillItems,
    visibleSkills,
  ]);

  const handleOpenNoteFile = useCallback(
    async (filePath: string) => {
      setSelectedSkillCollectionId(null);
      setViewerMode("note");
      await controller.openFile(filePath);
    },
    [controller, setSelectedSkillCollectionId, setViewerMode],
  );

  const handleOpenSkillLink = useCallback(
    async (targetPath: string) => {
      const matchingSkill = allSkills.find(
        (skill) =>
          isSamePath(skill.skillFilePath, targetPath) ||
          isSamePath(skill.agentsFilePath, targetPath),
      );
      const openedSkill = await skillsController.openSkillByPath(targetPath);
      if (openedSkill) {
        if (matchingSkill) {
          const nextCollectionId =
            matchingSkill.sourceId === "agents-global"
              ? "global-skills"
              : matchingSkill.sourceId === "project-skills"
                ? "project-skills"
                : `${matchingSkill.sourceKind}-tool`;
          activateSkillCollection(nextCollectionId);
        } else {
          activateSkillCollection("all-skills");
        }

        setViewerMode("skill");
        return;
      }

      setViewerMode("note");
      await controller.openFile(targetPath);
    },
    [activateSkillCollection, allSkills, controller, skillsController],
  );
  const closePalette = useCallback(() => {
    controller.setIsPaletteOpen(false);
  }, [controller.setIsPaletteOpen]);

  const copyText = useCallback(async (value: string) => {
    await navigator.clipboard.writeText(value);
  }, []);

  const exportDocumentToPdf = useCallback(
    async (markdown: string, fileName: string) => {
      const pdfName = fileName.replace(/\.(md|mdx|markdown)$/i, ".pdf");
      const absolutePath = await glyph.exportMarkdownToPDF(markdown, pdfName);

      if ((controller.settings?.autoOpenPDF ?? true) && absolutePath) {
        await glyph.openExternal(absolutePath);
      }
    },
    [controller.settings?.autoOpenPDF, glyph],
  );

  const handleRenameCurrentNote = useCallback(() => {
    if (!controller.activeFile) {
      return;
    }

    setPendingNoteRename({
      path: controller.activeFile.path,
      name: controller.activeFile.name,
      value: getDisplayFileName(controller.activeFile.name),
    });
    closePalette();
  }, [closePalette, controller.activeFile]);

  const handleConfirmNoteRename = useCallback(async () => {
    if (!pendingNoteRename) {
      return;
    }

    const nextName = pendingNoteRename.value.trim();
    if (!nextName) {
      return;
    }

    await controller.handleRenameFile(pendingNoteRename.path, nextName);
    setPendingNoteRename(null);
  }, [controller, pendingNoteRename]);

  const handleOpenCurrentNoteConfirm = useCallback(
    (kind: PendingNoteConfirm["kind"]) => {
      if (!controller.activeFile) {
        return;
      }

      setPendingNoteConfirm({
        kind,
        path: controller.activeFile.path,
        name: controller.activeFile.name,
      });
      closePalette();
    },
    [closePalette, controller.activeFile],
  );

  const handleConfirmCurrentNoteAction = useCallback(async () => {
    if (!pendingNoteConfirm) {
      return;
    }

    if (pendingNoteConfirm.kind === "remove") {
      await controller.handleRemoveFileFromGlyph(pendingNoteConfirm.path);
    } else {
      await controller.handleDeleteFile(pendingNoteConfirm.path);
    }

    setPendingNoteConfirm(null);
  }, [controller, pendingNoteConfirm]);

  const handleCopyCurrentNoteMarkdown = useCallback(async () => {
    await copyText(controller.draftContent);
    closePalette();
  }, [closePalette, controller.draftContent, copyText]);

  const handleCopyCurrentNotePath = useCallback(async () => {
    if (!controller.activeFile) {
      return;
    }

    await copyText(controller.activeFile.path);
    closePalette();
  }, [closePalette, controller.activeFile, copyText]);

  const handleRevealCurrentNote = useCallback(async () => {
    if (!controller.activeFile) {
      return;
    }

    await controller.revealInFinder(controller.activeFile.path);
    closePalette();
  }, [closePalette, controller]);

  const handleExportCurrentNote = useCallback(async () => {
    if (!controller.activeFile) {
      return;
    }

    await exportDocumentToPdf(controller.draftContent, controller.activeFile.name);
    closePalette();
  }, [closePalette, controller.activeFile, controller.draftContent, exportDocumentToPdf]);

  const handleCopyCurrentSkillMarkdown = useCallback(async () => {
    await copyText(skillsController.draftContent);
    closePalette();
  }, [closePalette, copyText, skillsController.draftContent]);

  const handleExportCurrentSkill = useCallback(async () => {
    if (!skillsController.activeDocument) {
      return;
    }

    await exportDocumentToPdf(skillsController.draftContent, skillsController.activeDocument.name);
    closePalette();
  }, [
    closePalette,
    exportDocumentToPdf,
    skillsController.activeDocument,
    skillsController.draftContent,
  ]);

  const isSkillSurfaceVisible = viewerMode === "skill";
  const isAppBootstrapping = !sessionHasHydrated || !controller.hasBooted;
  const isSkillSurfaceLoading =
    isSkillSurfaceVisible &&
    (isAppBootstrapping ||
      isInitialSkillRestorePending ||
      !skillsController.hasLoadedOnce ||
      skillsController.isLoading ||
      Boolean(pendingSkillRestorePath) ||
      (skillsController.isDocumentLoading && !skillsController.activeDocument));
  const isActiveSkillVisible =
    !selectedSkillCollectionId ||
    (skillsController.activeSkill
      ? visibleSkillItems.some((item) =>
          item.memberSkillIds.includes(skillsController.activeSkill?.id ?? ""),
        )
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
        description: "This source does not have any local skills available right now.",
      };
    }

    if (visibleSkillItems.length === 0) {
      return {
        title: "No matches",
        description: "Try a broader skills search or switch to another collection.",
      };
    }

    return {
      title: "Select a skill",
      description: "Pick a skill from the list to preview its markdown content here.",
    };
  }, [
    activeSkillCollection,
    selectedSkillCollectionId,
    visibleSkillItems.length,
    visibleSkills.length,
  ]);
  const openSkillFromSearchResult = useCallback(
    async (skillId: string) => {
      const matchingSkill = skillsController.snapshot?.skills.find((skill) => skill.id === skillId);
      if (!matchingSkill) {
        return;
      }

      const preferredCollection = "all-skills";

      activateSkillCollection(preferredCollection);
      await openSkillInCollection(matchingSkill.id);
    },
    [activateSkillCollection, openSkillInCollection, skillsController.snapshot?.skills],
  );

  useEffect(() => {
    if (!controller.isPaletteOpen) {
      setPaletteSkillResultIds(null);
      setResolvedPaletteSkillQuery("");
      return;
    }

    const query = controller.paletteQuery.trim();
    if (!query) {
      setPaletteSkillResultIds(null);
      setResolvedPaletteSkillQuery("");
      return;
    }

    paletteSkillSearchNonceRef.current += 1;
    const requestNonce = paletteSkillSearchNonceRef.current;

    void skillsController
      .searchSkillIds(query)
      .then((nextResultIds) => {
        if (requestNonce !== paletteSkillSearchNonceRef.current) {
          return;
        }

        setPaletteSkillResultIds(nextResultIds);
        setResolvedPaletteSkillQuery(query.toLowerCase());
      })
      .catch(() => {
        if (requestNonce !== paletteSkillSearchNonceRef.current) {
          return;
        }

        setPaletteSkillResultIds([]);
        setResolvedPaletteSkillQuery(query.toLowerCase());
      });
  }, [controller.isPaletteOpen, controller.paletteQuery, skillsController.searchSkillIds]);

  const visibleNotePaletteItems = useMemo(() => {
    const noteOnlyCommandIds = new Set([
      "new-note",
      "close-tab",
      "close-other-tabs",
      "previous-tab",
      "next-tab",
      "pin-note",
      "toggle-focus-mode",
    ]);

    const filteredItems = controller.paletteItems.filter((item) => {
      if (viewerMode === "skill") {
        if (item.section === "Pinned Notes") {
          return false;
        }

        if (item.kind === "command" && noteOnlyCommandIds.has(item.id)) {
          return false;
        }
      }

      return true;
    });

    if (viewerMode !== "skill") {
      return filteredItems;
    }

    return filteredItems.map((item) => {
      if (item.kind !== "file") {
        return item;
      }

      return {
        ...item,
        onSelect: () => {
          setSelectedSkillCollectionId(null);
          setViewerMode("note");
          item.onSelect();
        },
      };
    });
  }, [controller.paletteItems, viewerMode]);

  const currentNotePaletteItems = useMemo<CommandPaletteItem[]>(() => {
    if (viewerMode !== "note" || !controller.activeFile) {
      return [];
    }

    const query = paletteFilterQuery;
    const items: CommandPaletteItem[] = [
      {
        id: "find-in-current-note",
        title: "Find in Current Note",
        subtitle: "Search the active note without leaving the editor",
        section: "Note",
        kind: "command",
        onSelect: () => {
          controller.requestFindInNote();
          closePalette();
        },
      },
      {
        id: "rename-current-note",
        title: "Rename Current Note",
        subtitle: "Change the file name from the command palette",
        section: "Note",
        kind: "command",
        onSelect: handleRenameCurrentNote,
      },
      {
        id: "remove-current-note",
        title: "Remove Current Note From Glyph",
        subtitle: "Hide it from Glyph without deleting the file",
        section: "Note",
        kind: "command",
        onSelect: () => handleOpenCurrentNoteConfirm("remove"),
      },
      {
        id: "delete-current-note",
        title: "Delete Current Note",
        subtitle: "Delete the file from disk",
        section: "Note",
        kind: "command",
        onSelect: () => handleOpenCurrentNoteConfirm("delete"),
      },
      {
        id: "copy-current-note-markdown",
        title: "Copy Current Note as Markdown",
        subtitle: "Copy the note contents to the clipboard",
        section: "Note",
        kind: "command",
        onSelect: () => {
          void handleCopyCurrentNoteMarkdown();
        },
      },
      {
        id: "copy-current-note-path",
        title: "Copy Current Note Path",
        subtitle: controller.activeFile.path,
        section: "Note",
        kind: "command",
        onSelect: () => {
          void handleCopyCurrentNotePath();
        },
      },
      {
        id: "reveal-current-note",
        title: controller.folderRevealLabel,
        subtitle: "Show the current note in the file manager",
        section: "Note",
        kind: "command",
        onSelect: () => {
          void handleRevealCurrentNote();
        },
      },
      {
        id: "export-current-note",
        title: "Export Current Note as PDF",
        subtitle: "Create a PDF from the current note",
        section: "Note",
        kind: "command",
        onSelect: () => {
          void handleExportCurrentNote();
        },
      },
      {
        id: "zoom-in",
        title: "Zoom In",
        subtitle: "Increase editor zoom level",
        section: "Note",
        kind: "command",
        shortcut:
          getShortcutDisplay(controller.shortcuts, "zoom-in", navigator.platform) ?? undefined,
        onSelect: () => {
          void controller.setEditorScale(Math.min(200, controller.editorScale + 10));
          closePalette();
        },
      },
      {
        id: "zoom-out",
        title: "Zoom Out",
        subtitle: "Decrease editor zoom level",
        section: "Note",
        kind: "command",
        shortcut:
          getShortcutDisplay(controller.shortcuts, "zoom-out", navigator.platform) ?? undefined,
        onSelect: () => {
          void controller.setEditorScale(Math.max(50, controller.editorScale - 10));
          closePalette();
        },
      },
      {
        id: "zoom-reset",
        title: "Reset Zoom",
        subtitle: "Reset editor zoom to 100%",
        section: "Note",
        kind: "command",
        shortcut:
          getShortcutDisplay(controller.shortcuts, "zoom-reset", navigator.platform) ?? undefined,
        onSelect: () => {
          void controller.setEditorScale(100);
          closePalette();
        },
      },
    ];

    return items.filter((item) => matchesPaletteQuery(query, item.title, item.subtitle));
  }, [
    controller.activeFile,
    controller.folderRevealLabel,
    controller.requestFindInNote,
    handleCopyCurrentNoteMarkdown,
    handleCopyCurrentNotePath,
    handleExportCurrentNote,
    handleOpenCurrentNoteConfirm,
    handleRenameCurrentNote,
    handleRevealCurrentNote,
    paletteFilterQuery,
    viewerMode,
    controller.editorScale,
    controller.shortcuts,
    closePalette,
  ]);

  const skillPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const query = paletteFilterQuery;
    const paletteSkillResultIdSet = paletteSkillResultIds ? new Set(paletteSkillResultIds) : null;
    const fullTextSkillItems =
      query && resolvedPaletteSkillQuery === query && paletteSkillResultIdSet
        ? groupSkillsForBrowse(
            (skillsController.snapshot?.skills ?? []).filter((skill) =>
              paletteSkillResultIdSet.has(skill.id),
            ),
          ).slice(0, 12)
        : [];
    const fallbackSkillItems = query
      ? groupSkillsForBrowse(
          (skillsController.snapshot?.skills ?? []).filter((skill) =>
            matchesSkillPaletteFallback(query, skill),
          ),
        ).slice(0, 12)
      : [];
    const skillItems = fullTextSkillItems.length > 0 ? fullTextSkillItems : fallbackSkillItems;

    const searchItems: CommandPaletteItem[] = skillItems.map((item) => ({
      id: `skill-${item.id}`,
      title: item.name,
      subtitle:
        item.sourceNames.length > 1
          ? `${item.sourceNames.join(", ")}${item.description ? ` · ${item.description}` : ""}`
          : (item.description ?? item.sourceNames[0] ?? "Skill"),
      hint: item.hasAgentsFile ? "Agent" : "Skill",
      section: "Skills",
      kind: "command",
      onSelect: () => {
        void openSkillFromSearchResult(item.representativeSkillId);
        closePalette();
      },
    }));

    const currentSkill = skillsController.activeSkill;
    const currentDocument = skillsController.activeDocument;
    const collectionItems: CommandPaletteItem[] = skillCollections
      .map((collection) => ({
        id: `skill-collection-${collection.id}`,
        title: `Browse ${collection.label}`,
        subtitle: `${collection.count} skills`,
        section: "Skills Library",
        kind: "command" as const,
        onSelect: () => {
          activateSkillCollection(collection.id);
          closePalette();
        },
      }))
      .filter((item) => matchesPaletteQuery(query, item.title, item.subtitle));

    const actionItems: CommandPaletteItem[] =
      viewerMode === "skill" && currentSkill && currentDocument
        ? [
            {
              id: "open-skills-library",
              title: "Open Skills Library",
              subtitle: "Jump to the skills browser",
              section: "Current Skill",
              kind: "command" as const,
              onSelect: () => {
                activateSkillCollection("all-skills");
                closePalette();
              },
            },
            ...(skillsController.documentTabs.length > 1
              ? skillsController.documentTabs.map((tab) => ({
                  id: `skill-tab-${tab.kind}`,
                  title: tab.kind === currentDocument.kind ? `${tab.label} (current)` : tab.label,
                  subtitle:
                    tab.kind === currentDocument.kind ? "Already open" : `Switch to ${tab.label}`,
                  section: "Current Skill",
                  kind: "command" as const,
                  onSelect: () => {
                    void skillsController.openDocumentTab(tab.kind);
                    closePalette();
                  },
                }))
              : []),
            {
              id: "skill-copy-markdown",
              title: `Copy Current ${currentDocument.kind === "agents" ? "Agent" : "Skill"} as Markdown`,
              subtitle: "Copy the current document contents to the clipboard",
              section: "Current Skill",
              kind: "command" as const,
              onSelect: () => {
                void handleCopyCurrentSkillMarkdown();
              },
            },
            {
              id: "skill-copy-path",
              title: `Copy Current ${currentDocument.kind === "agents" ? "Agent" : "Skill"} Path`,
              subtitle: "Copy the current skill file path",
              section: "Current Skill",
              kind: "command" as const,
              onSelect: () => {
                void skillsController.copyPath(currentDocument.path);
                closePalette();
              },
            },
            {
              id: "skill-reveal",
              title: controller.folderRevealLabel,
              subtitle: "Show the current skill file in the file manager",
              section: "Current Skill",
              kind: "command" as const,
              onSelect: () => {
                void skillsController.revealInFinder(currentDocument.path);
                closePalette();
              },
            },
            {
              id: "skill-export-pdf",
              title: `Export Current ${currentDocument.kind === "agents" ? "Agent" : "Skill"} as PDF`,
              subtitle: "Create a PDF from the current document",
              section: "Current Skill",
              kind: "command" as const,
              onSelect: () => {
                void handleExportCurrentSkill();
              },
            },
            {
              id: "skill-refresh",
              title: "Refresh Skills Library",
              subtitle: "Rescan installed skills",
              section: "Current Skill",
              kind: "command" as const,
              onSelect: () => {
                void skillsController.refreshLibrary();
                closePalette();
              },
            },
          ].filter((item) => matchesPaletteQuery(query, item.title, item.subtitle))
        : [];

    return [...collectionItems, ...searchItems, ...actionItems];
  }, [
    activateSkillCollection,
    closePalette,
    controller.folderRevealLabel,
    handleCopyCurrentSkillMarkdown,
    handleExportCurrentSkill,
    openSkillFromSearchResult,
    paletteFilterQuery,
    paletteSkillResultIds,
    resolvedPaletteSkillQuery,
    skillCollections,
    skillsController.activeDocument,
    skillsController.activeSkill,
    skillsController.copyPath,
    skillsController.documentTabs,
    skillsController.openDocumentTab,
    skillsController.refreshLibrary,
    skillsController.revealInFinder,
    skillsController.searchSkillIds,
    skillsController.snapshot?.skills,
    viewerMode,
  ]);

  const paletteItems = useMemo(() => {
    if (viewerMode === "skill") {
      return [...skillPaletteItems, ...visibleNotePaletteItems];
    }

    const noteItems = visibleNotePaletteItems.filter((item) => item.section === "Note");
    const themeItems = visibleNotePaletteItems.filter((item) => item.section === "Theme");
    const otherItems = visibleNotePaletteItems.filter(
      (item) => item.section !== "Note" && item.section !== "Theme",
    );

    return [
      ...otherItems,
      ...noteItems,
      ...currentNotePaletteItems,
      ...themeItems,
      ...skillPaletteItems,
    ];
  }, [currentNotePaletteItems, skillPaletteItems, viewerMode, visibleNotePaletteItems]);

  const handleNoteRenameValueChange = useCallback(
    (value: string) => {
      setPendingNoteRename((current) =>
        current
          ? {
              ...current,
              value,
            }
          : current,
      );
    },
    [setPendingNoteRename],
  );

  const handleToggleSidebar = useCallback(() => {
    controller.setIsSidebarCollapsed(!controller.isSidebarCollapsed);
  }, [controller.isSidebarCollapsed, controller.setIsSidebarCollapsed]);

  const handleOpenCommandPalette = useCallback(() => {
    controller.setIsPaletteOpen(true);
  }, [controller.setIsPaletteOpen]);

  const handleOpenSettings = useCallback(() => {
    controller.setIsSettingsOpen(true);
  }, [controller.setIsSettingsOpen]);

  return (
    <TooltipProvider>
      <AppLayout
        shouldCollapseSidebar={shouldCollapseSidebar}
        tree={controller.visibleSidebarNodes}
        activePath={viewerMode === "note" ? (controller.activeFile?.path ?? null) : null}
        isSidebarCollapsed={controller.isSidebarCollapsed}
        isNotesExpanded={isNotesExpanded}
        isSkillsExpanded={isSkillsExpanded}
        openInFolderLabel={controller.folderRevealLabel}
        pinnedNotes={controller.pinnedNotes}
        skillCollections={sidebarSkillCollections}
        onToggleNotesSection={handleToggleNotesSection}
        onToggleSkillsSection={handleToggleSkillsSection}
        onSelectSkillCollection={handleSelectSkillCollection}
        onOpenFile={(filePath) => void handleOpenNoteFile(filePath)}
        onOpenCommandPalette={handleOpenCommandPalette}
        onDeleteFile={controller.handleDeleteFile}
        onDeleteFolder={(folderPath) => void controller.handleDeleteFolder(folderPath)}
        onRemoveFileFromGlyph={(filePath) => void controller.handleRemoveFileFromGlyph(filePath)}
        onTogglePinnedFile={(filePath) => void controller.togglePinnedFile(filePath)}
        onRemoveFolder={controller.handleRemoveFolder}
        onRenameFile={controller.handleRenameFile}
        onRenameFolder={(folderPath, newName) =>
          void controller.handleRenameFolder(folderPath, newName)
        }
        onRevealInFinder={(targetPath) => void controller.revealInFinder(targetPath)}
        onToggleFolder={controller.handleToggleFolder}
        onReorderNodes={controller.handleReorderNodes}
        onCreateNote={() => void controller.createNote()}
        onCreateFolder={() => void controller.createFolder()}
      >
        {(viewerMode === "note" ? controller.error : skillsController.error) ? (
          <div className="mx-10 mt-4 mb-2 rounded-lg bg-destructive px-4 py-3 text-sm text-destructive-foreground">
            {viewerMode === "note" ? controller.error : skillsController.error}
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
              isLoading={
                !skillsController.hasLoadedOnce ||
                skillsController.isLoading ||
                Boolean(pendingSkillRestorePath)
              }
              items={visibleSkillItems}
              searchQuery={skillsController.searchQuery}
              onSelectSkill={(skillId) => void handleSelectSkill(skillId)}
              onSearchQueryChange={skillsController.setSearchQuery}
              title={activeSkillCollection?.label ?? "Skills"}
            />
          ) : null}

          <div className="min-h-0 min-w-0">
            {isAppBootstrapping ? (
              <div className="flex h-full min-h-0 flex-col bg-background">
                <div
                  className={`flex items-center gap-2 border-b border-border/40 py-2 ${
                    controller.isSidebarCollapsed && navigator.platform.includes("Mac")
                      ? "pl-20 pr-4"
                      : "px-4"
                  }`}
                >
                  <div className="h-8 w-8 rounded-md bg-muted/70 motion-safe:animate-pulse" />
                  <div className="mx-auto h-8 w-full max-w-sm rounded-full bg-muted/60 motion-safe:animate-pulse" />
                  <div className="h-8 w-8 rounded-md bg-muted/70 motion-safe:animate-pulse" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-8">
                  <div className="h-6 w-40 rounded-md bg-muted/60 motion-safe:animate-pulse" />
                  <div className="h-4 w-72 rounded-md bg-muted/40 motion-safe:animate-pulse" />
                  <div className="mt-6 h-40 rounded-2xl bg-muted/35 motion-safe:animate-pulse" />
                  <div className="h-4 w-4/5 rounded-md bg-muted/30 motion-safe:animate-pulse" />
                  <div className="h-4 w-3/5 rounded-md bg-muted/30 motion-safe:animate-pulse" />
                </div>
              </div>
            ) : isSkillSurfaceVisible ? (
              <SkillView
                isSkillSurfaceLoading={isSkillSurfaceLoading}
                isActiveSkillVisible={isActiveSkillVisible}
                activeSkillCollection={activeSkillCollection}
                activeDocument={skillsController.activeDocument}
                activeSkill={skillsController.activeSkill}
                draftContent={skillsController.draftContent}
                documentTabs={skillsController.documentTabs}
                isDocumentLoading={skillsController.isDocumentLoading}
                isSaving={skillsController.isSaving}
                pendingExternalChange={skillsController.pendingExternalChange}
                saveStateLabel={skillsController.saveStateLabel}
                skillInitialScrollTop={skillInitialScrollTop}
                skillEmptyState={skillEmptyState}
                isSidebarCollapsed={controller.isSidebarCollapsed}
                shortcuts={controller.shortcuts}
                folderRevealLabel={controller.folderRevealLabel}
                showOutline={controller.showOutline}
                onSetIsPaletteOpen={controller.setIsPaletteOpen}
                onSetIsSettingsOpen={controller.setIsSettingsOpen}
                onToggleSidebar={handleToggleSidebar}
                onOpenLinkedFile={handleOpenSkillLink}
                onScrollPositionChange={handleDocumentScrollPositionChange}
                onDraftContentChange={skillsController.setDraftContent}
                onKeepMineAfterExternalChange={skillsController.keepMineAfterExternalChange}
                onReloadAfterExternalChange={skillsController.reloadAfterExternalChange}
                onSelectDocumentTab={(kind) => void skillsController.openDocumentTab(kind)}
              />
            ) : (
              <NoteView
                content={controller.draftContent}
                fileName={controller.activeFile?.name ?? null}
                filePath={controller.activeFile?.path ?? null}
                editorFocusRequest={controller.editorFocusRequest}
                findRequest={controller.findRequest}
                initialScrollTop={noteInitialScrollTop}
                saveStateLabel={controller.saveStateLabel}
                footerMetaLabel={noteFileSizeLabel}
                wordCount={controller.wordCount}
                readingTime={controller.readingTime}
                isSidebarCollapsed={controller.isSidebarCollapsed}
                activeTabId={controller.activeTabId}
                noteTabs={controller.noteTabs}
                shortcuts={controller.shortcuts}
                canGoBack={controller.canGoBack}
                canGoForward={controller.canGoForward}
                autoOpenPDFSetting={controller.settings?.autoOpenPDF ?? true}
                folderRevealLabel={controller.folderRevealLabel}
                isActiveFilePinned={controller.isActiveFilePinned}
                isFocusMode={controller.isFocusMode}
                showOutline={controller.showOutline}
                outlineItems={controller.outlineItems}
                outlineJumpRequest={controller.outlineJumpRequest}
                updateState={controller.updateState}
                onContentChange={controller.updateDraftContent}
                onSelectTab={(path) =>
                  void controller.activateNoteTab(path, { recordHistory: true })
                }
                onCloseTab={(path) => void controller.closeNoteTab(path)}
                onMoveTab={(sourcePath, targetPath, position) =>
                  controller.moveNoteTab(sourcePath, targetPath, position)
                }
                onToggleSidebar={handleToggleSidebar}
                onCreateNote={() => void controller.createNote()}
                onOpenSettings={handleOpenSettings}
                onOpenCommandPalette={handleOpenCommandPalette}
                onOpenLinkedFile={(path) => void handleOpenSkillLink(path)}
                onScrollPositionChange={handleDocumentScrollPositionChange}
                onNavigateBack={() => void controller.navigateBack()}
                onNavigateForward={() => void controller.navigateForward()}
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
                onOutlineJumpHandled={controller.clearOutlineJumpRequest}
                onToggleFocusMode={() => void controller.toggleFocusMode()}
                editorScale={controller.editorScale}
                onEditorScaleChange={(scale) => void controller.setEditorScale(scale)}
                onTogglePinnedFile={
                  controller.activeFile
                    ? () => void controller.togglePinnedFile(controller.activeFile!.path)
                    : undefined
                }
                updatesMode={controller.appInfo?.updatesMode}
                dismissedUpdateVersion={controller.settings?.dismissedUpdateVersion ?? null}
                onUpdateAction={() => void controller.triggerUpdateAction()}
                onDismissUpdateAction={() => void controller.dismissUpdateNotification()}
              />
            )}
          </div>
        </div>
      </AppLayout>

      <CommandPalette
        isOpen={controller.isPaletteOpen}
        query={controller.paletteQuery}
        items={paletteItems}
        onChangeQuery={controller.setPaletteQuery}
        onClose={() => {
          controller.setIsPaletteOpen(false);
        }}
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
        onOpenDefaultAppSettings={() => controller.openSystemDefaultAppSettings()}
        defaultAppStatus={controller.defaultAppStatus}
      />
      <NoteRenameDialog
        pending={pendingNoteRename}
        currentDisplayName={currentNoteDisplayName}
        onDismiss={() => setPendingNoteRename(null)}
        onConfirm={() => void handleConfirmNoteRename()}
        onValueChange={handleNoteRenameValueChange}
      />
      <NoteConfirmDialog
        pending={pendingNoteConfirm}
        onDismiss={() => setPendingNoteConfirm(null)}
        onConfirm={() => void handleConfirmCurrentNoteAction()}
      />
      <DefaultAppPrompt
        isOpen={showDefaultAppPrompt}
        platform={controller.appInfo?.platform ?? "darwin"}
        onDismiss={() => {
          setShowDefaultAppPrompt(false);
          controller.dismissDefaultAppPrompt();
        }}
        onMakeDefault={() => {
          controller.openSystemDefaultAppSettings();
          setShowDefaultAppPrompt(false);
          controller.dismissDefaultAppPrompt();
        }}
      />
    </TooltipProvider>
  );
};
