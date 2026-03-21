import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
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
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";

import { buildBreadcrumbs, createHeadingId } from "@/lib/note-navigation";
import { getFolderRevealLabel } from "@/lib/platform";

import { CustomCodeBlockLowlight } from "./tiptap-extension/code-block-lowlight";
import { MarkdownShortcuts } from "./tiptap-extension/markdown-shortcuts";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { SlashCommand } from "./slash-command";
import {
  ArrowUpIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CopyIcon,
  DotsHorizontalIcon,
  ExternalLinkIcon,
  FileDownIcon,
  GearIcon,
  LinkIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  RevealInFolderIcon,
  SearchIcon,
  TrashIcon,
} from "./icons";

import type { MarkdownEditorProps, MarkdownEditorToast } from "../types/markdown-editor";
import type { BreadcrumbItem, OutlineItem } from "@/types/navigation";
import type { UpdateState } from "../shared/workspace";

const LINK_IMAGE_PATTERN = /(!?)\[([^\]]+)\]\(([^)]+)\)$/;
const MARKDOWN_FILE_SUFFIX_PATTERN = /\.(md|mdx|markdown)$/i;
type EditorActionType = "insert-table" | "insert-link" | "insert-image";

type EditorActionDetail = {
  type: EditorActionType;
};

type TableFormState = {
  rows: string;
  cols: string;
};

type LinkFormState = {
  text: string;
  href: string;
};

type ImageFormState = {
  alt: string;
  src: string;
};

type ImageControlsState = {
  left: number;
  top: number;
};

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
      releaseName: "Glyph 0.2.0",
      releaseNotes: null,
      progressPercent: 100,
      checkedAt: null,
      errorMessage: null,
    };
  }

  return null;
};

type HoveredLinkState = {
  href: string;
  iconLeft: number;
  iconTop: number;
  tooltipLeft: number;
  tooltipTop: number;
};

type TableControlsState = {
  active: boolean;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
  canDeleteTable: boolean;
};

type EditorOutlineItem = OutlineItem & {
  pos: number;
};

