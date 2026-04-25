import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";

import { createHeadingId } from "@/core/note-navigation";
import { getFolderRevealLabel } from "@/core/platform";

import { CustomCodeBlockLowlight } from "./tiptap-extension/code-block-lowlight";
import {
  FindHighlightExtension,
  getFindHighlightState,
  setActiveFindHighlightMatch,
  setFindHighlightQuery,
} from "./tiptap-extension/find-highlight";
import { MarkdownShortcuts } from "./tiptap-extension/markdown-shortcuts";

import { Button } from "@/components/ui/button";

import { EditorToolbar } from "./editor-toolbar";
import { EditorFooter } from "./editor-footer";
import { EditorDialogs } from "./editor-dialogs";
import { useUpdateStateFlags } from "./update-notification";
import { SlashCommand } from "@/core/slash-command";
import { TableOfContents } from "./table-of-contents";
import { TableControls } from "./table-controls";
import { FindPanel } from "./find-panel";
import { LinkPreview } from "./link-preview";
import { ImageControls } from "./image-controls";
import { ArrowDownIcon, ArrowUpIcon, OutlineIcon, SearchIcon, TrashIcon, XIcon } from "./icons";

import type {
  EditorActionDetail,
  EditorActionType,
  EditorOutlineItem,
  FindPanelState,
  HoveredLinkState,
  ImageControlsState,
  MarkdownEditorProps,
  MarkdownEditorToast,
  SelectionSnapshot,
  TableControlsState,
} from "../types/markdown-editor";
import type { OutlineItem } from "@/types/navigation";
import type { NoteLinkPreview, UpdateState } from "@/core/workspace";

const LINK_IMAGE_PATTERN = /(!?)\[([^\]]+)\]\(([^)]+)\)$/;
const MARKDOWN_FILE_SUFFIX_PATTERN = /\.(md|mdx|markdown)$/i;
const WINDOWS_DRIVE_PATH_PATTERN = /^[a-z]:[\\/]/i;

const getDevPreviewUpdateState = (): UpdateState | null => {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const previewStatus = window.localStorage.getItem("glyph.dev.update-preview");

  if (previewStatus === "available") {
    return {
      status: "available",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: null,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloading") {
    return {
      status: "downloading",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: null,
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: 68,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "downloaded") {
    return {
      status: "downloaded",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      downloadedVersion: "0.2.0",
      recentlyInstalledVersion: null,
      releasePageUrl: null,
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: 100,
      checkedAt: null,
      errorMessage: null,
    };
  }

  if (previewStatus === "installed") {
    return {
      status: "not-available",
      currentVersion: "0.2.0",
      availableVersion: null,
      downloadedVersion: null,
      recentlyInstalledVersion: "0.2.0",
      releasePageUrl: null,
      releaseName: null,
      releaseNotes: null,
      progressPercent: null,
      checkedAt: null,
      errorMessage: null,
    };
  }

  return null;
};

const DEFAULT_SELECTION_SNAPSHOT: SelectionSnapshot = {
  from: 1,
  to: 1,
};

const EMPTY_FIND_PANEL_STATE: FindPanelState = {
  activeIndex: -1,
  matchCount: 0,
};

const extractLinkAttributes = (input: string) => {
  const match = input.match(/(.+?)\s+"([^"]+)"$/);
  if (match) {
    return { href: match[1].trim(), title: match[2] };
  }

  return { href: input.trim(), title: undefined };
};

const normalizeLinkTarget = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-z]+:/i.test(trimmed) && !/^(https?:\/\/|file:\/\/|glyph-local:\/\/)/i.test(trimmed)) {
    return "";
  }

  if (/^(https?:\/\/|file:\/\/|glyph-local:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

const isSafeLocalLinkTarget = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("#")) {
    return true;
  }

  if (WINDOWS_DRIVE_PATH_PATTERN.test(trimmed)) {
    return true;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return false;
  }

  const [pathPart] = trimmed.split(/[?#]/, 1);
  if (!pathPart || pathPart.startsWith("//")) {
    return false;
  }

  return pathPart.includes("/") || pathPart.startsWith(".");
};

const isExternalLink = (href: string) => {
  const trimmed = href.trim();
  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function collectEditorOutline(editor: Editor): EditorOutlineItem[] {
  const items: EditorOutlineItem[] = [];
  const counts = new Map<string, number>();

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") {
      return;
    }

    const level = Number(node.attrs.level ?? 0);
    if (level < 1 || level > 4) {
      return;
    }

    const title = node.textContent.trim();
    if (!title) {
      return;
    }

    const baseId = createHeadingId(title);
    const instanceCount = counts.get(baseId) ?? 0;
    counts.set(baseId, instanceCount + 1);

    const textBeforeHeading = editor.state.doc.textBetween(0, pos, "\n");
    const line = textBeforeHeading ? textBeforeHeading.split("\n").length + 1 : 1;

    items.push({
      id: instanceCount === 0 ? baseId : `${baseId}-${instanceCount + 1}`,
      depth: level,
      title,
      line,
      pos: pos + 1,
    });
  });

  return items;
}

function getSelectedEditorText(editor: Editor) {
  const { from, to } = editor.state.selection;
  if (from === to) {
    return "";
  }

  return editor.state.doc.textBetween(from, to, " ", " ").trim();
}

const INACTIVE_TABLE_CONTROLS: TableControlsState = {
  active: false,
  canDeleteRow: false,
  canDeleteColumn: false,
  canDeleteTable: false,
};

