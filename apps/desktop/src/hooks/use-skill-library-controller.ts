import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { getErrorMessage } from "@/lib/errors";
import { isSamePath } from "@/lib/paths";
import {
  parseSkillDocument,
  type SkillDocument,
  type SkillDocumentKind,
  type SkillLibrarySnapshot,
} from "@/shared/skills";
import { useSessionStore } from "@/store/session";

export const ALL_SKILL_SOURCES_ID = "all-skills";

type UseSkillLibraryControllerOptions = {
  enabled?: boolean;
};

function formatSaveTime(timestamp: string | null) {
  if (!timestamp) {
    return "Ready";
  }

  return `Saved ${new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function matchesSkillFallbackQuery(query: string, skill: SkillLibrarySnapshot["skills"][number]) {
  if (!query) {
    return true;
  }

  return [skill.name, skill.description, skill.slug, skill.sourceName, skill.tags.join(" ")].some(
    (value) => value?.toLowerCase().includes(query),
  );
}

export function useSkillLibraryController(
  glyph: NonNullable<Window["glyph"]>,
  { enabled = true }: UseSkillLibraryControllerOptions = {},
) {
  const clearSkillSession = useSessionStore((state) => state.clearSkillSession);
  const setPreferredSkillDocumentKind = useSessionStore(
    (state) => state.setPreferredSkillDocumentKind,
  );
  const setSkillSession = useSessionStore((state) => state.setSkillSession);
  const [snapshot, setSnapshot] = useState<SkillLibrarySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState(ALL_SKILL_SOURCES_ID);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [selectedDocumentKind, setSelectedDocumentKind] = useState<SkillDocumentKind>("skill");
  const [activeDocument, setActiveDocument] = useState<SkillDocument | null>(null);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
  const [searchResultQuery, setSearchResultQuery] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [pendingExternalChange, setPendingExternalChange] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const activeDocumentRef = useRef<SkillDocument | null>(null);
  const draftContentRef = useRef(draftContent);
  const lastSyncedContentRef = useRef("");
  const isSavingRef = useRef(false);
  const autosaveTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const documentRequestNonceRef = useRef(0);
  const searchRequestNonceRef = useRef(0);

  useEffect(() => {
    activeDocumentRef.current = activeDocument;
  }, [activeDocument]);

  useEffect(() => {
    draftContentRef.current = draftContent;
  }, [draftContent]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const clearAutosaveTimeout = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
  }, []);

  const clearActiveSelection = useCallback(() => {
    setActiveSkillId(null);
    setActiveDocument(null);
    setDraftContent("");
    draftContentRef.current = "";
    lastSyncedContentRef.current = "";
    setLastSavedAt(null);
    setPendingExternalChange(null);
    setSelectedDocumentKind("skill");
  }, []);

  const activeSkill = useMemo(
    () => snapshot?.skills.find((skill) => skill.id === activeSkillId) ?? null,
    [activeSkillId, snapshot?.skills],
  );
  const skillsById = useMemo(
    () => new Map((snapshot?.skills ?? []).map((skill) => [skill.id, skill])),
    [snapshot?.skills],
  );

  const filteredSkills = useMemo(() => {
    const skills = snapshot?.skills ?? [];
    const query = deferredSearchQuery.trim().toLowerCase();

    if (!query) {
      return skills;
    }

    if (!searchResultIds || searchResultQuery !== query) {
      return skills.filter((skill) => matchesSkillFallbackQuery(query, skill));
    }

    return searchResultIds.flatMap((skillId) => {
      const skill = skillsById.get(skillId);
      return skill ? [skill] : [];
    });
  }, [deferredSearchQuery, searchResultIds, searchResultQuery, skillsById, snapshot?.skills]);

  const activeDocumentPath = useMemo(() => {
    if (!activeSkill) {
      return null;
    }

    if (selectedDocumentKind === "agents" && activeSkill.agentsFilePath) {
      return activeSkill.agentsFilePath;
    }

    return activeSkill.skillFilePath;
  }, [activeSkill, selectedDocumentKind]);

  const parsedActiveDocument = useMemo(() => parseSkillDocument(draftContent), [draftContent]);

  const headings = useMemo(() => {
    return parsedActiveDocument.body
      .split("\n")
      .filter((line) => line.trim().startsWith("#"))
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 10);
  }, [parsedActiveDocument.body]);

  const wordCount = useMemo(() => {
    const text = draftContent.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [draftContent]);

  const lineCount = useMemo(() => {
    if (!draftContent) {
      return 0;
    }

    return draftContent.split("\n").length;
  }, [draftContent]);

  const documentTabs = useMemo(() => {
    if (!activeSkill) {
      return [];
    }

    const tabs: Array<{ kind: SkillDocumentKind; label: string; path: string }> = [
      {
        kind: "skill",
        label: "SKILL.md",
        path: activeSkill.skillFilePath,
      },
    ];

    if (activeSkill.agentsFilePath) {
      tabs.push({
        kind: "agents",
        label: "AGENTS.md",
        path: activeSkill.agentsFilePath,
      });
    }

    return tabs;
  }, [activeSkill]);

  const isDirty = draftContent !== lastSyncedContentRef.current;
  const saveStateLabel = isSaving
    ? "Saving..."
    : activeDocument && !activeDocument.isEditable
      ? "Read-only"
      : isDirty
        ? "Unsaved"
        : formatSaveTime(lastSavedAt);

  const loadLibrary = useCallback(
    async (forceRefresh = false) => {
      if (!enabled) {
        return null;
      }

      setError(null);
      if (snapshot) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const nextSnapshot = forceRefresh
          ? await glyph.refreshSkillLibrary()
          : await glyph.getSkillLibrary();
        setSnapshot(nextSnapshot);
        setHasLoadedOnce(true);
        return nextSnapshot;
      } catch (nextError) {
        setError(getErrorMessage(nextError));
        return null;
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [enabled, glyph, snapshot],
  );

  const loadActiveDocument = useCallback(
    async (nextPath: string) => {
      documentRequestNonceRef.current += 1;
      const requestNonce = documentRequestNonceRef.current;
      setIsDocumentLoading(true);
      setActiveDocument(null);
      setDraftContent("");
      draftContentRef.current = "";
      lastSyncedContentRef.current = "";
      setLastSavedAt(null);
      setPendingExternalChange(null);
      setError(null);

      try {
        const nextDocument = await glyph.readSkillDocument(nextPath);
        if (requestNonce !== documentRequestNonceRef.current) {
          return;
        }

        setActiveDocument(nextDocument);
        setDraftContent(nextDocument.content);
        draftContentRef.current = nextDocument.content;
        lastSyncedContentRef.current = nextDocument.content;
        setLastSavedAt(nextDocument.lastModifiedAt);
        setPendingExternalChange(null);
        setError(null);
      } catch (nextError) {
        if (requestNonce !== documentRequestNonceRef.current) {
          return;
        }

        setActiveDocument(null);
        setDraftContent("");
        draftContentRef.current = "";
        lastSyncedContentRef.current = "";
        setLastSavedAt(null);
        setPendingExternalChange(null);
        setError(getErrorMessage(nextError));
      } finally {
        if (requestNonce === documentRequestNonceRef.current) {
          setIsDocumentLoading(false);
        }
      }
    },
    [glyph],
  );

  const flushActiveDocument = useCallback(async () => {
    clearAutosaveTimeout();

    const currentDocument = activeDocumentRef.current;
    const nextDraft = draftContentRef.current;

    if (!currentDocument || !currentDocument.isEditable) {
      return true;
    }

    if (nextDraft === lastSyncedContentRef.current) {
      return true;
    }

    setIsSaving(true);
    setError(null);

    try {
      const savedDocument = await glyph.saveSkillDocument(currentDocument.path, nextDraft);
      setActiveDocument(savedDocument);
      setDraftContent(savedDocument.content);
      draftContentRef.current = savedDocument.content;
      lastSyncedContentRef.current = savedDocument.content;
      setLastSavedAt(savedDocument.lastModifiedAt);
      setPendingExternalChange(null);
      return true;
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [clearAutosaveTimeout, glyph]);

  const openSkill = useCallback(
    async (skillId: string) => {
      if (skillId === activeSkillId) {
        return;
      }

      const didFlush = await flushActiveDocument();
      if (!didFlush) {
        return;
      }

      setActiveSkillId(skillId);
      setSelectedDocumentKind("skill");
    },
    [activeSkillId, flushActiveDocument],
  );

  const openDocumentTab = useCallback(
    async (nextKind: SkillDocumentKind) => {
      if (nextKind === selectedDocumentKind) {
        return;
      }

      const didFlush = await flushActiveDocument();
      if (!didFlush) {
        return;
      }

      setSelectedDocumentKind(nextKind);
    },
    [flushActiveDocument, selectedDocumentKind],
  );

  const refreshLibrary = useCallback(async () => {
    const didFlush = await flushActiveDocument();
    if (!didFlush) {
      return;
    }

    await loadLibrary(true);
  }, [flushActiveDocument, loadLibrary]);

  const revealInFinder = useCallback(
    async (targetPath: string) => {
      try {
        await glyph.revealInFinder(targetPath);
      } catch (nextError) {
        setError(getErrorMessage(nextError));
      }
    },
    [glyph],
  );

  const copyPath = useCallback(async (targetPath: string) => {
    try {
      await navigator.clipboard.writeText(targetPath);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }, []);

  const searchSkillIds = useCallback(
    async (query: string) => {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        return snapshot?.skills.map((skill) => skill.id) ?? [];
      }

      return glyph.searchSkillLibrary(normalizedQuery);
    },
    [glyph, snapshot?.skills],
  );

  const selectSource = useCallback(
    async (sourceId: string) => {
      if (sourceId === selectedSourceId) {
        return;
      }

      const didFlush = await flushActiveDocument();
      if (!didFlush) {
        return;
      }

      setSelectedSourceId(sourceId);

      const nextMatches = filteredSkills.filter((skill) =>
        sourceId === ALL_SKILL_SOURCES_ID ? true : skill.sourceId === sourceId,
      );

      if (nextMatches.length === 0) {
        clearActiveSelection();
        return;
      }

      if (!nextMatches.some((skill) => skill.id === activeSkillId)) {
        setActiveSkillId(nextMatches[0].id);
        setSelectedDocumentKind("skill");
      }
    },
    [activeSkillId, clearActiveSelection, flushActiveDocument, filteredSkills, selectedSourceId],
  );

  const resolveSkillByPath = useCallback(
    (targetPath: string) =>
      snapshot?.skills.find(
        (skill) =>
          isSamePath(skill.skillFilePath, targetPath) ||
          isSamePath(skill.agentsFilePath, targetPath),
      ) ?? null,
    [snapshot?.skills],
  );

  const openSkillByPath = useCallback(
    async (targetPath: string) => {
      const matchingSkill = resolveSkillByPath(targetPath);
      if (!matchingSkill) {
        return false;
      }

      const didFlush = await flushActiveDocument();
      if (!didFlush) {
        return false;
      }

      setSelectedSourceId(matchingSkill.sourceId);
      setActiveSkillId(matchingSkill.id);
      setSelectedDocumentKind(
        isSamePath(matchingSkill.agentsFilePath, targetPath) ? "agents" : "skill",
      );
      return true;
    },
    [flushActiveDocument, resolveSkillByPath],
  );

  const reloadAfterExternalChange = useCallback(async () => {
    if (!pendingExternalChange) {
      return;
    }

    await loadActiveDocument(pendingExternalChange.path);
  }, [loadActiveDocument, pendingExternalChange]);

  const keepMineAfterExternalChange = useCallback(async () => {
    setPendingExternalChange(null);
    await flushActiveDocument();
  }, [flushActiveDocument]);

  useEffect(() => {
    if (!enabled || hasLoadedOnce) {
      return;
    }

    void loadLibrary();
  }, [enabled, hasLoadedOnce, loadLibrary]);

  useEffect(() => {
    if (!enabled) {
      searchRequestNonceRef.current += 1;
      setSearchResultIds(null);
      setSearchResultQuery(null);
      return;
    }

    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) {
      searchRequestNonceRef.current += 1;
      setSearchResultIds(null);
      setSearchResultQuery(null);
      return;
    }

    setSearchResultIds(null);
    setSearchResultQuery(null);

    searchRequestNonceRef.current += 1;
    const requestNonce = searchRequestNonceRef.current;

    void searchSkillIds(query)
      .then((nextResultIds) => {
        if (requestNonce !== searchRequestNonceRef.current) {
          return;
        }

        setSearchResultIds(nextResultIds);
        setSearchResultQuery(query);
      })
      .catch((nextError) => {
        if (requestNonce !== searchRequestNonceRef.current) {
          return;
        }

        setSearchResultIds([]);
        setSearchResultQuery(query);
        setError(getErrorMessage(nextError));
      });
  }, [deferredSearchQuery, enabled, searchSkillIds]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return glyph.onSkillLibraryChanged((event) => {
      setSnapshot(event.snapshot);

      const currentDocument = activeDocumentRef.current;
      if (!currentDocument) {
        return;
      }

      const isCurrentDocumentChanged = event.changedPaths.some((changedPath) =>
        isSamePath(changedPath, currentDocument.path),
      );

      if (!isCurrentDocumentChanged || isSavingRef.current) {
        return;
      }

      if (draftContentRef.current !== lastSyncedContentRef.current) {
        clearAutosaveTimeout();
        setPendingExternalChange({
          path: currentDocument.path,
          name: currentDocument.name,
        });
        return;
      }

      void loadActiveDocument(currentDocument.path);
    });
  }, [clearAutosaveTimeout, enabled, glyph, loadActiveDocument]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (snapshot.skills.length === 0) {
      clearActiveSelection();
      return;
    }

    if (activeSkillId && !snapshot.skills.some((skill) => skill.id === activeSkillId)) {
      clearActiveSelection();
    }
  }, [activeSkillId, clearActiveSelection, snapshot]);

  useEffect(() => {
    if (!activeSkill) {
      return;
    }

    if (selectedDocumentKind === "agents" && !activeSkill.agentsFilePath) {
      setSelectedDocumentKind("skill");
    }
  }, [activeSkill, selectedDocumentKind]);

  useEffect(() => {
    if (!enabled || !activeDocumentPath) {
      return;
    }

    void loadActiveDocument(activeDocumentPath);
  }, [activeDocumentPath, enabled, loadActiveDocument]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!activeDocumentPath) {
      clearSkillSession();
      return;
    }

    setSkillSession(activeDocumentPath, selectedDocumentKind);
    setPreferredSkillDocumentKind(activeSkillId, selectedDocumentKind);
  }, [
    activeDocumentPath,
    activeSkillId,
    clearSkillSession,
    enabled,
    selectedDocumentKind,
    setPreferredSkillDocumentKind,
    setSkillSession,
  ]);

  useEffect(() => {
    if (!enabled || pendingExternalChange || !activeDocument?.isEditable || !isDirty) {
      clearAutosaveTimeout();
      return;
    }

    clearAutosaveTimeout();
    autosaveTimeoutRef.current = window.setTimeout(() => {
      void flushActiveDocument();
    }, 700);

    return clearAutosaveTimeout;
  }, [
    activeDocument?.isEditable,
    clearAutosaveTimeout,
    draftContent,
    enabled,
    flushActiveDocument,
    isDirty,
    pendingExternalChange,
  ]);

  useEffect(() => {
    return () => {
      clearAutosaveTimeout();
    };
  }, [clearAutosaveTimeout]);

  return useMemo(
    () => ({
      activeDocument,
      activeSkill,
      clearActiveSelection,
      copyPath,
      documentTabs,
      draftContent,
      error,
      filteredSkills,
      hasLoadedOnce,
      headings,
      isDirty,
      isDocumentLoading,
      isLoading,
      isRefreshing,
      isSaving,
      lastScannedAt: snapshot?.scannedAt ?? null,
      lineCount,
      openDocumentTab,
      openSkill,
      openSkillByPath,
      parsedActiveDocument,
      pendingExternalChange,
      refreshLibrary,
      reloadAfterExternalChange,
      revealInFinder,
      saveStateLabel,
      searchQuery,
      searchSkillIds,
      selectSource,
      selectedDocumentKind,
      selectedSourceId,
      setDraftContent,
      setSearchQuery,
      snapshot,
      sources: snapshot?.sources ?? [],
      totalSkillCount: snapshot?.skills.length ?? 0,
      wordCount,
      keepMineAfterExternalChange,
    }),
    [
      activeDocument,
      activeSkill,
      clearActiveSelection,
      copyPath,
      documentTabs,
      draftContent,
      error,
      filteredSkills,
      hasLoadedOnce,
      headings,
      isDirty,
      isDocumentLoading,
      isLoading,
      isRefreshing,
      isSaving,
      lineCount,
      openDocumentTab,
      openSkill,
      openSkillByPath,
      parsedActiveDocument,
      pendingExternalChange,
      refreshLibrary,
      reloadAfterExternalChange,
      revealInFinder,
      saveStateLabel,
      searchQuery,
      searchSkillIds,
      selectSource,
      selectedDocumentKind,
      selectedSourceId,
      setDraftContent,
      setSearchQuery,
      snapshot,
      wordCount,
      keepMineAfterExternalChange,
    ],
  );
}
