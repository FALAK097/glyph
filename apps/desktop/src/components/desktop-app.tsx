import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBaseName, getDisplayFileName, isSamePath, normalizePath } from "@/core/paths";
import { buildNoteCollections, filterNoteBrowserEntries } from "@/core/note-collections";
import { countGroupedSkills, groupSkillsForBrowse } from "@/core/skill-groups";
import { getShortcutDisplay } from "@/core/shortcuts";
import { SKILL_AGENT_CATALOG } from "@/core/skill-agent-catalog";
import type {
  NoteCollectionAccentKey,
  NoteCollectionIconKey,
  NoteBrowserEntry,
  ThemeMode,
  TabMovePosition,
} from "@/core/workspace";
import { useLayoutStore } from "@/store/layout";
import { useSessionStore } from "@/store/session";
import { useWorkspaceStore } from "@/store/workspace";
import type { DesktopAppProps } from "@/types/app";
import type { CommandPaletteItem } from "@/types/command-palette";
import type { PendingNoteConfirm, PendingNoteRename, SkillCollection } from "@/types/desktop-app";

import { useDesktopAppController } from "@/hooks/use-desktop-app-controller";
import { useSkillLibraryController } from "@/hooks/use-skill-library-controller";

import { AppLayout } from "./app-layout";
import { AppSurfaceShell } from "./app-surface-shell";
import { CommandPalette } from "./command-palette";
import { NotesBrowserPane } from "./notes/notes-browser-pane";
import { EditorToolbar } from "./editor-toolbar";
import { NotesFooterContent } from "./notes-footer-content";
import { NoteConfirmDialog } from "./note-confirm-dialog";
import { NoteRenameDialog } from "./note-rename-dialog";
import { DeleteDialog } from "./sidebar/sidebar-delete-dialogs";
import { SettingsPanel } from "./settings-panel";
import { SkillView } from "./skills/skill-view";
import { SkillsBrowserPane } from "./skills/skills-browser-pane";
import { SkillsFooterContent } from "./skills-footer-content";
import { SplitContainer } from "./split-container";
import { SplitViewActivePaneProvider, SplitViewProvider } from "./split-view-context";
import { TasksHeaderActions } from "./tasks/tasks-header-actions";
const LazyTasksView = React.lazy(() =>
  import("./tasks/tasks-view").then((module) => ({ default: module.TasksView })),
);
import type { SplitViewActivePaneContextValue, SplitViewContextValue } from "./split-view-context";
import { TooltipProvider } from "./ui/tooltip";
import { useUpdateStateFlags } from "./update-notification";

import { matchesPaletteQuery, matchesSkillPaletteFallback } from "./desktop-app/palette-utils";