const runMarkdownShortcutConversion = (
  nextEditor: Editor,
  isAutoConvertingRef: MutableRefObject<boolean>,
) => {
  if (isAutoConvertingRef.current || !nextEditor.state.selection.empty) {
    return false;
  }

  const { $from } = nextEditor.state.selection;
  const blockStart = $from.start();
  const blockText = $from.parent.textContent;

  const linkImageMatch = blockText.match(LINK_IMAGE_PATTERN);
  if (!linkImageMatch) {
    return false;
  }

  const [, bang, label, rawHref] = linkImageMatch;
  const { href: rawTarget, title } = extractLinkAttributes(rawHref);
  const href = normalizeLinkTarget(rawTarget);
  if (!href) {
    return false;
  }

  const from = blockStart + blockText.length - linkImageMatch[0].length;
  const to = blockStart + blockText.length;

  isAutoConvertingRef.current = true;
  const chain = nextEditor.chain().focus().deleteRange({ from, to });

  if (bang === "!") {
    chain.setImage({
      src: href,
      alt: label,
      title: title ?? undefined,
    });
  } else {
    chain.insertContent([
      {
        type: "text",
        text: label,
        marks: [
          {
            type: "link",
            attrs: {
              href,
              title,
            },
          },
        ],
      },
    ]);
  }

  chain.run();
  isAutoConvertingRef.current = false;
  return true;
};

