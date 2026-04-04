import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { getDisplayFileName, isSamePath } from "@/lib/paths";
import { countGroupedSkills, groupSkillsForBrowse } from "@/lib/skill-groups";
import { formatByteSize } from "@/lib/format-byte-size";
import { getShortcutDisplay } from "@/shared/shortcuts";
import { SKILL_AGENT_CATALOG } from "@/shared/skill-agent-catalog";
import type { SkillEntry, SkillSourceKind, SkillToolKind } from "@/shared/skills";
import type { ThemeMode } from "@/shared/workspace";
import type { DesktopAppProps } from "@/types/app";
import type { CommandPaletteItem } from "@/types/command-palette";

import { useDesktopAppController } from "@/hooks/use-desktop-app-controller";
import { useSkillLibraryController } from "@/hooks/use-skill-library-controller";

import { CommandPalette } from "./command-palette";
import { MarkdownEditor } from "./markdown-editor";
import { SettingsPanel } from "./settings-panel";
import { Sidebar } from "./sidebar";
import { SkillDocumentPane } from "./skill-document-pane";
import { SkillsBrowserPane } from "./skills-browser-pane";
import { SkillEmptyPane } from "./skill-empty-pane";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
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

export const DesktopApp = ({ glyph }: DesktopAppProps) => {
  const controller = useDesktopAppController(glyph);
  const skillsController = useSkillLibraryController(glyph, {
    enabled: true,
  });
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);
  const [selectedSkillCollectionId, setSelectedSkillCollectionId] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<"note" | "skill">("note");
  const [pendingNoteRename, setPendingNoteRename] = useState<PendingNoteRename | null>(null);
  const [pendingNoteConfirm, setPendingNoteConfirm] = useState<PendingNoteConfirm | null>(null);
  const [paletteSkillResultIds, setPaletteSkillResultIds] = useState<string[] | null>(null);
  const [resolvedPaletteSkillQuery, setResolvedPaletteSkillQuery] = useState("");
  const noteRenameInputRef = useRef<HTMLInputElement | null>(null);
  const confirmCancelRef = useRef<HTMLButtonElement | null>(null);
  const paletteSkillSearchNonceRef = useRef(0);
  const deferredPaletteQuery = useDeferredValue(controller.paletteQuery);
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
    setIsSkillsExpanded(nextValue);

    if (!nextValue) {
      setSelectedSkillCollectionId(null);
      setViewerMode("note");
    }
  }, [isSkillsExpanded]);

  const handleToggleNotesSection = useCallback(() => {
    setIsNotesExpanded((value) => !value);
  }, []);

  const activateSkillCollection = useCallback((collectionId: string) => {
    setIsSkillsExpanded(true);
    setSelectedSkillCollectionId(collectionId);
    setViewerMode("skill");
  }, []);

  const openSkillInCollection = useCallback(
    async (skillId: string) => {
      const matchingSkill = allSkills.find((skill) => skill.id === skillId);
      if (!matchingSkill) {
        return;
      }

      const targetPath = matchingSkill.skillFilePath;

      const opened = await skillsController.openSkillByPath(targetPath);
      if (!opened) {
        await skillsController.openSkill(skillId);
      }

      setViewerMode("skill");
    },
    [allSkills, skillsController],
  );

  const handleSelectSkillCollection = useCallback(
    (collectionId: string) => {
      setIsSkillsExpanded(true);
      const isSameCollection = selectedSkillCollectionId === collectionId;
      setSelectedSkillCollectionId(isSameCollection ? null : collectionId);
      setViewerMode(isSameCollection ? "note" : "skill");

      if (isSameCollection) {
        return;
      }
    },
    [selectedSkillCollectionId],
  );

  const handleSelectSkill = useCallback(
    async (skillId: string) => {
      await openSkillInCollection(skillId);
    },
    [openSkillInCollection],
  );

  useEffect(() => {
    if (!selectedSkillCollectionId || viewerMode !== "skill") {
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
    skillsController.activeSkill,
    skillsController.clearActiveSelection,
    viewerMode,
    visibleSkillItems,
    visibleSkills,
  ]);

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
  }, [controller]);

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

  useEffect(() => {
    if (!pendingNoteRename) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      noteRenameInputRef.current?.focus();
      noteRenameInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingNoteRename]);

  useEffect(() => {
    if (!pendingNoteConfirm) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      confirmCancelRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingNoteConfirm]);

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

    const query = deferredPaletteQuery.trim();
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
  }, [controller.isPaletteOpen, deferredPaletteQuery, skillsController.searchSkillIds]);

  const visibleNotePaletteItems = useMemo(() => {
    const noteOnlyCommandIds = new Set(["new-note", "pin-note", "toggle-focus-mode"]);

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

    const query = controller.paletteQuery.trim().toLowerCase();
    const items: CommandPaletteItem[] = [
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
        title: `Reveal in ${controller.folderRevealLabel}`,
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
    ];

    return items.filter((item) => matchesPaletteQuery(query, item.title, item.subtitle));
  }, [
    controller.activeFile,
    controller.folderRevealLabel,
    controller.paletteQuery,
    handleCopyCurrentNoteMarkdown,
    handleCopyCurrentNotePath,
    handleExportCurrentNote,
    handleOpenCurrentNoteConfirm,
    handleRenameCurrentNote,
    handleRevealCurrentNote,
    viewerMode,
  ]);

  const skillPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const query = controller.paletteQuery.trim().toLowerCase();
    const paletteSkillResultIdSet = paletteSkillResultIds ? new Set(paletteSkillResultIds) : null;

    const skillItems =
      query && resolvedPaletteSkillQuery === query && paletteSkillResultIdSet
        ? groupSkillsForBrowse(
            (skillsController.snapshot?.skills ?? []).filter((skill) =>
              paletteSkillResultIdSet.has(skill.id),
            ),
          ).slice(0, 12)
        : [];

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
              title: `Reveal in ${controller.folderRevealLabel}`,
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
    controller.paletteQuery,
    handleCopyCurrentSkillMarkdown,
    handleExportCurrentSkill,
    openSkillFromSearchResult,
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

  useEffect(() => {
    controller.setSelectedIndex(0);
  }, [controller.setSelectedIndex, paletteItems.length, viewerMode]);

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
                items={visibleSkillItems}
                searchQuery={skillsController.searchQuery}
                onSelectSkill={(skillId) => void handleSelectSkill(skillId)}
                onSearchQueryChange={skillsController.setSearchQuery}
                title={activeSkillCollection?.label ?? "Skills"}
              />
            ) : null}

            <div className="min-h-0 min-w-0">
              {isSkillSurfaceVisible ? (
                skillsController.activeDocument && isActiveSkillVisible ? (
                  <SkillDocumentPane
                    activeDocument={skillsController.activeDocument}
                    draftContent={skillsController.draftContent}
                    documentTabs={skillsController.documentTabs}
                    fileLabel={
                      skillsController.activeSkill?.name ?? skillsController.activeDocument.name
                    }
                    commandPaletteShortcut={
                      getShortcutDisplay(controller.shortcuts, "command-palette") ?? "⌘P"
                    }
                    isSidebarCollapsed={controller.isSidebarCollapsed}
                    isSwitchingDocuments={
                      skillsController.isDocumentLoading || skillsController.isSaving
                    }
                    pendingExternalChange={skillsController.pendingExternalChange}
                    saveStateLabel={skillsController.saveStateLabel}
                    onChange={skillsController.setDraftContent}
                    onKeepMineAfterExternalChange={skillsController.keepMineAfterExternalChange}
                    showOutline={controller.showOutline}
                    toggleSidebarShortcut={getShortcutDisplay(
                      controller.shortcuts,
                      "toggle-sidebar",
                    )}
                    folderRevealLabel={controller.folderRevealLabel}
                    onOpenCommandPalette={() => controller.setIsPaletteOpen(true)}
                    onOpenLinkedFile={(targetPath) => void handleOpenSkillLink(targetPath)}
                    onOpenSettings={() => controller.setIsSettingsOpen(true)}
                    onReloadAfterExternalChange={skillsController.reloadAfterExternalChange}
                    onSelectDocumentTab={(kind) => void skillsController.openDocumentTab(kind)}
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
                  commandPaletteLabel="Search notes and skills"
                  onOpenLinkedFile={(path) => void handleOpenSkillLink(path)}
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
          items={paletteItems}
          selectedIndex={controller.selectedIndex}
          onChangeQuery={controller.setPaletteQuery}
          onClose={() => {
            controller.setIsPaletteOpen(false);
          }}
          onHoverItem={controller.setSelectedIndex}
          onMove={(direction) => {
            if (paletteItems.length === 0) {
              return;
            }

            controller.setSelectedIndex(
              (value) => (value + direction + paletteItems.length) % paletteItems.length,
            );
          }}
          onSelect={() => paletteItems[controller.selectedIndex]?.onSelect()}
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
        {pendingNoteRename ? (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setPendingNoteRename(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Rename Current Note</DialogTitle>
                <DialogDescription>
                  Update{" "}
                  <span className="font-semibold text-foreground">
                    "{currentNoteDisplayName || pendingNoteRename.name}"
                  </span>{" "}
                  without leaving the keyboard.
                </DialogDescription>
              </DialogHeader>
              <Input
                ref={noteRenameInputRef}
                autoFocus
                value={pendingNoteRename.value}
                onChange={(event) =>
                  setPendingNoteRename((current) =>
                    current
                      ? {
                          ...current,
                          value: event.target.value,
                        }
                      : current,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleConfirmNoteRename();
                  }
                }}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setPendingNoteRename(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleConfirmNoteRename()}>
                  Rename
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
        {pendingNoteConfirm ? (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setPendingNoteConfirm(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>
                  {pendingNoteConfirm.kind === "remove"
                    ? "Remove Current Note From Glyph"
                    : "Delete Current Note"}
                </DialogTitle>
                <DialogDescription>
                  {pendingNoteConfirm.kind === "remove"
                    ? `Remove "${pendingNoteConfirm.name}" from Glyph? This only hides it from the app and does not delete the file from your device.`
                    : `Delete "${pendingNoteConfirm.name}" from your device? This action cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  ref={confirmCancelRef}
                  variant="outline"
                  type="button"
                  onClick={() => setPendingNoteConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={pendingNoteConfirm.kind === "delete" ? "destructive" : "default"}
                  type="button"
                  onClick={() => void handleConfirmCurrentNoteAction()}
                >
                  {pendingNoteConfirm.kind === "remove" ? "Remove" : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </TooltipProvider>
  );
};