export const DesktopApp = ({ glyph }: DesktopAppProps) => {
  const sessionHasHydrated = useSessionStore((state) => state.hasHydrated);
  const viewerMode = useSessionStore((state) => state.viewerMode);
  const isNotesExpanded = useSessionStore((state) => state.isNotesExpanded);
  const isSkillsExpanded = useSessionStore((state) => state.isSkillsExpanded);
  const selectedNoteCollectionPath = useSessionStore((state) => state.selectedNoteCollectionPath);
  const notesBrowserPaneWidth = useSessionStore((state) => state.notesBrowserPaneWidth);
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
  const setSelectedNoteCollectionPath = useSessionStore(
    (state) => state.setSelectedNoteCollectionPath,
  );
  const setNotesBrowserPaneWidth = useSessionStore((state) => state.setNotesBrowserPaneWidth);
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
    viewerMode: "note" | "skill" | "tasks";
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

  // Stable refs for cross-surface navigation callbacks — populated after
  // skillsController and setViewerMode are in scope.
  const onRestoreSkillRef = useRef<(path: string) => Promise<void>>(async () => {});
  const onRestoreTasksRef = useRef<() => void>(() => {});

  const controller = useDesktopAppController(glyph, {
    initialFilePath: initialNoteSessionRef.current.filePath,
    initialTabPaths: initialNoteSessionRef.current.tabPaths,
    initialWorkspacePath: initialNoteSessionRef.current.workspacePath,
    sessionReady: sessionHasHydrated,
    onRestoreSkill: useCallback((path: string) => onRestoreSkillRef.current(path), []),
    onRestoreTasks: useCallback(() => onRestoreTasksRef.current(), []),
  });
  const skillsController = useSkillLibraryController(glyph, {
    enabled: true,
  });

  // Wire cross-surface navigation restore callbacks (populated each render so
  // the stable refs always call the latest closures).
  onRestoreSkillRef.current = async (path: string) => {
    const matchingSkill = (skillsController.snapshot?.skills ?? []).find(
      (skill) => isSamePath(skill.skillFilePath, path) || isSamePath(skill.agentsFilePath, path),
    );
    const opened = await skillsController.openSkillByPath(path);
    if (!opened) {
      return;
    }
    const nextCollectionId = matchingSkill
      ? matchingSkill.sourceId === "agents-global"
        ? "global-skills"
        : matchingSkill.sourceId === "project-skills"
          ? "project-skills"
          : `${matchingSkill.sourceKind}-tool`
      : "all-skills";
    setSkillsExpanded(true);
    setSelectedSkillCollectionId(nextCollectionId);
    setViewerMode("skill");
  };
  onRestoreTasksRef.current = () => {
    setSelectedSkillCollectionId(null);
    setViewerMode("tasks");
  };
  const [pendingNoteRename, setPendingNoteRename] = useState<PendingNoteRename | null>(null);
  const [pendingNoteConfirm, setPendingNoteConfirm] = useState<PendingNoteConfirm | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [noteBrowserRefreshNonce, setNoteBrowserRefreshNonce] = useState(0);
  const [paletteSkillResultIds, setPaletteSkillResultIds] = useState<string[] | null>(null);
  const [resolvedPaletteSkillQuery, setResolvedPaletteSkillQuery] = useState("");
  const [skillInitialScrollTop, setSkillInitialScrollTop] = useState(0);
  const [pendingSkillRestorePath, setPendingSkillRestorePath] = useState<string | null>(null);
  const [isInitialSkillRestorePending, setIsInitialSkillRestorePending] = useState(false);
  const paletteSkillSearchNonceRef = useRef(0);
  const paletteFilterQuery = controller.paletteQuery.trim().toLowerCase();
  const shouldCollapseSidebar =
    controller.isSidebarCollapsed || (viewerMode === "note" && controller.isFocusMode);
  const shouldCollapseBrowserPane = viewerMode === "note" && controller.isFocusMode;
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
  const noteCollections = useMemo(
    () =>
      buildNoteCollections(
        controller.visibleSidebarNodes.map((entry) => entry.node),
        selectedNoteCollectionPath,
        controller.settings?.noteFolderAppearances,
      ),
    [
      controller.settings?.noteFolderAppearances,
      controller.visibleSidebarNodes,
      selectedNoteCollectionPath,
    ],
  );
  const activeNoteCollection = useMemo(
    () =>
      noteCollections.find((collection) => collection.path === selectedNoteCollectionPath) ??
      noteCollections[0] ??
      null,
    [noteCollections, selectedNoteCollectionPath],
  );
  const currentNoteDisplayName = useMemo(
    () => (controller.activeFile ? getDisplayFileName(controller.activeFile.name) : ""),
    [controller.activeFile],
  );
  const visibleSkills = useMemo(() => {
    if (!activeSkillCollection) {
      return [];
    }

    return allSkills.filter((skill) => activeSkillCollection.matches(skill));
  }, [activeSkillCollection, allSkills]);
  const visibleSkillItems = useMemo(() => {
    return groupSkillsForBrowse(visibleSkills);
  }, [visibleSkills]);
  const [noteBrowserEntries, setNoteBrowserEntries] = useState<NoteBrowserEntry[]>([]);
  const [isNoteBrowserLoading, setIsNoteBrowserLoading] = useState(false);
  const visibleNoteBrowserEntries = useMemo(
    () => filterNoteBrowserEntries(noteBrowserEntries, "", activeNoteCollection),
    [activeNoteCollection, noteBrowserEntries],
  );

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

  const handleSelectNoteCollection = useCallback(
    async (collectionPath: string) => {
      const collection = noteCollections.find((item) => item.path === collectionPath);
      const firstNotePath = collection?.notePaths[0] ?? null;

      setSelectedSkillCollectionId(null);
      setSelectedNoteCollectionPath(collectionPath);
      setViewerMode("note");

      if (firstNotePath) {
        await controller.openFile(firstNotePath);
      }
    },
    [
      controller,
      noteCollections,
      setSelectedNoteCollectionPath,
      setSelectedSkillCollectionId,
      setViewerMode,
    ],
  );

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

      useWorkspaceStore.getState().pushHistory({ kind: "skill", path: targetPath });
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

  const handleCreateNoteInCollection = useCallback(
    (collectionPath: string) => {
      void controller.createNote(collectionPath);
      setSelectedNoteCollectionPath(collectionPath);
      setViewerMode("note");
    },
    [controller, setSelectedNoteCollectionPath, setViewerMode],
  );

  const handleCreateFolderInCollection = useCallback(
    (collectionPath: string) => {
      void controller.createFolder(collectionPath);
      setSelectedNoteCollectionPath(collectionPath);
      setViewerMode("note");
    },
    [controller, setSelectedNoteCollectionPath, setViewerMode],
  );

  const handleChangeNoteCollectionAccent = useCallback(
    (collectionPath: string, accent: NoteCollectionAccentKey) => {
      const currentAppearances = controller.settings?.noteFolderAppearances ?? {};
      const nextAppearance = {
        ...currentAppearances[collectionPath],
        accent,
      };
      void controller.saveSettings({
        noteFolderAppearances: {
          ...currentAppearances,
          [collectionPath]: nextAppearance,
        },
      });
    },
    [controller],
  );

  const handleChangeNoteCollectionIcon = useCallback(
    (collectionPath: string, icon: NoteCollectionIconKey) => {
      const currentAppearances = controller.settings?.noteFolderAppearances ?? {};
      const nextAppearance = {
        ...currentAppearances[collectionPath],
        icon,
      };
      void controller.saveSettings({
        noteFolderAppearances: {
          ...currentAppearances,
          [collectionPath]: nextAppearance,
        },
      });
    },
    [controller],
  );

  useEffect(() => {
    if (!sessionHasHydrated) {
      return;
    }

    setIsInitialSkillRestorePending(initialSkillSessionRef.current.viewerMode === "skill");
  }, [sessionHasHydrated]);

  useEffect(() => {
    // Wait for the workspace to finish booting before touching the persisted
    // selection — otherwise the effect fires while noteCollections is still
    // empty (workspace not yet open) and incorrectly wipes the restored path.
    if (!controller.hasBooted) {
      return;
    }

    if (noteCollections.length === 0) {
      if (selectedNoteCollectionPath !== null) {
        setSelectedNoteCollectionPath(null);
      }
      return;
    }

    // If no collection was previously selected, do not auto-select — let the
    // user choose. Only auto-recover when a previously valid selection has
    // since been removed (e.g. the folder was deleted).
    if (selectedNoteCollectionPath === null) {
      return;
    }

    if (noteCollections.some((collection) => collection.path === selectedNoteCollectionPath)) {
      return;
    }

    setSelectedNoteCollectionPath(noteCollections[0]?.path ?? null);
  }, [
    controller.hasBooted,
    noteCollections,
    selectedNoteCollectionPath,
    setSelectedNoteCollectionPath,
  ]);

  useEffect(() => {
    const targetPaths = activeNoteCollection?.isAllCollection
      ? Array.from(
          new Set(
            noteCollections
              .filter((collection) => collection.isRootCollection && !collection.isAllCollection)
              .map((collection) => collection.sourcePath),
          ),
        )
      : [activeNoteCollection?.sourcePath ?? null];
    let isCancelled = false;

    setIsNoteBrowserLoading(true);
    void glyph
      .getNoteBrowserEntriesBatch(targetPaths)
      .then((entryGroups) => {
        if (isCancelled) {
          return;
        }

        const entriesByPath = new Map(
          entryGroups.flat().map((entry) => [entry.path.replace(/\\/g, "/").toLowerCase(), entry]),
        );
        setNoteBrowserEntries(Array.from(entriesByPath.values()));
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
        setNoteBrowserEntries([]);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsNoteBrowserLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeNoteCollection, glyph, noteCollections, noteBrowserRefreshNonce]);

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
      const normalizedFilePath = filePath.replace(/\\/g, "/").toLowerCase();
      const containingCollection = [...noteCollections]
        .filter(
          (collection) =>
            !collection.isAllCollection &&
            collection.notePaths.some(
              (notePath) => notePath.replace(/\\/g, "/").toLowerCase() === normalizedFilePath,
            ),
        )
        .sort((left, right) => right.sourcePath.length - left.sourcePath.length)[0];

      setSelectedSkillCollectionId(null);
      if (containingCollection) {
        setSelectedNoteCollectionPath(containingCollection.path);
      }
      setViewerMode("note");
      await controller.openFile(filePath);
    },
    [
      controller,
      noteCollections,
      setSelectedNoteCollectionPath,
      setSelectedSkillCollectionId,
      setViewerMode,
    ],
  );

  const handleOpenTasks = useCallback(() => {
    setSelectedSkillCollectionId(null);
    useWorkspaceStore.getState().pushHistory({ kind: "tasks" });
    setViewerMode("tasks");
  }, [setSelectedSkillCollectionId, setViewerMode]);

  const handleOpenTaskSource = useCallback(
    (_task?: unknown) => {
      setSelectedSkillCollectionId(null);
      setViewerMode("tasks");
    },
    [setSelectedSkillCollectionId, setViewerMode],
  );

  const handleOpenTasksMarkdown = useCallback(async () => {
    const rootPath = useWorkspaceStore.getState().rootPath;
    if (!rootPath) return;
    const tasksPath = normalizePath(`${rootPath}/Tasks.md`);
    setSelectedSkillCollectionId(null);
    setViewerMode("note");
    await controller.openFile(tasksPath);
  }, [controller, setSelectedSkillCollectionId, setViewerMode]);

  const handleOpenLinkedFile = useCallback(
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

        useWorkspaceStore.getState().pushHistory({ kind: "skill", path: targetPath });
        setViewerMode("skill");
        return;
      }

      setViewerMode("note");
      await controller.openFile(targetPath);
    },
    [activateSkillCollection, allSkills, controller, skillsController],
  );
  const handleDocumentScrollPositionChange = useCallback(
    (targetPath: string | null, scrollTop: number) => {
      setDocumentScroll(targetPath, scrollTop);
    },
    [setDocumentScroll],
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
    setNoteBrowserRefreshNonce((n) => n + 1);
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
      // Optimistically remove from notes browser if present
      setNoteBrowserEntries((current) =>
        current.filter((item) => !isSamePath(item.path, pendingNoteConfirm.path)),
      );
      await controller.handleDeleteFile(pendingNoteConfirm.path);
    }

    setPendingNoteConfirm(null);
  }, [controller, pendingNoteConfirm]);

  const handleConfirmFolderDelete = useCallback(async () => {
    if (!pendingFolderDelete) return;
    await controller.handleDeleteFolder(pendingFolderDelete.path);
    setPendingFolderDelete(null);
  }, [controller, pendingFolderDelete]);

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

  const isSkillSurfaceVisible = viewerMode === "skill";
  const isTasksSurfaceVisible = viewerMode === "tasks";
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
      if (viewerMode === "skill" || viewerMode === "tasks") {
        if (item.section === "Pinned Notes") {
          return false;
        }

        if (item.kind === "command" && noteOnlyCommandIds.has(item.id)) {
          return false;
        }
      }

      return true;
    });

    if (viewerMode !== "skill" && viewerMode !== "tasks") {
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
  }, [controller.paletteItems, setSelectedSkillCollectionId, setViewerMode, viewerMode]);

  const taskPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [];

    const query = paletteFilterQuery;

    items.push(
      {
        id: "open-tasks",
        title: "Open Tasks",
        subtitle: "Review workspace tasks and kanban board",
        section: "Tasks",
        kind: "command",
        onSelect: () => {
          handleOpenTasks();
          closePalette();
        },
      },
      {
        id: "open-tasks-markdown",
        title: "Open Tasks as Markdown",
        subtitle: "Edit Tasks.md directly in the note editor",
        section: "Tasks",
        kind: "command",
        onSelect: () => {
          void handleOpenTasksMarkdown();
          closePalette();
        },
      },
      {
        id: "add-task-list",
        title: "Add Task List",
        subtitle: "Create a new column in the task board",
        section: "Tasks",
        kind: "command",
        onSelect: () => {
          handleOpenTasks();
          closePalette();
          // Dispatch after the tasks view has had a chance to mount
          window.setTimeout(() => window.dispatchEvent(new Event("glyph:tasks-add-column")), 0);
        },
      },
    );

    return items.filter((item) => matchesPaletteQuery(query, item.title, item.subtitle));
  }, [closePalette, handleOpenTasks, handleOpenTasksMarkdown, paletteFilterQuery]);

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
      return [...taskPaletteItems, ...skillPaletteItems, ...visibleNotePaletteItems];
    }

    if (viewerMode === "tasks") {
      return [...taskPaletteItems, ...visibleNotePaletteItems, ...skillPaletteItems];
    }

    const noteItems = visibleNotePaletteItems.filter((item) => item.section === "Note");
    const themeItems = visibleNotePaletteItems.filter((item) => item.section === "Theme");
    const otherItems = visibleNotePaletteItems.filter(
      (item) => item.section !== "Note" && item.section !== "Theme",
    );

    return [
      ...otherItems,
      ...taskPaletteItems,
      ...noteItems,
      ...currentNotePaletteItems,
      ...themeItems,
      ...skillPaletteItems,
    ];
  }, [
    currentNotePaletteItems,
    skillPaletteItems,
    taskPaletteItems,
    viewerMode,
    visibleNotePaletteItems,
  ]);

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

  const toPathKey = useCallback((path: string) => normalizePath(path).toLowerCase(), []);
  const isMacLike = useMemo(() => navigator.platform.includes("Mac"), []);
  const noteHeaderPaddingClass = isMacLike ? "pl-20 pr-4" : "px-4";
  const noteUpdateStateFlags = useUpdateStateFlags(
    controller.updateState,
    controller.appInfo?.updatesMode,
    controller.settings?.dismissedUpdateVersion ?? null,
  );
  const handleCreateNote = useCallback(() => {
    void controller.createNote(activeNoteCollection?.sourcePath ?? undefined);
  }, [activeNoteCollection?.sourcePath, controller.createNote]);
  const handleCreateFolder = useCallback(() => {
    void controller.createFolder(activeNoteCollection?.sourcePath ?? undefined);
  }, [activeNoteCollection?.sourcePath, controller.createFolder]);
  const handleNavigateBack = useCallback(() => {
    void controller.navigateBack();
  }, [controller.navigateBack]);
  const handleNavigateForward = useCallback(() => {
    void controller.navigateForward();
  }, [controller.navigateForward]);
  const handleToggleFocusMode = useCallback(() => {
    void controller.toggleFocusMode();
  }, [controller.toggleFocusMode]);
  const handleEditorScaleChange = useCallback(
    (scale: number) => {
      void controller.setEditorScale(scale);
    },
    [controller.setEditorScale],
  );
  const handleUpdateAction = useCallback(() => {
    void controller.triggerUpdateAction();
  }, [controller.triggerUpdateAction]);
  const handleDismissUpdateAction = useCallback(() => {
    void controller.dismissUpdateNotification();
  }, [controller.dismissUpdateNotification]);
  const handleDisabledToolbarAction = useCallback(async () => {}, []);
  useEffect(() => {
    setSkillInitialScrollTop(
      skillsController.activeDocument
        ? useSessionStore.getState().getDocumentScroll(skillsController.activeDocument.path)
        : 0,
    );
  }, [skillsController.activeDocument, viewerMode]);
  const handleTogglePinnedPath = useCallback(
    (filePath: string) => {
      void controller.togglePinnedFile(filePath);
    },
    [controller.togglePinnedFile],
  );
  const handleSelectPaneTab = useCallback(
    (paneId: string, path: string) => {
      useLayoutStore.getState().setActivePaneId(paneId);
      useLayoutStore.getState().activateTabInPane(paneId, toPathKey(path));
      void controller.activateNoteTab(path, { recordHistory: true });
    },
    [controller.activateNoteTab, toPathKey],
  );
  const handleClosePaneTab = useCallback(
    (paneId: string, path: string) => {
      useLayoutStore.getState().setActivePaneId(paneId);
      void controller.closeTabFromActivePane(path);
    },
    [controller.closeTabFromActivePane],
  );
  const handleMovePaneTab = useCallback(
    (
      sourcePaneId: string,
      targetPaneId: string,
      sourcePath: string,
      targetPath: string,
      position: TabMovePosition,
    ) => {
      const layoutState = useLayoutStore.getState();
      const sourceTabId = toPathKey(sourcePath);
      const targetTabId = toPathKey(targetPath);

      layoutState.setActivePaneId(targetPaneId);
      if (sourcePaneId !== targetPaneId) {
        layoutState.moveTabToPane(sourceTabId, sourcePaneId, targetPaneId, targetTabId, position);
      } else {
        layoutState.reorderTabInPane(targetPaneId, sourceTabId, targetTabId, position);
      }

      controller.moveNoteTab(sourcePath, targetPath, position);
    },
    [controller.moveNoteTab, toPathKey],
  );
  const handlePaneContentChange = useCallback(
    (_paneId: string, tabId: string, content: string) => {
      const workspaceState = useWorkspaceStore.getState();
      if (workspaceState.activeTabId === tabId) {
        controller.updateDraftContent(content);
        return;
      }

      workspaceState.updateTabDraftContent(tabId, content);
    },
    [controller.updateDraftContent],
  );
  const handleActivatePane = useCallback(
    (paneId: string) => {
      useLayoutStore.getState().setActivePaneId(paneId);
      const paneState = useLayoutStore.getState().panes[paneId];
      if (!paneState?.activeTabId) {
        return;
      }

      const tab = useWorkspaceStore
        .getState()
        .noteTabs.find((entry) => entry.id === paneState.activeTabId);
      if (tab) {
        void controller.activateNoteTab(tab.file.path, { recordHistory: true });
      }
    },
    [controller.activateNoteTab],
  );
  const splitViewActivePaneContextValue = useMemo<SplitViewActivePaneContextValue>(
    () => ({
      editorFocusRequest: controller.editorFocusRequest,
      findRequest: controller.findRequest,
      outlineItems: controller.outlineItems,
      outlineJumpRequest: controller.outlineJumpRequest,
      onOutlineJumpHandled: controller.clearOutlineJumpRequest,
    }),
    [
      controller.clearOutlineJumpRequest,
      controller.editorFocusRequest,
      controller.findRequest,
      controller.outlineItems,
      controller.outlineJumpRequest,
    ],
  );

  const splitViewContextValue = useMemo<SplitViewContextValue>(
    () => ({
      // Appearance / settings
      shortcuts: controller.shortcuts,
      isSidebarCollapsed: controller.isSidebarCollapsed,
      isFocusMode: controller.isFocusMode,
      showOutline: controller.showOutline,
      editorScale: controller.editorScale,
      autoOpenPDFSetting: controller.settings?.autoOpenPDF ?? true,
      folderRevealLabel: controller.folderRevealLabel,
      updateState: controller.updateState,
      updatesMode: controller.appInfo?.updatesMode,
      dismissedUpdateVersion: controller.settings?.dismissedUpdateVersion ?? null,

      // Navigation
      canGoBack: controller.canGoBack,
      canGoForward: controller.canGoForward,

      // Callbacks
      onToggleSidebar: handleToggleSidebar,
      onCreateNote: handleCreateNote,
      onOpenSettings: handleOpenSettings,
      onOpenCommandPalette: handleOpenCommandPalette,
      onOpenLinkedFile: (path: string) => void handleOpenLinkedFile(path),
      onScrollPositionChange: handleDocumentScrollPositionChange,
      onNavigateBack: handleNavigateBack,
      onNavigateForward: handleNavigateForward,
      onToggleFocusMode: handleToggleFocusMode,
      onEditorScaleChange: handleEditorScaleChange,
      onUpdateAction: handleUpdateAction,
      onDismissUpdateAction: handleDismissUpdateAction,

      // Pinned files
      pinnedFilePaths: controller.settings?.pinnedFiles ?? [],
      onTogglePinnedFile: handleTogglePinnedPath,

      // Pane-aware tab operations
      onSelectTab: handleSelectPaneTab,
      onCloseTab: handleClosePaneTab,
      onMoveTab: handleMovePaneTab,
      onContentChange: handlePaneContentChange,
      onActivatePane: handleActivatePane,
    }),
    [
      controller.appInfo?.updatesMode,
      controller.canGoBack,
      controller.canGoForward,
      controller.editorScale,
      controller.folderRevealLabel,
      controller.isFocusMode,
      controller.isSidebarCollapsed,
      controller.settings?.autoOpenPDF,
      controller.settings?.dismissedUpdateVersion,
      controller.settings?.pinnedFiles,
      controller.shortcuts,
      controller.showOutline,
      controller.updateState,
      handleActivatePane,
      handleClosePaneTab,
      handleCreateNote,
      handleDismissUpdateAction,
      handleDocumentScrollPositionChange,
      handleEditorScaleChange,
      handleMovePaneTab,
      handleNavigateBack,
      handleNavigateForward,
      handleOpenCommandPalette,
      handleOpenLinkedFile,
      handleOpenSettings,
      handlePaneContentChange,
      handleSelectPaneTab,
      handleToggleFocusMode,
      handleTogglePinnedPath,
      toPathKey,
      handleToggleSidebar,
      handleUpdateAction,
    ],
  );
  const activeNoteFile = controller.activeFile;
  const isActiveNotePinned =
    activeNoteFile &&
    (controller.settings?.pinnedFiles ?? []).some((filePath) =>
      isSamePath(filePath, activeNoteFile.path),
    );

  const toolbarNode: React.ReactNode = isAppBootstrapping ? null : isTasksSurfaceVisible ? (
    <EditorToolbar
      _isMacLike={isMacLike}
      isSidebarCollapsed={controller.isSidebarCollapsed}
      toggleSidebarShortcut={getShortcutDisplay(
        controller.shortcuts,
        "toggle-sidebar",
        navigator.platform,
      )}
      onToggleSidebar={handleToggleSidebar}
      canGoBack={controller.canGoBack}
      canGoForward={controller.canGoForward}
      navigateBackShortcut={getShortcutDisplay(
        controller.shortcuts,
        "navigate-back",
        navigator.platform,
      )}
      navigateForwardShortcut={getShortcutDisplay(
        controller.shortcuts,
        "navigate-forward",
        navigator.platform,
      )}
      onNavigateBack={handleNavigateBack}
      onNavigateForward={handleNavigateForward}
      onCreateNote={undefined}
      newNoteShortcut={undefined}
      fileName={skillsController.activeDocument?.name ?? null}
      filePath={null}
      shouldShowCommandPalette={true}
      onOpenCommandPalette={handleOpenCommandPalette}
      commandPaletteShortcut={getShortcutDisplay(
        controller.shortcuts,
        "command-palette",
        navigator.platform,
      )}
      commandPaletteLabel="Search notes and skills"
      isFocusMode={undefined}
      onToggleFocusMode={undefined}
      focusModeShortcut={undefined}
      shouldShowUpdateActionButton={false}
      shouldShowMoreOptions={Boolean(skillsController.activeDocument)}
      updateButtonVariant="outline"
      isUpdateButtonDisabled={true}
      updateButtonLabel=""
      updateButtonTooltip=""
      onUpdateAction={undefined}
      onDismissUpdateAction={undefined}
      isManualReleaseButton={false}
      headerPaddingClass={noteHeaderPaddingClass}
      onOpenSettings={handleOpenSettings}
      headerAccessory={
        <TasksHeaderActions glyph={glyph} onOpenMarkdown={() => void handleOpenTasksMarkdown()} />
      }
      content=""
      documentLabel="task"
      revealInFolderLabel={controller.folderRevealLabel}
      onCopy={handleDisabledToolbarAction}
      onCopyPath={handleDisabledToolbarAction}
      onOpenExternal={handleDisabledToolbarAction}
      onExportPDF={handleDisabledToolbarAction}
      onTogglePinnedFile={undefined}
      isActiveFilePinned={false}
      editorScale={controller.editorScale}
      onEditorScaleChange={undefined}
      zoomInShortcut={undefined}
      zoomOutShortcut={undefined}
      zoomResetShortcut={undefined}
    />
  ) : isSkillSurfaceVisible ? (
    <EditorToolbar
      _isMacLike={isMacLike}
      isSidebarCollapsed={controller.isSidebarCollapsed}
      toggleSidebarShortcut={getShortcutDisplay(
        controller.shortcuts,
        "toggle-sidebar",
        navigator.platform,
      )}
      onToggleSidebar={handleToggleSidebar}
      canGoBack={controller.canGoBack}
      canGoForward={controller.canGoForward}
      navigateBackShortcut={getShortcutDisplay(
        controller.shortcuts,
        "navigate-back",
        navigator.platform,
      )}
      navigateForwardShortcut={getShortcutDisplay(
        controller.shortcuts,
        "navigate-forward",
        navigator.platform,
      )}
      onNavigateBack={handleNavigateBack}
      onNavigateForward={handleNavigateForward}
      onCreateNote={undefined}
      newNoteShortcut={undefined}
      fileName={null}
      filePath={null}
      shouldShowCommandPalette={true}
      onOpenCommandPalette={handleOpenCommandPalette}
      commandPaletteShortcut={getShortcutDisplay(
        controller.shortcuts,
        "command-palette",
        navigator.platform,
      )}
      commandPaletteLabel="Search notes and skills"
      isFocusMode={undefined}
      onToggleFocusMode={undefined}
      focusModeShortcut={undefined}
      shouldShowUpdateActionButton={false}
      shouldShowMoreOptions={false}
      updateButtonVariant="outline"
      isUpdateButtonDisabled={true}
      updateButtonLabel=""
      updateButtonTooltip=""
      onUpdateAction={undefined}
      onDismissUpdateAction={undefined}
      isManualReleaseButton={false}
      headerPaddingClass={noteHeaderPaddingClass}
      onOpenSettings={handleOpenSettings}
      headerAccessory={null}
      content={skillsController.draftContent}
      documentLabel="skill"
      revealInFolderLabel={controller.folderRevealLabel}
      onCopy={() => copyText(skillsController.draftContent)}
      onCopyPath={() =>
        skillsController.activeDocument
          ? copyText(skillsController.activeDocument.path)
          : Promise.resolve()
      }
      onOpenExternal={() =>
        skillsController.activeDocument
          ? skillsController.revealInFinder(skillsController.activeDocument.path)
          : Promise.resolve()
      }
      onExportPDF={() =>
        skillsController.activeDocument
          ? exportDocumentToPdf(skillsController.draftContent, skillsController.activeDocument.name)
          : Promise.resolve()
      }
      onTogglePinnedFile={undefined}
      isActiveFilePinned={false}
      editorScale={controller.editorScale}
      onEditorScaleChange={undefined}
      zoomInShortcut={undefined}
      zoomOutShortcut={undefined}
      zoomResetShortcut={undefined}
    />
  ) : (
    <EditorToolbar
      _isMacLike={isMacLike}
      isSidebarCollapsed={controller.isSidebarCollapsed}
      toggleSidebarShortcut={getShortcutDisplay(
        controller.shortcuts,
        "toggle-sidebar",
        navigator.platform,
      )}
      onToggleSidebar={handleToggleSidebar}
      canGoBack={controller.canGoBack}
      canGoForward={controller.canGoForward}
      navigateBackShortcut={getShortcutDisplay(
        controller.shortcuts,
        "navigate-back",
        navigator.platform,
      )}
      navigateForwardShortcut={getShortcutDisplay(
        controller.shortcuts,
        "navigate-forward",
        navigator.platform,
      )}
      onNavigateBack={() => void controller.navigateBack()}
      onNavigateForward={() => void controller.navigateForward()}
      onCreateNote={handleCreateNote}
      newNoteShortcut={getShortcutDisplay(controller.shortcuts, "new-note", navigator.platform)}
      fileName={activeNoteFile?.name ?? null}
      filePath={activeNoteFile?.path ?? null}
      shouldShowCommandPalette={true}
      onOpenCommandPalette={handleOpenCommandPalette}
      commandPaletteShortcut={getShortcutDisplay(
        controller.shortcuts,
        "command-palette",
        navigator.platform,
      )}
      commandPaletteLabel="Search notes and skills"
      isFocusMode={controller.isFocusMode}
      onToggleFocusMode={() => void controller.toggleFocusMode()}
      focusModeShortcut={getShortcutDisplay(controller.shortcuts, "focus-mode", navigator.platform)}
      shouldShowUpdateActionButton={noteUpdateStateFlags.shouldShowUpdateActionButton}
      shouldShowMoreOptions={false}
      updateButtonVariant={noteUpdateStateFlags.updateButtonVariant}
      isUpdateButtonDisabled={noteUpdateStateFlags.isUpdateButtonDisabled}
      updateButtonLabel={noteUpdateStateFlags.updateButtonLabel}
      updateButtonTooltip={noteUpdateStateFlags.updateButtonTooltip}
      onUpdateAction={() => void controller.triggerUpdateAction()}
      onDismissUpdateAction={() => void controller.dismissUpdateNotification()}
      isManualReleaseButton={noteUpdateStateFlags.isManualReleaseButton}
      headerPaddingClass={noteHeaderPaddingClass}
      onOpenSettings={handleOpenSettings}
      headerAccessory={null}
      content={controller.draftContent}
      documentLabel="note"
      revealInFolderLabel={controller.folderRevealLabel}
      onCopy={() => copyText(controller.draftContent)}
      onCopyPath={() => (activeNoteFile ? copyText(activeNoteFile.path) : Promise.resolve())}
      onOpenExternal={() =>
        activeNoteFile ? controller.revealInFinder(activeNoteFile.path) : Promise.resolve()
      }
      onExportPDF={() =>
        activeNoteFile
          ? exportDocumentToPdf(controller.draftContent, activeNoteFile.name)
          : Promise.resolve()
      }
      onTogglePinnedFile={
        activeNoteFile ? () => void controller.togglePinnedFile(activeNoteFile.path) : undefined
      }
      isActiveFilePinned={Boolean(isActiveNotePinned)}
      editorScale={controller.editorScale}
      onEditorScaleChange={(scale) => void controller.setEditorScale(scale)}
      zoomInShortcut={getShortcutDisplay(controller.shortcuts, "zoom-in", navigator.platform)}
      zoomOutShortcut={getShortcutDisplay(controller.shortcuts, "zoom-out", navigator.platform)}
      zoomResetShortcut={getShortcutDisplay(controller.shortcuts, "zoom-reset", navigator.platform)}
    />
  );

  // ─── Footer generation ────────────────────────────────────────────────
  const footerNode: React.ReactNode =
    isAppBootstrapping ? null : isTasksSurfaceVisible ? null : isSkillSurfaceVisible ? (
      <SkillsFooterContent
        draftContent={skillsController.draftContent || ""}
        saveStateLabel={skillsController.saveStateLabel}
      />
    ) : (
      <NotesFooterContent draftContent={controller.draftContent || ""} />
    );

  return (
    <TooltipProvider>
      <AppLayout
        toolbar={toolbarNode}
        footer={footerNode}
        shouldCollapseSidebar={shouldCollapseSidebar}
        tree={controller.visibleSidebarNodes}
        activePath={viewerMode === "note" ? (controller.activeFile?.path ?? null) : null}
        isSidebarCollapsed={controller.isSidebarCollapsed}
        isNotesExpanded={isNotesExpanded}
        isSkillsExpanded={isSkillsExpanded}
        isTasksActive={viewerMode === "tasks"}
        openInFolderLabel={controller.folderRevealLabel}
        pinnedNotes={controller.pinnedNotes}
        noteCollections={noteCollections}
        skillCollections={sidebarSkillCollections}
        onToggleNotesSection={handleToggleNotesSection}
        onToggleSkillsSection={handleToggleSkillsSection}
        onOpenTasks={handleOpenTasks}
        onSelectNoteCollection={handleSelectNoteCollection}
        onSelectSkillCollection={handleSelectSkillCollection}
        onOpenFile={(filePath) => void handleOpenNoteFile(filePath)}
        onOpenCommandPalette={handleOpenCommandPalette}
        onDeleteFile={controller.handleDeleteFile}
        onDeleteFolder={(folderPath) => {
          setPendingFolderDelete({ path: folderPath, name: getBaseName(folderPath) });
        }}
        onRemoveFileFromGlyph={(filePath) => void controller.handleRemoveFileFromGlyph(filePath)}
        onTogglePinnedFile={(filePath) => void controller.togglePinnedFile(filePath)}
        onRemoveFolder={controller.handleRemoveFolder}
        onRenameFile={async (filePath, newName) => {
          await controller.handleRenameFile(filePath, newName);
          setNoteBrowserRefreshNonce((n) => n + 1);
        }}
        onRenameFolder={(folderPath, newName) =>
          void controller.handleRenameFolder(folderPath, newName)
        }
        onRevealInFinder={(targetPath) => void controller.revealInFinder(targetPath)}
        onToggleFolder={controller.handleToggleFolder}
        onReorderNodes={controller.handleReorderNodes}
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
        onCreateNoteInCollection={handleCreateNoteInCollection}
        onCreateFolderInCollection={handleCreateFolderInCollection}
        onChangeNoteCollectionAccent={handleChangeNoteCollectionAccent}
        onChangeNoteCollectionIcon={handleChangeNoteCollectionIcon}
      >
        {(viewerMode === "note" ? controller.error : skillsController.error) ? (
          <div className="mx-10 mt-4 mb-2 rounded-lg bg-destructive px-4 py-3 text-sm text-destructive-foreground">
            {viewerMode === "note" ? controller.error : skillsController.error}
          </div>
        ) : null}

        {isTasksSurfaceVisible ? (
          <div className="flex h-full min-h-0 flex-col bg-background">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Loading tasks...
                </div>
              }
            >
              <LazyTasksView
                glyph={glyph}
                onOpenTaskSource={(task) => void handleOpenTaskSource(task)}
              />
            </Suspense>
          </div>
        ) : isSkillSurfaceVisible ? (
          <div className="grid h-full min-h-0 grid-cols-[292px_minmax(0,1fr)]">
            <SkillsBrowserPane
              activeSkillId={skillsController.activeSkill?.id ?? null}
              items={visibleSkillItems}
              onSelectSkill={(skillId) => void handleSelectSkill(skillId)}
              sourceKind={activeSkillCollection?.sourceKind}
              iconKind={activeSkillCollection?.iconKind}
              onCopySkill={(item) => {
                const skill = allSkills.find(
                  (candidate) => candidate.id === item.representativeSkillId,
                );
                if (skill) {
                  void glyph
                    .readSkillDocument(skill.skillFilePath)
                    .then((document) => copyText(document.content));
                }
              }}
              onCopySkillPath={(item) => {
                const skill = allSkills.find(
                  (candidate) => candidate.id === item.representativeSkillId,
                );
                if (skill) {
                  void copyText(skill.skillFilePath);
                }
              }}
              onRevealSkill={(item) => {
                const skill = allSkills.find(
                  (candidate) => candidate.id === item.representativeSkillId,
                );
                if (skill) {
                  void skillsController.revealInFinder(skill.skillFilePath);
                }
              }}
              onExportSkill={(item) => {
                const skill = allSkills.find(
                  (candidate) => candidate.id === item.representativeSkillId,
                );
                if (skill) {
                  void glyph
                    .readSkillDocument(skill.skillFilePath)
                    .then((document) => exportDocumentToPdf(document.content, document.name));
                }
              }}
            />
            <div className="min-h-0 min-w-0 overflow-hidden">
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
                folderRevealLabel={controller.folderRevealLabel}
                showOutline={controller.showOutline}
                onOpenLinkedFile={handleOpenLinkedFile}
                onScrollPositionChange={handleDocumentScrollPositionChange}
                onDraftContentChange={skillsController.setDraftContent}
                onKeepMineAfterExternalChange={skillsController.keepMineAfterExternalChange}
                onReloadAfterExternalChange={skillsController.reloadAfterExternalChange}
                onSelectDocumentTab={(kind) => void skillsController.openDocumentTab(kind)}
              />
            </div>
          </div>
        ) : (
          <AppSurfaceShell
            browserPane={
              shouldCollapseBrowserPane ? undefined : activeNoteCollection ? (
                <NotesBrowserPane
                  activePath={controller.activeFile?.path ?? null}
                  entries={visibleNoteBrowserEntries}
                  isLoading={isNoteBrowserLoading}
                  accent={activeNoteCollection.accent}
                  onOpenNote={(filePath) => void handleOpenNoteFile(filePath)}
                  onCopyNote={(entry) => {
                    void glyph.readFile(entry.path).then((file) => copyText(file.content));
                  }}
                  onCopyNotePath={(entry) => void copyText(entry.path)}
                  onExportNote={(entry) => {
                    void glyph
                      .readFile(entry.path)
                      .then((file) => exportDocumentToPdf(file.content, file.name));
                  }}
                  onTogglePinnedNote={(entry) => handleTogglePinnedPath(entry.path)}
                  isNotePinned={(entry) =>
                    (controller.settings?.pinnedFiles ?? []).some((filePath) =>
                      isSamePath(filePath, entry.path),
                    )
                  }
                  onRenameNote={(entry) => {
                    setPendingNoteRename({
                      path: entry.path,
                      name: entry.title,
                      value: entry.title,
                    });
                  }}
                  onRevealNote={(entry) => void controller.revealInFinder(entry.path)}
                  onRemoveNote={(entry) => {
                    setPendingNoteConfirm({
                      kind: "remove",
                      path: entry.path,
                      name: entry.title,
                    });
                  }}
                  onDeleteNote={(entry) => {
                    setPendingNoteConfirm({
                      kind: "delete",
                      path: entry.path,
                      name: entry.title,
                    });
                  }}
                />
              ) : null
            }
            browserPaneWidth={notesBrowserPaneWidth}
            onBrowserPaneResize={setNotesBrowserPaneWidth}
          >
            <div className="flex h-full min-h-0 flex-col bg-background">
              <div className="min-h-0 flex-1">
                <SplitViewProvider value={splitViewContextValue}>
                  <SplitViewActivePaneProvider value={splitViewActivePaneContextValue}>
                    <SplitContainer />
                  </SplitViewActivePaneProvider>
                </SplitViewProvider>
              </div>
            </div>
          </AppSurfaceShell>
        )}
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
      <DeleteDialog
        open={Boolean(pendingFolderDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingFolderDelete(null);
        }}
        title="Delete Folder"
        description={
          pendingFolderDelete ? (
            <>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                &ldquo;{pendingFolderDelete.name}&rdquo;
              </span>{" "}
              and all its contents? This action cannot be undone.
            </>
          ) : null
        }
        onConfirm={() => void handleConfirmFolderDelete()}
      />
    </TooltipProvider>
  );
};