export const MarkdownEditor = ({
  content,
  fileName,
  filePath,
  isEditable = true,
  initialScrollTop = 0,
  scrollRestorationKey = null,
  editorFocusRequest,
  findRequest,
  showToolbar = true,
  saveStateLabel,
  footerMetaLabel,
  wordCount,
  readingTime,
  onChange,
  onToggleSidebar,
  isSidebarCollapsed,
  headerAccessory,
  subheaderContent,
  topContent,
  onCreateNote,
  toggleSidebarShortcut,
  newNoteShortcut,
  onOpenSettings,
  onOpenCommandPalette,
  onOpenLinkedFile,
  commandPaletteShortcut,
  commandPaletteLabel,
  onNavigateBack,
  onNavigateForward,
  navigateBackShortcut,
  navigateForwardShortcut,
  canGoBack,
  canGoForward,
  autoOpenPDFSetting,
  isActiveFilePinned,
  onOutlineJumpHandled,
  updateState,
  updatesMode,
  onUpdateAction,
  onDismissUpdateAction,
  dismissedUpdateVersion,
  isFocusMode,
  showOutline = true,
  onToggleFocusMode,
  focusModeShortcut,
  zoomInShortcut,
  zoomOutShortcut,
  zoomResetShortcut,
  onTogglePinnedFile,
  onEditorScaleChange,
  onScrollPositionChange,
  folderRevealLabel,
  documentLabel = "note",
  outlineJumpRequest,
  editorScale = 100,
}: MarkdownEditorProps) => {
  const lastSyncedMarkdown = useRef(content);
  const onChangeRef = useRef(onChange);
  const onScrollPositionChangeRef = useRef(onScrollPositionChange);
  const filePathRef = useRef(filePath);
  const scrollRestorationKeyRef = useRef(scrollRestorationKey);
  const onOpenLinkedFileRef = useRef(onOpenLinkedFile);
  const isAutoConvertingRef = useRef(false);
  const liveEditorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const tableControlsRef = useRef<TableControlsState>(INACTIVE_TABLE_CONTROLS);
  const toastTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hoveredLinkHideTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hoveredLinkRequestNonceRef = useRef(0);
  const scrollPositionTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const selectionSnapshotRef = useRef<SelectionSnapshot>(DEFAULT_SELECTION_SNAPSHOT);
  const selectionSnapshotsByDocumentRef = useRef<Record<string, SelectionSnapshot>>({});
  const lastHandledFocusRequestRef = useRef<number | null>(null);
  const lastHandledFindRequestRef = useRef<number | null>(null);
  const isFindOpenRef = useRef(false);
  const lastRestoredScrollStateRef = useRef<{
    key: string | null;
    top: number;
  }>({
    key: null,
    top: -1,
  });
  const [toast, setToast] = useState<MarkdownEditorToast | null>(null);
  const [activeDialog, setActiveDialog] = useState<EditorActionType | null>(null);
  const [imageControls, setImageControls] = useState<ImageControlsState | null>(null);
  const [hoveredLink, setHoveredLink] = useState<HoveredLinkState | null>(null);
  const [tableControls, setTableControls] = useState<TableControlsState>(INACTIVE_TABLE_CONTROLS);
  const [devPreviewUpdateState] = useState<UpdateState | null>(() => getDevPreviewUpdateState());
  const [outlineItems, setOutlineItems] = useState<EditorOutlineItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const deferredFindQuery = useDeferredValue(findQuery);
  const [findPanelState, setFindPanelState] = useState<FindPanelState>(EMPTY_FIND_PANEL_STATE);
  const outlineItemsRef = useRef<EditorOutlineItem[]>([]);

  useEffect(() => {
    onChangeRef.current = onChange;
    onScrollPositionChangeRef.current = onScrollPositionChange;
    filePathRef.current = filePath;
    scrollRestorationKeyRef.current = scrollRestorationKey;
    onOpenLinkedFileRef.current = onOpenLinkedFile;
  }, [filePath, onChange, onOpenLinkedFile, onScrollPositionChange, scrollRestorationKey]);

  useEffect(() => {
    isFindOpenRef.current = isFindOpen;
  }, [isFindOpen]);

  const refreshOutline = useCallback((nextEditor: Editor) => {
    const items = collectEditorOutline(nextEditor);
    setOutlineItems(items);
    outlineItemsRef.current = items;
  }, []);

  const flushScrollPosition = useCallback(() => {
    if (!scrollContainerRef.current || !onScrollPositionChangeRef.current) {
      return;
    }

    onScrollPositionChangeRef.current(scrollRestorationKey, scrollContainerRef.current.scrollTop);
  }, [scrollRestorationKey]);

  const rememberSelectionSnapshot = useCallback((nextSelection: SelectionSnapshot) => {
    selectionSnapshotRef.current = nextSelection;

    const targetKey = scrollRestorationKeyRef.current ?? filePathRef.current;
    if (targetKey) {
      selectionSnapshotsByDocumentRef.current[targetKey] = nextSelection;
    }
  }, []);

  const focusEditorWithoutScroll = useCallback(
    (selection: SelectionSnapshot, resetScrollTop: boolean) => {
      const nextEditor = liveEditorRef.current;
      if (!nextEditor) {
        return;
      }

      const maxPosition = Math.max(1, nextEditor.state.doc.content.size);
      const nextSelection = {
        from: clamp(selection.from, 1, maxPosition),
        to: clamp(selection.to, 1, maxPosition),
      };

      rememberSelectionSnapshot(nextSelection);
      nextEditor.view.dispatch(
        nextEditor.state.tr.setSelection(
          TextSelection.create(nextEditor.state.doc, nextSelection.from, nextSelection.to),
        ),
      );
      nextEditor.view.dom.focus({ preventScroll: true });

      if (resetScrollTop && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    },
    [rememberSelectionSnapshot],
  );

  const scrollToFindMatch = useCallback(
    (nextEditor: Editor, match: { from: number; to: number }) => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }

      const startCoords = nextEditor.view.coordsAtPos(match.from);
      const endCoords = nextEditor.view.coordsAtPos(Math.max(match.from, match.to - 1));
      const containerRect = container.getBoundingClientRect();
      const matchTop = Math.min(startCoords.top, endCoords.top);
      const matchBottom = Math.max(startCoords.bottom, endCoords.bottom);
      const visibleTop = containerRect.top + 92;
      const visibleBottom = containerRect.bottom - 48;

      if (matchTop >= visibleTop && matchBottom <= visibleBottom) {
        return;
      }

      const targetScrollTop = container.scrollTop + (matchTop - containerRect.top) - 88;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
    },
    [],
  );

  const syncFindPanelState = useCallback(
    (nextEditor: Editor, options?: { scrollToActive?: boolean }) => {
      const nextState = getFindHighlightState(nextEditor);
      setFindPanelState({
        activeIndex: nextState.activeIndex,
        matchCount: nextState.matches.length,
      });

      if (!options?.scrollToActive || nextState.activeIndex < 0) {
        return;
      }

      const activeMatch = nextState.matches[nextState.activeIndex];
      if (activeMatch) {
        scrollToFindMatch(nextEditor, activeMatch);
      }
    },
    [scrollToFindMatch],
  );

  const closeFindPanel = useCallback(() => {
    setIsFindOpen(false);
    setFindQuery("");
    setFindPanelState(EMPTY_FIND_PANEL_STATE);

    const nextEditor = liveEditorRef.current;
    if (nextEditor) {
      setFindHighlightQuery(nextEditor, "");
    }

    window.requestAnimationFrame(() => {
      focusEditorWithoutScroll(selectionSnapshotRef.current, false);
    });
  }, [focusEditorWithoutScroll]);

  const openFindPanel = useCallback((initialQuery: string) => {
    setIsFindOpen(true);
    setFindQuery(initialQuery);

    window.requestAnimationFrame(() => {
      const input = findInputRef.current;
      if (!input) {
        return;
      }

      input.focus();
      input.select();
    });
  }, []);

  const navigateFindMatches = useCallback(
    (direction: 1 | -1) => {
      const nextEditor = liveEditorRef.current;
      if (!nextEditor) {
        return;
      }

      const currentState = getFindHighlightState(nextEditor);
      if (currentState.matches.length === 0) {
        return;
      }

      const baseIndex = currentState.activeIndex >= 0 ? currentState.activeIndex : 0;
      const nextIndex =
        (baseIndex + direction + currentState.matches.length) % currentState.matches.length;

      setActiveFindHighlightMatch(nextEditor, nextIndex);
      syncFindPanelState(nextEditor, { scrollToActive: true });
    },
    [syncFindPanelState],
  );

  const effectiveUpdateState = devPreviewUpdateState ?? updateState ?? null;
  const updateStateFlags = useUpdateStateFlags(
    effectiveUpdateState,
    updatesMode,
    dismissedUpdateVersion,
  );
  const isFocusLayout = Boolean(isFocusMode);
  const revealInFolderLabel = folderRevealLabel ?? getFolderRevealLabel(navigator.platform);
  const isMacLike = useMemo(() => navigator.platform.includes("Mac"), []);
  const linkOpenShortcutHint = isMacLike ? "Open link (Cmd+Click)" : "Open link (Ctrl+Click)";
  const headerPaddingClass =
    (isSidebarCollapsed || isFocusLayout) && isMacLike ? "pl-20 pr-4" : "px-4";
  const shouldShowOutlineRail = !isFocusLayout && showOutline;
  const shouldShowCommandPalette = Boolean(onOpenCommandPalette);
  const _modeButtonsVisible = Boolean(onToggleFocusMode);
  const normalizedDocumentLabel = documentLabel.trim() || "note";

  const editorSurfaceClassName = useMemo(
    () =>
      [
        "tiptap-editor mx-auto max-w-[800px] px-10 py-5 pb-32 text-[15px] leading-[1.7] text-foreground outline-none",
        "[&>p]:mb-4",
        "[&>ul]:mb-4 [&>ol]:mb-4 [&>blockquote]:mb-4 [&>hr]:my-8",
        "[&>pre]:mb-4 [&>pre]:rounded-lg [&>pre]:overflow-auto",
        "[&>h1]:mt-10 [&>h1]:mb-3 [&>h1]:text-3xl [&>h1]:font-semibold [&>h1]:leading-tight",
        "[&>h2]:mt-8 [&>h2]:mb-3 [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:leading-tight",
        "[&>h3]:mt-7 [&>h3]:mb-2 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:leading-tight",
        "[&>h4]:mt-6 [&>h4]:mb-2 [&>h4]:text-lg [&>h4]:font-semibold [&>h4]:leading-tight",
        "[&>ul]:list-disc [&>ol]:list-decimal [&>ul]:pl-6 [&>ol]:pl-6",
        "[&>ul[data-type='taskList']]:list-none [&>ul[data-type='taskList']]:pl-0",
        "[&>ul[data-type='taskList']_li]:flex [&>ul[data-type='taskList']_li]:gap-2.5 [&>ul[data-type='taskList']_li]:items-start",
        "[&>ul[data-type='taskList']_li>label]:inline-flex [&>ul[data-type='taskList']_li>label]:items-center [&>ul[data-type='taskList']_li>label]:mt-0.5 [&>ul[data-type='taskList']_li>label]:shrink-0 [&>ul[data-type='taskList']_li>label]:cursor-pointer",
        "[&>ul[data-type='taskList']_li>label>input]:mt-0.5 [&>ul[data-type='taskList']_li>label>input]:cursor-pointer",
        "[&>ul[data-type='taskList']_li>div]:flex-1",
        "[&>blockquote]:pl-4 [&>blockquote]:border-l-2 [&>blockquote]:border-border [&>blockquote]:text-muted-foreground",
        "[&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-muted [&_code]:font-mono [&_code]:text-[0.875em]",
        "[&>pre]:mb-4 [&>pre]:rounded-lg [&>pre]:overflow-auto",
        "[&>pre_code]:p-0 [&>pre_code]:bg-transparent [&>pre_code]:color-inherit",
        "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:cursor-pointer",
        "[&_.tableWrapper]:my-5 [&_.tableWrapper]:overflow-x-auto",
        "[&_.tableWrapper_table]:w-full [&_.tableWrapper_table]:border-collapse [&_.tableWrapper_table]:border-spacing-0 [&_.tableWrapper_table]:min-w-[440px]",
        "[&_.tableWrapper_th]:bg-muted [&_.tableWrapper_th]:font-semibold",
        "[&_.tableWrapper_th]:border [&_.tableWrapper_th]:border-border [&_.tableWrapper_th]:px-3 [&_.tableWrapper_th]:py-2 [&_.tableWrapper_th]:align-top",
        "[&_.tableWrapper_td]:border [&_.tableWrapper_td]:border-border [&_.tableWrapper_td]:px-3 [&_.tableWrapper_td]:py-2 [&_.tableWrapper_td]:align-top",
        "[&>img]:max-w-full [&>img]:h-auto [&>img]:rounded-xl",
      ]
        .filter(Boolean)
        .join(" "),
    [],
  );

  const showToast = useCallback((title: string, description: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ title, description });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleJumpToHeading = useCallback((item: EditorOutlineItem) => {
    const nextEditor = liveEditorRef.current;
    if (!nextEditor) {
      return;
    }

    const nodeDom = nextEditor.view.nodeDOM(item.pos - 1);
    const container = scrollContainerRef.current;
    let targetScrollTop: number | null = null;

    if (nodeDom instanceof HTMLElement && container) {
      const containerRect = container.getBoundingClientRect();
      const nodeRect = nodeDom.getBoundingClientRect();

      targetScrollTop = container.scrollTop + (nodeRect.top - containerRect.top) - 40;
    } else {
      const containerRect = container?.getBoundingClientRect();
      const coords = nextEditor.view.coordsAtPos(item.pos);

      if (container && containerRect) {
        targetScrollTop = container.scrollTop + (coords.top - containerRect.top) - 40;
      }
    }

    const selection = TextSelection.create(nextEditor.state.doc, item.pos);
    nextEditor.view.dispatch(nextEditor.state.tr.setSelection(selection));
    nextEditor.view.dom.focus({
      preventScroll: true,
    });

    if (container && targetScrollTop !== null) {
      window.requestAnimationFrame(() => {
        container.scrollTo({
          top: Math.max(0, targetScrollTop ?? 0),
          behavior: "smooth",
        });
      });
    }
  }, []);

  const handleScrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const clearHoveredLinkHideTimeout = () => {
    if (!hoveredLinkHideTimeoutRef.current) {
      return;
    }

    window.clearTimeout(hoveredLinkHideTimeoutRef.current);
    hoveredLinkHideTimeoutRef.current = null;
  };

  const scheduleHoveredLinkHide = () => {
    clearHoveredLinkHideTimeout();
    hoveredLinkHideTimeoutRef.current = window.setTimeout(() => {
      hoveredLinkRequestNonceRef.current += 1;
      setHoveredLink(null);
      hoveredLinkHideTimeoutRef.current = null;
    }, 140);
  };

  const openLinkExternally = (href: string) => {
    if (window.glyph) {
      void window.glyph.openExternal(href).catch((error: unknown) => {
        showToast("Could not open link", error instanceof Error ? error.message : "Unknown error");
      });
      return true;
    }

    window.open(href, "_blank", "noopener,noreferrer");
    return true;
  };

  const handleLinkActivation = async (href: string) => {
    try {
      if (!window.glyph) {
        return openLinkExternally(href);
      }

      const resolved = await window.glyph.resolveLinkTarget(filePathRef.current, href);
      if (!resolved) {
        showToast("Could not open link", "Link target could not be resolved.");
        return false;
      }

      if (resolved.kind === "markdown-file") {
        if (onOpenLinkedFileRef.current) {
          onOpenLinkedFileRef.current(resolved.target);
          return true;
        }

        return openLinkExternally(resolved.target);
      }

      return openLinkExternally(resolved.target);
    } catch (error) {
      showToast("Could not open link", error instanceof Error ? error.message : "Unknown error");
      return false;
    }
  };

  const refreshImageControls = (nextEditor: Editor) => {
    if (!nextEditor.isActive("image")) {
      setImageControls(null);
      return;
    }

    const nodeDom = nextEditor.view.nodeDOM(nextEditor.state.selection.from);
    const imageElement =
      nodeDom instanceof HTMLImageElement
        ? nodeDom
        : nodeDom instanceof HTMLElement
          ? nodeDom.querySelector("img")
          : null;

    if (!imageElement) {
      setImageControls(null);
      return;
    }

    const rect = imageElement.getBoundingClientRect();
    setImageControls((current) => {
      const nextState = {
        left: rect.right - 34,
        top: rect.top + 10,
      };

      if (current && current.left === nextState.left && current.top === nextState.top) {
        return current;
      }

      return nextState;
    });
  };

  const refreshTableControls = (nextEditor: Editor) => {
    const selectionIncludesTable = [
      nextEditor.state.selection.$anchor,
      nextEditor.state.selection.$head,
    ].some(($position) => {
      for (let depth = $position.depth; depth >= 0; depth -= 1) {
        const nodeName = $position.node(depth).type.name;
        if (
          nodeName === "table" ||
          nodeName === "tableRow" ||
          nodeName === "tableCell" ||
          nodeName === "tableHeader"
        ) {
          return true;
        }
      }

      return false;
    });

    if (
      !nextEditor.isFocused ||
      !selectionIncludesTable ||
      (!nextEditor.isActive("table") &&
        !nextEditor.isActive("tableCell") &&
        !nextEditor.isActive("tableHeader"))
    ) {
      const currentState = tableControlsRef.current;
      if (!currentState.active) {
        return;
      }

      tableControlsRef.current = INACTIVE_TABLE_CONTROLS;
      setTableControls(INACTIVE_TABLE_CONTROLS);
      return;
    }

    const nextState = {
      active: true,
      canDeleteRow: nextEditor.can().deleteRow(),
      canDeleteColumn: nextEditor.can().deleteColumn(),
      canDeleteTable: nextEditor.can().deleteTable(),
    };

    const currentState = tableControlsRef.current;
    if (
      currentState.active === nextState.active &&
      currentState.canDeleteRow === nextState.canDeleteRow &&
      currentState.canDeleteColumn === nextState.canDeleteColumn &&
      currentState.canDeleteTable === nextState.canDeleteTable
    ) {
      return;
    }

    tableControlsRef.current = nextState;
    setTableControls(nextState);
  };

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4],
          },
          codeBlock: false,
          link: false,
        }),
        MarkdownShortcuts,
        CustomCodeBlockLowlight,
        Link.configure({
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url, ctx) => ctx.defaultValidate(url) || isSafeLocalLinkTarget(url),
          linkOnPaste: true,
          openOnClick: false,
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        }),
        Image.configure({
          resize: {
            enabled: true,
          },
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        SlashCommand,
        FindHighlightExtension,
        Placeholder.configure({
          placeholder: "Start with a title, then let markdown shortcuts shape the page.",
        }),
        Markdown.configure({
          linkify: true,
          transformPastedText: true,
          transformCopiedText: true,
          breaks: true,
        }),
      ],
      enableInputRules: true,
      enablePasteRules: true,
      content: content,
      editorProps: {
        attributes: {
          class: editorSurfaceClassName,
          "data-glyph-editor": "true",
          spellcheck: "true",
        },
        handleClick: (_view, _pos, event) => {
          const target = event.target;
          const link = target instanceof HTMLElement ? target.closest("a") : null;

          if (!link) {
            return false;
          }

          const href = link.getAttribute("href");
          if (!href) {
            return false;
          }

          if (!event.metaKey && !event.ctrlKey) {
            return false;
          }

          event.preventDefault();
          event.stopPropagation();

          void handleLinkActivation(href);

          return true;
        },
        handleDOMEvents: {
          mouseover: (_view, event) => {
            const target = event.target;
            const link = target instanceof HTMLElement ? target.closest("a") : null;

            if (!link) {
              return false;
            }

            const href = link.getAttribute("href");
            if (!href) {
              return false;
            }

            clearHoveredLinkHideTimeout();
            const rect = link.getBoundingClientRect();
            const placement = rect.bottom > window.innerHeight * 0.64 ? "above" : "below";
            const tooltipTop = placement === "above" ? rect.top - 12 : rect.bottom + 12;
            const tooltipLeft = clamp(rect.left + rect.width / 2, 96, window.innerWidth - 96);

            // For external links (http(s), mailto), show a simple hint immediately
            // without fetching a rich preview — only note links get the full card.
            if (isExternalLink(href)) {
              hoveredLinkRequestNonceRef.current += 1;
              setHoveredLink({
                href,
                placement,
                preview: null,
                status: "hint",
                tooltipLeft,
                tooltipTop,
              });
              return false;
            }

            const requestNonce = hoveredLinkRequestNonceRef.current + 1;
            hoveredLinkRequestNonceRef.current = requestNonce;

            setHoveredLink({
              href,
              placement,
              preview: null,
              status: "loading",
              tooltipLeft,
              tooltipTop,
            });

            if (!window.glyph) {
              setHoveredLink((current) =>
                current?.href === href
                  ? {
                      ...current,
                      preview: null,
                      status: "hint",
                    }
                  : current,
              );
              return false;
            }

            void window.glyph
              .getLinkPreview(filePathRef.current, href)
              .then((preview) => {
                if (requestNonce !== hoveredLinkRequestNonceRef.current) {
                  return;
                }

                setHoveredLink((current) =>
                  current?.href === href
                    ? {
                        ...current,
                        preview,
                        status: preview ? "preview" : "hint",
                      }
                    : current,
                );
              })
              .catch(() => {
                if (requestNonce !== hoveredLinkRequestNonceRef.current) {
                  return;
                }

                setHoveredLink((current) =>
                  current?.href === href
                    ? {
                        ...current,
                        preview: null,
                        status: "hint",
                      }
                    : current,
                );
              });
            return false;
          },
          mouseout: (_view, _event) => {
            scheduleHoveredLinkHide();
            return false;
          },
          blur: () => {
            tableControlsRef.current = INACTIVE_TABLE_CONTROLS;
            setTableControls(INACTIVE_TABLE_CONTROLS);
            return false;
          },
          scroll: () => {
            setImageControls(null);
            hoveredLinkRequestNonceRef.current += 1;
            clearHoveredLinkHideTimeout();
            setHoveredLink(null);
            return false;
          },
        },
      },
      onUpdate: ({ editor: nextEditor }) => {
        liveEditorRef.current = nextEditor;
        if (runMarkdownShortcutConversion(nextEditor, isAutoConvertingRef)) {
          return;
        }

        rememberSelectionSnapshot({
          from: nextEditor.state.selection.from,
          to: nextEditor.state.selection.to,
        });
        refreshTableControls(nextEditor);
        refreshImageControls(nextEditor);
        refreshOutline(nextEditor);
        if (isFindOpenRef.current) {
          syncFindPanelState(nextEditor);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        const nextMarkdown = (nextEditor.storage as any).markdown.getMarkdown() as string;
        lastSyncedMarkdown.current = nextMarkdown;
        onChangeRef.current(nextMarkdown);
      },
      onSelectionUpdate: ({ editor: nextEditor }) => {
        liveEditorRef.current = nextEditor;
        rememberSelectionSnapshot({
          from: nextEditor.state.selection.from,
          to: nextEditor.state.selection.to,
        });
        refreshTableControls(nextEditor);
        refreshImageControls(nextEditor);
        if (isFindOpenRef.current) {
          syncFindPanelState(nextEditor);
        }
      },
    },
    [rememberSelectionSnapshot, syncFindPanelState],
  );

  useEffect(() => {
    if (!editor || content === lastSyncedMarkdown.current) {
      return;
    }

    liveEditorRef.current = editor;
    editor.commands.setContent(content, {
      emitUpdate: false,
    });
    lastSyncedMarkdown.current = content;
    refreshTableControls(editor);
    refreshImageControls(editor);
    refreshOutline(editor);
    if (isFindOpenRef.current) {
      syncFindPanelState(editor);
    }
  }, [content, editor, refreshOutline, syncFindPanelState]);

  useEffect(() => {
    const targetKey = scrollRestorationKey ?? filePath;

    selectionSnapshotRef.current = targetKey
      ? (selectionSnapshotsByDocumentRef.current[targetKey] ?? DEFAULT_SELECTION_SNAPSHOT)
      : DEFAULT_SELECTION_SNAPSHOT;
  }, [filePath, scrollRestorationKey]);

  useEffect(() => {
    if (!editor || !scrollContainerRef.current || !scrollRestorationKey) {
      return;
    }

    const normalizedScrollTop = Math.max(0, initialScrollTop ?? 0);
    const lastRestoredScrollState = lastRestoredScrollStateRef.current;
    if (
      lastRestoredScrollState.key === scrollRestorationKey &&
      lastRestoredScrollState.top === normalizedScrollTop
    ) {
      return;
    }

    lastRestoredScrollStateRef.current = {
      key: scrollRestorationKey,
      top: normalizedScrollTop,
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!scrollContainerRef.current) {
          return;
        }

        scrollContainerRef.current.scrollTop = normalizedScrollTop;
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [editor, initialScrollTop, scrollRestorationKey]);

  useEffect(() => {
    return () => {
      flushScrollPosition();
    };
  }, [flushScrollPosition, scrollRestorationKey]);

  useEffect(() => {
    const flushPendingScrollPosition = () => {
      if (scrollPositionTimeoutRef.current) {
        window.clearTimeout(scrollPositionTimeoutRef.current);
        scrollPositionTimeoutRef.current = null;
      }

      flushScrollPosition();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingScrollPosition();
      }
    };

    window.addEventListener("pagehide", flushPendingScrollPosition);
    window.addEventListener("beforeunload", flushPendingScrollPosition);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushPendingScrollPosition);
      window.removeEventListener("beforeunload", flushPendingScrollPosition);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushScrollPosition]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    liveEditorRef.current = editor;
    editor.setEditable(isEditable);
  }, [editor, isEditable]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (!isFindOpen) {
      setFindHighlightQuery(editor, "");
      setFindPanelState(EMPTY_FIND_PANEL_STATE);
      return;
    }

    setFindHighlightQuery(editor, deferredFindQuery);
    syncFindPanelState(editor, {
      scrollToActive: Boolean(deferredFindQuery.trim()),
    });
  }, [editor, deferredFindQuery, isFindOpen, syncFindPanelState]);

  useEffect(() => {
    if (!findRequest || !editor) {
      return;
    }

    if (lastHandledFindRequestRef.current === findRequest.nonce) {
      return;
    }

    lastHandledFindRequestRef.current = findRequest.nonce;
    const selectedText = getSelectedEditorText(editor).replace(/\s+/g, " ").trim();
    const initialQuery = selectedText && selectedText.length <= 120 ? selectedText : findQuery;

    openFindPanel(initialQuery);
  }, [editor, findQuery, findRequest, openFindPanel]);

  useEffect(() => {
    if (!editorFocusRequest || !editor) {
      return;
    }

    if (lastHandledFocusRequestRef.current === editorFocusRequest.nonce) {
      return;
    }

    lastHandledFocusRequestRef.current = editorFocusRequest.nonce;

    window.requestAnimationFrame(() => {
      if (editorFocusRequest.mode === "start") {
        focusEditorWithoutScroll({ from: 1, to: 1 }, true);
        return;
      }

      if (editorFocusRequest.mode === "end") {
        const endPosition = Math.max(1, editor.state.doc.content.size);
        focusEditorWithoutScroll({ from: endPosition, to: endPosition }, true);
        return;
      }

      focusEditorWithoutScroll(selectionSnapshotRef.current, false);
    });
  }, [editor, editorFocusRequest, focusEditorWithoutScroll]);

  useEffect(() => {
    if (!outlineJumpRequest || !editor) {
      return;
    }

    const target = collectEditorOutline(editor).find((item) => item.id === outlineJumpRequest.id);
    if (target) {
      handleJumpToHeading(target);
    }

    onOutlineJumpHandled?.();
  }, [editor, handleJumpToHeading, onOutlineJumpHandled, outlineJumpRequest]);

  useEffect(() => {
    return () => {
      clearHoveredLinkHideTimeout();
      if (scrollPositionTimeoutRef.current) {
        window.clearTimeout(scrollPositionTimeoutRef.current);
      }
      flushScrollPosition();
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [flushScrollPosition]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleEditorAction = (event: Event) => {
      const detail = (event as CustomEvent<EditorActionDetail>).detail;
      if (!detail) {
        return;
      }

      switch (detail.type) {
        case "insert-table":
          setActiveDialog("insert-table");
          break;
        case "insert-link": {
          setActiveDialog("insert-link");
          break;
        }
        case "insert-image":
          setActiveDialog("insert-image");
          break;
      }
    };

    window.addEventListener("glyph:editor-action", handleEditorAction as EventListener);
    return () => {
      window.removeEventListener("glyph:editor-action", handleEditorAction as EventListener);
    };
  }, [editor]);

  const [_imageFormState, setImageFormState] = useState<{
    alt: string;
    src: string;
    _nonce: number;
  } | null>(null);

  // Tracks the dialog nonce at the moment the image picker is launched so the
  // result can be tagged and matched against the live dialog session.
  const imagePickNonceRef = useRef(0);

  useEffect(() => {
    if (activeDialog === "insert-image") {
      imagePickNonceRef.current += 1;
    }
  }, [activeDialog]);

  const handlePickImageFile = async () => {
    if (!window.glyph) {
      showToast("Picker unavailable", "Glyph API not available");
      return;
    }

    // Capture the nonce at the moment the picker is initiated so the result
    // can be matched against the session that was active when picking started.
    const pickNonce = imagePickNonceRef.current;

    const asset = await window.glyph.pickAsset("image");
    if (!asset) {
      return;
    }

    const baseName = asset.name.replace(/\.[^.]+$/, "");
    setImageFormState({
      alt: baseName || "Image",
      src: asset.url,
      _nonce: pickNonce,
    });
  };

  const handleDeleteSelectedImage = useCallback(() => {
    if (!editor?.isActive("image")) {
      return;
    }

    editor.chain().focus().deleteSelection().run();
    setImageControls(null);
    showToast("Image removed", "");
  }, [editor, showToast]);

  const handleCopyPath = async () => {
    if (filePath) {
      try {
        await navigator.clipboard.writeText(filePath);
        showToast(`${normalizedDocumentLabel} path copied`, "");
      } catch (err) {
        console.error("Failed to copy path:", err);
        showToast(`Could not copy ${normalizedDocumentLabel} path`, "");
      }
    }
  };

  const handleCopy = async () => {
    if (content) {
      try {
        await navigator.clipboard.writeText(content);
        showToast("Copied as Markdown", "");
      } catch (err) {
        console.error("Failed to copy content:", err);
        showToast("Failed to copy content", "");
      }
    }
  };

  const handleOpenExternal = async () => {
    if (filePath && window.glyph) {
      try {
        const didReveal = await window.glyph.revealInFinder(filePath);
        if (!didReveal) {
          showToast(`Could not reveal ${normalizedDocumentLabel}`, "");
        }
      } catch (err) {
        console.error(`Failed to reveal ${normalizedDocumentLabel}:`, err);
        showToast(`Could not reveal ${normalizedDocumentLabel}`, "");
      }
    }
  };

  const handleExportPDF = async () => {
    if (!editor || !fileName) {
      showToast("Could not export PDF", "No file name available");
      return;
    }

    try {
      // Get markdown content from editor using the Markdown extension
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor as any).storage.markdown.getMarkdown?.() || editor.getHTML();
      const filename = fileName.replace(MARKDOWN_FILE_SUFFIX_PATTERN, ".pdf");

      if (window.glyph) {
        const absolutePath = await window.glyph.exportMarkdownToPDF(markdown, filename);
        showToast("PDF exported successfully", `Saved as ${filename}`);

        // Auto-open PDF if setting is enabled
        if (autoOpenPDFSetting && absolutePath) {
          await window.glyph.openExternal(absolutePath);
        }
      } else {
        showToast("Failed to export PDF", "Glyph API not available");
      }
    } catch (err) {
      console.error("Failed to export PDF:", err);
      showToast("Failed to export PDF", err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <section className="relative h-full min-h-0 flex flex-col bg-background">
      {showToolbar ? (
        <EditorToolbar
          _isMacLike={isMacLike}
          isSidebarCollapsed={isSidebarCollapsed}
          toggleSidebarShortcut={toggleSidebarShortcut}
          onToggleSidebar={onToggleSidebar}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          navigateBackShortcut={navigateBackShortcut}
          navigateForwardShortcut={navigateForwardShortcut}
          onNavigateBack={onNavigateBack}
          onNavigateForward={onNavigateForward}
          onCreateNote={onCreateNote}
          newNoteShortcut={newNoteShortcut}
          fileName={fileName}
          filePath={filePath}
          shouldShowCommandPalette={shouldShowCommandPalette}
          onOpenCommandPalette={onOpenCommandPalette}
          commandPaletteShortcut={commandPaletteShortcut}
          commandPaletteLabel={commandPaletteLabel}
          isFocusMode={isFocusLayout}
          onToggleFocusMode={onToggleFocusMode}
          focusModeShortcut={focusModeShortcut}
          shouldShowUpdateActionButton={updateStateFlags.shouldShowUpdateActionButton}
          updateButtonVariant={updateStateFlags.updateButtonVariant}
          isUpdateButtonDisabled={updateStateFlags.isUpdateButtonDisabled}
          updateButtonLabel={updateStateFlags.updateButtonLabel}
          updateButtonTooltip={updateStateFlags.updateButtonTooltip}
          onUpdateAction={onUpdateAction}
          onDismissUpdateAction={onDismissUpdateAction}
          isManualReleaseButton={updateStateFlags.isManualReleaseButton}
          headerPaddingClass={headerPaddingClass}
          onOpenSettings={onOpenSettings}
          headerAccessory={headerAccessory}
          content={content}
          documentLabel={normalizedDocumentLabel}
          revealInFolderLabel={revealInFolderLabel}
          onCopy={handleCopy}
          onCopyPath={handleCopyPath}
          onOpenExternal={handleOpenExternal}
          onExportPDF={handleExportPDF}
          onTogglePinnedFile={onTogglePinnedFile}
          isActiveFilePinned={isActiveFilePinned}
          editorScale={editorScale}
          onEditorScaleChange={onEditorScaleChange}
          zoomInShortcut={zoomInShortcut}
          zoomOutShortcut={zoomOutShortcut}
          zoomResetShortcut={zoomResetShortcut}
        />
      ) : null}
      {subheaderContent ? (
        <div className="border-b border-border/30">{subheaderContent}</div>
      ) : null}
      <div className="relative flex-1 min-h-0">
        <FindPanel
          isOpen={isFindOpen}
          query={findQuery}
          panelState={findPanelState}
          inputRef={findInputRef}
          shouldShowOutlineRail={shouldShowOutlineRail}
          onQueryChange={setFindQuery}
          onNavigate={navigateFindMatches}
          onClose={closeFindPanel}
        />
        <div
          ref={scrollContainerRef}
          className={`h-full overflow-y-auto relative [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
            shouldShowOutlineRail ? "xl:pr-[316px]" : ""
          }`}
          onScroll={() => {
            setImageControls(null);
            hoveredLinkRequestNonceRef.current += 1;
            clearHoveredLinkHideTimeout();
            setHoveredLink(null);

            if (!editor) return;
            const container = scrollContainerRef.current;
            if (!container) return;

            if (scrollPositionTimeoutRef.current) {
              window.clearTimeout(scrollPositionTimeoutRef.current);
            }
            scrollPositionTimeoutRef.current = window.setTimeout(() => {
              flushScrollPosition();
              scrollPositionTimeoutRef.current = null;
            }, 120);

            const headings = outlineItemsRef.current;
            if (headings.length === 0) {
              setActiveHeadingId(null);
              return;
            }

            const containerRect = container.getBoundingClientRect();
            const remainingScroll =
              container.scrollHeight - container.scrollTop - container.clientHeight;

            let activeId = headings[0].id;
            for (const heading of headings) {
              const nodeDom = editor.view.nodeDOM(heading.pos - 1);
              if (nodeDom instanceof HTMLElement) {
                const rect = nodeDom.getBoundingClientRect();
                // Add a bit more tolerance so if we jump to 40px, it comfortably highlights
                if (rect.top <= containerRect.top + 120) {
                  activeId = heading.id;
                } else {
                  break;
                }
              }
            }

            // When near the bottom of the document, activate the last heading.
            // Use a generous threshold to account for bottom padding (pb-32 = 128px),
            // sub-pixel rounding on high-DPI displays, and floating footer overlays.
            if (remainingScroll < 150) {
              activeId = headings[headings.length - 1].id;
            }

            setActiveHeadingId(activeId);
          }}
        >
          {topContent ? <div className="mx-auto max-w-[800px] px-10 pt-5">{topContent}</div> : null}
          <TableControls
            isActive={tableControls.active}
            canDeleteRow={tableControls.canDeleteRow}
            canDeleteColumn={tableControls.canDeleteColumn}
            canDeleteTable={tableControls.canDeleteTable}
            shouldShowOutlineRail={shouldShowOutlineRail}
            editor={editor}
          />
          <LinkPreview
            hoveredLink={hoveredLink!}
            linkOpenShortcutHint={linkOpenShortcutHint}
            onMouseEnter={clearHoveredLinkHideTimeout}
            onMouseLeave={scheduleHoveredLinkHide}
          />
          <ImageControls controls={imageControls} onDelete={handleDeleteSelectedImage} />
          <div
            style={{
              zoom: editorScale !== 100 ? `${editorScale}%` : undefined,
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      {shouldShowOutlineRail ? (
        <aside className="pointer-events-none absolute right-8 top-[88px] z-20 hidden xl:block w-[240px] animate-in fade-in slide-in-from-right-2 duration-200 ease-out">
          <div className="pointer-events-auto flex min-h-0 flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <OutlineIcon size={14} className="text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">On this page</p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={handleScrollToTop}
                type="button"
              >
                <ArrowUpIcon size={12} />
                Top
              </Button>
            </div>
            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {outlineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add headings to build a table of contents.
                </p>
              ) : (
                <TableOfContents
                  items={outlineItems}
                  activeId={activeHeadingId}
                  onJump={handleJumpToHeading}
                />
              )}
            </div>
          </div>
        </aside>
      ) : null}
      <EditorFooter
        wordCount={wordCount}
        readingTime={readingTime}
        footerMetaLabel={footerMetaLabel}
        saveStateLabel={saveStateLabel}
        toast={toast}
      />
      <EditorDialogs
        activeDialog={activeDialog}
        onDialogChange={setActiveDialog}
        editor={editor}
        showToast={showToast}
        onPickImageFile={handlePickImageFile}
        imageFormState={_imageFormState}
        onClearImageFormState={() => setImageFormState(null)}
      />
    </section>
  );
};