type NoteViewState = {
  scrollTop: number;
  selectionFrom: number;
  selectionTo: number;
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
  workspaceRootPath,
  breadcrumbs,
  saveStateLabel,
  wordCount,
  readingTime,
  onChange,
  onToggleSidebar,
  isSidebarCollapsed,
  onCreateNote,
  toggleSidebarShortcut,
  newNoteShortcut,
  onOpenSettings,
  onOpenCommandPalette,
  onOpenLinkedFile,
  commandPaletteShortcut,
  onNavigateBack,
  onNavigateForward,
  navigateBackShortcut,
  navigateForwardShortcut,
  canGoBack,
  canGoForward,
  autoOpenPDFSetting,
  isActiveFileFavorite,
  isActiveFilePinned,
  nextHistoryItem,
  onOutlineJumpHandled,
  onToggleFavoriteFile,
  updateState,
  onUpdateAction,
  isFocusMode,
  isReadingMode,
  onToggleFocusMode,
  onTogglePinnedFile,
  onToggleReadingMode,
  folderRevealLabel,
  outlineJumpRequest,
  previousHistoryItem,
}: MarkdownEditorProps) => {
  const lastSyncedMarkdown = useRef(content);
  const isAutoConvertingRef = useRef(false);
  const liveEditorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const noteViewStateRef = useRef(new Map<string, NoteViewState>());
  const previousFilePathRef = useRef<string | null>(filePath);
  const tableControlsRef = useRef<TableControlsState>({
    active: false,
    canDeleteRow: false,
    canDeleteColumn: false,
    canDeleteTable: false,
  });
  const toastTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hoveredLinkHideTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<MarkdownEditorToast | null>(null);
  const [activeDialog, setActiveDialog] = useState<EditorActionType | null>(null);
  const [tableForm, setTableForm] = useState<TableFormState>({
    rows: "3",
    cols: "3",
  });
  const [linkForm, setLinkForm] = useState<LinkFormState>({
    text: "",
    href: "",
  });
  const [imageForm, setImageForm] = useState<ImageFormState>({
    alt: "",
    src: "",
  });
  const [imageControls, setImageControls] = useState<ImageControlsState | null>(null);
  const [hoveredLink, setHoveredLink] = useState<HoveredLinkState | null>(null);
  const [tableControls, setTableControls] = useState<TableControlsState>({
    active: false,
    canDeleteRow: false,
    canDeleteColumn: false,
    canDeleteTable: false,
  });
  const [devPreviewUpdateState] = useState<UpdateState | null>(() => getDevPreviewUpdateState());

  const effectiveUpdateState = devPreviewUpdateState ?? updateState;

  const shouldShowUpdateButton =
    effectiveUpdateState?.status === "available" ||
    effectiveUpdateState?.status === "downloading" ||
    effectiveUpdateState?.status === "downloaded";

  const updateButtonLabel =
    effectiveUpdateState?.status === "downloaded"
      ? "Install update"
      : effectiveUpdateState?.status === "downloading"
        ? `Downloading ${Math.round(effectiveUpdateState.progressPercent ?? 0)}%`
        : "Update available";

  const isUpdateButtonDisabled = effectiveUpdateState?.status === "downloading";
  const resolvedBreadcrumbs = useMemo<BreadcrumbItem[]>(
    () => breadcrumbs ?? buildBreadcrumbs(filePath, workspaceRootPath ?? null),
    [breadcrumbs, filePath, workspaceRootPath],
  );
  const breadcrumbTrail = useMemo(
    () => resolvedBreadcrumbs.slice(0, Math.max(0, resolvedBreadcrumbs.length - 1)),
    [resolvedBreadcrumbs],
  );
  const isFocusLayout = Boolean(isFocusMode);
  const isReadingLayout = Boolean(isReadingMode);
  const revealInFolderLabel = folderRevealLabel ?? getFolderRevealLabel(navigator.platform);
  const editorSurfaceClassName = [
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
    isReadingLayout ? "text-[16px] leading-[1.85]" : "",
    isReadingLayout ? "[&>p]:mb-5" : "",
    isFocusLayout ? "max-w-[720px] px-8" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showToast = (title: string, description: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ title, description });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2000);
  };

  const handleJumpToHeading = useCallback((item: EditorOutlineItem) => {
    const nextEditor = liveEditorRef.current;
    if (!nextEditor) {
      return;
    }

    nextEditor.chain().focus().setTextSelection(item.pos).scrollIntoView().run();
  }, []);

  const storeNoteViewState = useCallback((targetFilePath: string | null | undefined) => {
    const nextEditor = liveEditorRef.current;
    if (!nextEditor || !targetFilePath || !scrollContainerRef.current) {
      return;
    }

    noteViewStateRef.current.set(targetFilePath, {
      scrollTop: scrollContainerRef.current.scrollTop,
      selectionFrom: nextEditor.state.selection.from,
      selectionTo: nextEditor.state.selection.to,
    });
  }, []);

  const restoreNoteViewState = useCallback((targetFilePath: string | null | undefined) => {
    const nextEditor = liveEditorRef.current;
    if (!nextEditor || !targetFilePath || !scrollContainerRef.current) {
      return false;
    }

    const savedState = noteViewStateRef.current.get(targetFilePath);
    if (!savedState) {
      return false;
    }

    const maxPosition = Math.max(1, nextEditor.state.doc.content.size);
    const selectionFrom = clamp(savedState.selectionFrom, 1, maxPosition);
    const selectionTo = clamp(savedState.selectionTo, selectionFrom, maxPosition);

    nextEditor.commands.setTextSelection({ from: selectionFrom, to: selectionTo });

    window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = savedState.scrollTop;
      }
    });

    return true;
  }, []);

  const handleScrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

      const resolved = await window.glyph.resolveLinkTarget(filePath, href);
      if (!resolved) {
        showToast("Could not open link", "Link target could not be resolved.");
        return false;
      }

      if (resolved.kind === "markdown-file") {
        if (onOpenLinkedFile) {
          onOpenLinkedFile(resolved.target);
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
    const nextState = {
      active: nextEditor.isActive("table"),
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

  const editor = useEditor({
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
    editable: !isReadingLayout,
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
          setHoveredLink({
            href,
            iconLeft: rect.right + 4,
            iconTop: rect.top + rect.height / 2,
            tooltipLeft: clamp(rect.left + rect.width / 2, 96, window.innerWidth - 96),
            tooltipTop: rect.bottom + 10,
          });
          return false;
        },
        mouseout: (_view, event) => {
          const nextTarget =
            event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;

          if (nextTarget?.closest("[data-link-hover-affordance='true']")) {
            return false;
          }

          scheduleHoveredLinkHide();
          return false;
        },
        scroll: () => {
          setImageControls(null);
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

      refreshTableControls(nextEditor);
      refreshImageControls(nextEditor);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      const nextMarkdown = (nextEditor.storage as any).markdown.getMarkdown() as string;
      lastSyncedMarkdown.current = nextMarkdown;
      storeNoteViewState(filePath);
      onChange(nextMarkdown);
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      liveEditorRef.current = nextEditor;
      refreshTableControls(nextEditor);
      refreshImageControls(nextEditor);
      storeNoteViewState(filePath);
    },
  });

  const outlineItems = useMemo<EditorOutlineItem[]>(() => {
    if (!editor) {
      return [];
    }

    return collectEditorOutline(editor);
  }, [content, editor]);

  const outlineIndentStyles = useMemo<Record<number, CSSProperties>>(() => {
    const styles: Record<number, CSSProperties> = {};

    outlineItems.forEach((item) => {
      if (styles[item.depth]) {
        return;
      }

      styles[item.depth] = {
        paddingLeft: `${12 + (item.depth - 1) * 12}px`,
      };
    });

    return styles;
  }, [outlineItems]);

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
  }, [content, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    liveEditorRef.current = editor;
    editor.setEditable(!isReadingLayout);
  }, [editor, isReadingLayout]);

  useEffect(() => {
    if (!filePath) {
      return;
    }

    const previousFilePath = previousFilePathRef.current;

    if (previousFilePath && previousFilePath !== filePath) {
      storeNoteViewState(previousFilePath);
    }

    window.requestAnimationFrame(() => {
      const restored = restoreNoteViewState(filePath);
      if (!restored && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      previousFilePathRef.current = filePath;
    });
  }, [editor, filePath, restoreNoteViewState, storeNoteViewState]);

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
      storeNoteViewState(filePath);
      clearHoveredLinkHideTimeout();
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [filePath, storeNoteViewState]);

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
          setTableForm({ rows: "3", cols: "3" });
          setActiveDialog("insert-table");
          break;
        case "insert-link": {
          const selectedText = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            "",
            "",
          );
          const currentHref = String(editor.getAttributes("link").href ?? "");
          setLinkForm({
            text: selectedText || "Link label",
            href: currentHref,
          });
          setActiveDialog("insert-link");
          break;
        }
        case "insert-image":
          setImageForm({ alt: "Image", src: "" });
          setActiveDialog("insert-image");
          break;
      }
    };

    window.addEventListener("glyph:editor-action", handleEditorAction as EventListener);
    return () => {
      window.removeEventListener("glyph:editor-action", handleEditorAction as EventListener);
    };
  }, [editor]);

  const handlePickImageFile = async () => {
    if (!window.glyph) {
      showToast("Picker unavailable", "Glyph API not available");
      return;
    }

    const asset = await window.glyph.pickAsset("image");
    if (!asset) {
      return;
    }

    const baseName = asset.name.replace(/\.[^.]+$/, "");
    setImageForm({
      alt: baseName || "Image",
      src: asset.url,
    });
  };

  const handleInsertTable = () => {
    if (!editor) {
      return;
    }

    const rows = Math.min(12, Math.max(2, Number.parseInt(tableForm.rows, 10) || 3));
    const cols = Math.min(8, Math.max(1, Number.parseInt(tableForm.cols, 10) || 3));

    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setActiveDialog(null);
    showToast("Table inserted", `${rows} rows and ${cols} columns ready.`);
  };

  const handleInsertLink = () => {
    if (!editor) {
      return;
    }

    const href = normalizeLinkTarget(linkForm.href);
    if (!href) {
      showToast("Link missing", "Add a URL or choose a file.");
      return;
    }

    const text = linkForm.text.trim() || href.replace(/^https?:\/\//i, "");
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "text",
          text,
          marks: [
            {
              type: "link",
              attrs: { href },
            },
          ],
        },
      ])
      .run();
    setActiveDialog(null);
    showToast("Link inserted", href);
  };

  const handleInsertImage = () => {
    if (!editor) {
      return;
    }

    const src = normalizeLinkTarget(imageForm.src);
    if (!src) {
      showToast("Image missing", "Add an image URL or choose a local image.");
      return;
    }

    editor
      .chain()
      .focus()
      .setImage({
        src,
        alt: imageForm.alt.trim() || "Image",
        title: imageForm.alt.trim() || undefined,
      })
      .run();
    setActiveDialog(null);
    showToast("Image inserted", imageForm.alt.trim() || "Image");
  };

  const handleDeleteSelectedImage = () => {
    if (!editor?.isActive("image")) {
      return;
    }

    editor.chain().focus().deleteSelection().run();
    setImageControls(null);
    showToast("Image removed", "");
  };

  const handleCopyPath = async () => {
    if (filePath) {
      try {
        await navigator.clipboard.writeText(filePath);
        showToast("Note path copied", "");
      } catch (err) {
        console.error("Failed to copy path:", err);
        showToast("Could not copy note path", "");
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
          showToast("Could not reveal note", "");
        }
      } catch (err) {
        console.error("Failed to reveal note:", err);
        showToast("Could not reveal note", "");
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

  const isMacLike = navigator.platform.includes("Mac");
  const linkOpenShortcutHint = isMacLike ? "Open link (Cmd+Click)" : "Open link (Ctrl+Click)";
  const headerPaddingClass = isSidebarCollapsed && isMacLike ? "pl-20 pr-4" : "px-4";
  const shouldShowOutlineRail = !isFocusLayout;
  const shouldShowCommandPalette = Boolean(onOpenCommandPalette && !isFocusLayout);
  const modeButtonsVisible = Boolean(onToggleFocusMode || onToggleReadingMode);
  const breadcrumbContext = breadcrumbTrail.map((item) => item.label).join(" / ");
  const backTooltipLabel = previousHistoryItem
    ? `Back to ${previousHistoryItem.title} (${navigateBackShortcut ?? "⌘["})`
    : `Back (${navigateBackShortcut ?? "⌘["})`;
  const forwardTooltipLabel = nextHistoryItem
    ? `Forward to ${nextHistoryItem.title} (${navigateForwardShortcut ?? "⌘]"})`
    : `Forward (${navigateForwardShortcut ?? "⌘]"})`;

  return (
    <section className="relative h-full min-h-0 flex flex-col bg-background">
      <div
        className={`flex items-center py-2 border-b border-border/40 gap-2 ${headerPaddingClass}`}
      >
        {/* Left: toolbar + title */}
        <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
          {onToggleSidebar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
                  onClick={onToggleSidebar}
                  type="button"
                >
                  {isSidebarCollapsed ? <PanelRightIcon size={16} /> : <PanelLeftIcon size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isSidebarCollapsed
                  ? `Show Sidebar (${toggleSidebarShortcut ?? "⌘B"})`
                  : `Hide Sidebar (${toggleSidebarShortcut ?? "⌘B"})`}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canGoBack}
                onClick={onNavigateBack}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted disabled:text-muted-foreground/40 disabled:opacity-40"
                type="button"
              >
                <ArrowLeftIcon size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{backTooltipLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canGoForward}
                onClick={onNavigateForward}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted disabled:text-muted-foreground/40 disabled:opacity-40"
                type="button"
              >
                <ArrowRightIcon size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{forwardTooltipLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
                onClick={onCreateNote}
                type="button"
              >
                <PlusIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{`New Note (${newNoteShortcut ?? "⌘N"})`}</TooltipContent>
          </Tooltip>
          {fileName ? (
            <div className="flex min-w-0 flex-col justify-center gap-0.5 pl-1">
              {breadcrumbTrail.length > 0 ? (
                <div
                  className="flex min-w-0 items-center gap-1 overflow-hidden text-[11px] font-medium tracking-[0.12em] text-muted-foreground"
                  title={breadcrumbContext || filePath || fileName}
                >
                  {breadcrumbTrail.map((crumb, index) => (
                    <span key={crumb.id} className="flex min-w-0 items-center gap-1">
                      <span className="truncate">{crumb.label}</span>
                      {index < breadcrumbTrail.length - 1 ? (
                        <span className="text-border/70">/</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
              <span
                className="max-w-[220px] truncate text-sm font-medium text-foreground"
                title={filePath ?? fileName}
              >
                {fileName.replace(MARKDOWN_FILE_SUFFIX_PATTERN, "")}
              </span>
            </div>
          ) : null}
        </div>

        {/* Center: search bar */}
        {shouldShowCommandPalette && onOpenCommandPalette ? (
          <div className="flex-1 flex justify-center px-2 min-w-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full max-w-sm justify-between px-3 py-1.5 text-sm text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={onOpenCommandPalette}
              type="button"
            >
              <div className="flex items-center gap-2">
                <SearchIcon size={13} className="opacity-60 flex-shrink-0" />
                <span>Search notes</span>
              </div>
              <span className="font-mono text-xs opacity-50 ml-4 flex-shrink-0">
                {commandPaletteShortcut ?? "⌘P"}
              </span>
            </Button>
          </div>
        ) : null}

        {/* Right: actions */}
        <div className="flex items-center gap-1 relative flex-shrink-0">
          {modeButtonsVisible ? (
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/35 p-1 shadow-sm">
              {onToggleFocusMode ? (
                <Button
                  variant={isFocusLayout ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs font-semibold"
                  onClick={onToggleFocusMode}
                  aria-pressed={isFocusLayout}
                  type="button"
                >
                  Focus
                </Button>
              ) : null}
              {onToggleReadingMode ? (
                <Button
                  variant={isReadingLayout ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs font-semibold"
                  onClick={onToggleReadingMode}
                  aria-pressed={isReadingLayout}
                  type="button"
                >
                  Reading
                </Button>
              ) : null}
            </div>
          ) : null}
          {shouldShowUpdateButton && onUpdateAction ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm"
                  onClick={onUpdateAction}
                  disabled={isUpdateButtonDisabled}
                  type="button"
                >
                  {updateButtonLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {effectiveUpdateState?.status === "downloaded"
                  ? "Restart to install the latest Glyph release"
                  : "Download the latest Glyph release"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                type="button"
              >
                <DotsHorizontalIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">More options</TooltipContent>
          </Tooltip>
          {onOpenSettings && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={onOpenSettings}
                  type="button"
                >
                  <GearIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>
          )}

          {isMenuOpen && (
            <>
              <button
                aria-label="Close menu"
                className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
                onClick={() => setIsMenuOpen(false)}
                type="button"
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1 overflow-hidden">
                {onTogglePinnedFile ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                    onClick={() => {
                      onTogglePinnedFile();
                      setIsMenuOpen(false);
                    }}
                    disabled={!filePath}
                    type="button"
                  >
                    {isActiveFilePinned ? (
                      <PinOffIcon size={14} className="opacity-70" />
                    ) : (
                      <PinIcon size={14} className="opacity-70" />
                    )}
                    {isActiveFilePinned ? "Unpin note" : "Pin note"}
                  </Button>
                ) : null}
                {onToggleFavoriteFile ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                    onClick={() => {
                      onToggleFavoriteFile();
                      setIsMenuOpen(false);
                    }}
                    disabled={!filePath}
                    type="button"
                  >
                    <CheckCircleIcon size={14} className="opacity-70" />
                    {isActiveFileFavorite ? "Remove favorite" : "Add favorite"}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                  onClick={() => {
                    handleCopy();
                    setIsMenuOpen(false);
                  }}
                  disabled={!content}
                  type="button"
                >
                  <CopyIcon size={14} className="opacity-70" />
                  Copy as Markdown
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                  onClick={() => {
                    handleCopyPath();
                    setIsMenuOpen(false);
                  }}
                  disabled={!filePath}
                  type="button"
                >
                  <LinkIcon size={14} className="opacity-70" />
                  Copy note path
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                  onClick={() => {
                    handleOpenExternal();
                    setIsMenuOpen(false);
                  }}
                  disabled={!filePath}
                  type="button"
                >
                  <RevealInFolderIcon size={14} className="opacity-70 shrink-0" />
                  {revealInFolderLabel}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                  onClick={() => {
                    handleScrollToTop();
                    setIsMenuOpen(false);
                  }}
                  disabled={!content}
                  type="button"
                >
                  <ArrowUpIcon size={14} className="opacity-70" />
                  Scroll to top
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                  onClick={() => {
                    void handleExportPDF();
                    setIsMenuOpen(false);
                  }}
                  disabled={!content}
                  type="button"
                >
                  <FileDownIcon size={14} className="opacity-70" />
                  Export as PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className={`flex-1 min-h-0 overflow-y-auto relative [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          shouldShowOutlineRail ? "xl:pr-[316px]" : ""
        }`}
        onScroll={() => {
          setImageControls(null);
          clearHoveredLinkHideTimeout();
          setHoveredLink(null);
          storeNoteViewState(filePath);
        }}
      >
        {tableControls.active && !isReadingLayout ? (
          <div className="pointer-events-none absolute top-4 right-6 z-20">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/95 px-3 py-2 shadow-lg supports-backdrop-filter:backdrop-blur-sm">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Table
              </span>
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={() => editor?.chain().focus().addRowAfter().run()}
              >
                Add Row
              </Button>
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
              >
                Add Column
              </Button>
              <Button
                variant="outline"
                size="xs"
                type="button"
                disabled={!tableControls.canDeleteRow}
                onClick={() => editor?.chain().focus().deleteRow().run()}
              >
                Remove Row
              </Button>
              <Button
                variant="outline"
                size="xs"
                type="button"
                disabled={!tableControls.canDeleteColumn}
                onClick={() => editor?.chain().focus().deleteColumn().run()}
              >
                Remove Column
              </Button>
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
              >
                Toggle Header
              </Button>
              <Button
                variant="destructive"
                size="xs"
                type="button"
                disabled={!tableControls.canDeleteTable}
                onClick={() => editor?.chain().focus().deleteTable().run()}
              >
                Delete Table
              </Button>
            </div>
          </div>
        ) : null}
        {hoveredLink ? (
          <>
            <div
              className="fixed z-30"
              data-link-hover-affordance="true"
              onMouseEnter={clearHoveredLinkHideTimeout}
              onMouseLeave={scheduleHoveredLinkHide}
              style={{
                left: hoveredLink.iconLeft,
                top: hoveredLink.iconTop,
                transform: "translateY(-50%)",
              }}
            >
              <Button
                data-link-hover-affordance="true"
                variant="ghost"
                size="icon-xs"
                type="button"
                className="pointer-events-auto text-[var(--editor-link)] hover:bg-transparent hover:opacity-80"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleLinkActivation(hoveredLink.href)}
              >
                <ExternalLinkIcon size={12} />
              </Button>
            </div>
            <div
              className="pointer-events-none fixed z-30"
              style={{
                left: hoveredLink.tooltipLeft,
                top: hoveredLink.tooltipTop,
                transform: "translateX(-50%)",
              }}
            >
              <div className="inline-flex max-w-[220px] items-center rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-sm">
                {linkOpenShortcutHint}
              </div>
            </div>
          </>
        ) : null}
        {imageControls ? (
          <div
            className="fixed z-30"
            style={{
              left: imageControls.left,
              top: imageControls.top,
            }}
          >
            <Button
              variant="destructive"
              size="icon-xs"
              type="button"
              className="shadow-md"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleDeleteSelectedImage}
            >
              <TrashIcon size={12} />
            </Button>
          </div>
        ) : null}
        <EditorContent editor={editor} />
      </div>
      {shouldShowOutlineRail ? (
        <aside className="pointer-events-none absolute right-4 top-[72px] z-20 hidden xl:block w-[290px]">
          <div className="pointer-events-auto flex min-h-0 flex-col rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Outline
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{outlineItems.length} headings</p>
              </div>
              <Button variant="ghost" size="xs" type="button" onClick={handleScrollToTop}>
                Top
              </Button>
            </div>
            <div className="mt-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {outlineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add H1 to H4 headings to build a quick table of contents.
                </p>
              ) : (
                <div className="space-y-1">
                  {outlineItems.map((item) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="h-auto w-full justify-start rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-muted/70"
                      style={outlineIndentStyles[item.depth]}
                      onClick={() => handleJumpToHeading(item)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.title}</div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          H{item.depth} · line {item.line}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      ) : null}
      <div
        className={`absolute bottom-6 flex items-center gap-3 rounded-full border border-border bg-card/80 px-3 py-1.5 shadow-sm z-30 pointer-events-none ${
          shouldShowOutlineRail ? "xl:right-[326px]" : "right-10"
        }`}
      >
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span>{wordCount} words</span>
          <span>{readingTime} min read</span>
        </div>
        <div className="w-[1px] h-3 bg-border" />
        <p className="text-xs font-medium text-foreground m-0">{saveStateLabel}</p>
      </div>
      <Dialog
        open={activeDialog === "insert-table"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Table</DialogTitle>
            <DialogDescription>
              Start with the right shape, then use the table controls to add or remove rows and
              columns anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm" htmlFor="table-rows-input">
              <span className="font-medium text-foreground">Rows</span>
              <Input
                id="table-rows-input"
                min={2}
                max={12}
                type="number"
                value={tableForm.rows}
                onChange={(event) =>
                  setTableForm((current) => ({
                    ...current,
                    rows: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="table-cols-input">
              <span className="font-medium text-foreground">Columns</span>
              <Input
                id="table-cols-input"
                min={1}
                max={8}
                type="number"
                value={tableForm.cols}
                onChange={(event) =>
                  setTableForm((current) => ({
                    ...current,
                    cols: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsertTable}>
              Insert Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={activeDialog === "insert-link"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Paste a URL and Glyph will normalize bare domains like `example.com` to `https://`
              automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm" htmlFor="link-label-input">
              <span className="font-medium text-foreground">Label</span>
              <Input
                id="link-label-input"
                value={linkForm.text}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
                placeholder="Open site"
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="link-url-input">
              <span className="font-medium text-foreground">URL</span>
              <Input
                id="link-url-input"
                value={linkForm.href}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    href: event.target.value,
                  }))
                }
                placeholder="https://example.com"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsertLink}>
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={activeDialog === "insert-image"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>
              Paste an image URL or choose a local file. Local images are served through Glyph so
              they render reliably while editing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm" htmlFor="image-alt-input">
              <span className="font-medium text-foreground">Alt text</span>
              <Input
                id="image-alt-input"
                value={imageForm.alt}
                onChange={(event) =>
                  setImageForm((current) => ({
                    ...current,
                    alt: event.target.value,
                  }))
                }
                placeholder="Team logo"
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="image-src-input">
              <span className="font-medium text-foreground">Image source</span>
              <Input
                id="image-src-input"
                value={imageForm.src}
                onChange={(event) =>
                  setImageForm((current) => ({
                    ...current,
                    src: event.target.value,
                  }))
                }
                placeholder="https://example.com/logo.png"
              />
            </label>
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <p className="m-0 text-xs text-muted-foreground">
                Local images open a native file picker and avoid broken `file://` previews.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                type="button"
                onClick={() => void handlePickImageFile()}
              >
                Choose Local Image
              </Button>
            </div>
            {imageForm.src ? (
              <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-2">
                <img
                  alt={imageForm.alt || "Image preview"}
                  className="max-h-40 w-full rounded-lg object-contain"
                  src={normalizeLinkTarget(imageForm.src)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsertImage}>
              Insert Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-start gap-3 max-w-[360px] px-4 py-3 bg-card border border-border rounded-lg shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="mt-0.5 text-foreground" aria-hidden="true">
            <CheckCircleIcon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-medium text-foreground leading-snug">{toast.title}</p>
            {toast.description ? (
              <p className="m-0 mt-0.5 text-xs text-muted-foreground leading-snug break-words">
                {toast.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
