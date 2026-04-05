import { useCallback, useEffect, useRef, useState } from "react";
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

import { createHeadingId } from "@/lib/note-navigation";
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
import { TableOfContents } from "./table-of-contents";
import { FileManagerLogo } from "./file-manager-logo";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CopyIcon,
  DotsHorizontalIcon,
  FileDownIcon,
  FocusIcon,
  GearIcon,
  LinkIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  OutlineIcon,
} from "./icons";

import type { MarkdownEditorProps, MarkdownEditorToast } from "../types/markdown-editor";
import type { OutlineItem } from "@/types/navigation";
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
  saveStateLabel,
  footerMetaLabel,
  wordCount,
  readingTime,
  onChange,
  onToggleSidebar,
  isSidebarCollapsed,
  headerAccessory,
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
  onUpdateAction,
  isFocusMode,
  showOutline = true,
  onToggleFocusMode,
  focusModeShortcut,
  onTogglePinnedFile,
  onScrollPositionChange,
  folderRevealLabel,
  documentLabel = "note",
  outlineJumpRequest,
}: MarkdownEditorProps) => {
  const lastSyncedMarkdown = useRef(content);
  const onChangeRef = useRef(onChange);
  const onScrollPositionChangeRef = useRef(onScrollPositionChange);
  const filePathRef = useRef(filePath);
  const onOpenLinkedFileRef = useRef(onOpenLinkedFile);
  const isAutoConvertingRef = useRef(false);
  const liveEditorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tableControlsRef = useRef<TableControlsState>(INACTIVE_TABLE_CONTROLS);
  const toastTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hoveredLinkHideTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const scrollPositionTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const selectionSnapshotRef = useRef({ from: 1, to: 1 });
  const lastHandledFocusRequestRef = useRef<number | null>(null);
  const lastRestoredScrollStateRef = useRef<{
    key: string | null;
    top: number;
  }>({
    key: null,
    top: -1,
  });
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
  const [tableControls, setTableControls] = useState<TableControlsState>(INACTIVE_TABLE_CONTROLS);
  const [devPreviewUpdateState] = useState<UpdateState | null>(() => getDevPreviewUpdateState());
  const [outlineItems, setOutlineItems] = useState<EditorOutlineItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const outlineItemsRef = useRef<EditorOutlineItem[]>([]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onScrollPositionChangeRef.current = onScrollPositionChange;
  }, [onScrollPositionChange]);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  useEffect(() => {
    onOpenLinkedFileRef.current = onOpenLinkedFile;
  }, [onOpenLinkedFile]);

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

  const focusEditorWithoutScroll = useCallback(
    (selection: { from: number; to: number }, resetScrollTop: boolean) => {
      const nextEditor = liveEditorRef.current;
      if (!nextEditor) {
        return;
      }

      const maxPosition = Math.max(1, nextEditor.state.doc.content.size);
      const nextSelection = {
        from: clamp(selection.from, 1, maxPosition),
        to: clamp(selection.to, 1, maxPosition),
      };

      selectionSnapshotRef.current = nextSelection;
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
    [],
  );

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
  const isFocusLayout = Boolean(isFocusMode);
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
              tooltipLeft: clamp(rect.left + rect.width / 2, 96, window.innerWidth - 96),
              tooltipTop: rect.bottom + 10,
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

        selectionSnapshotRef.current = {
          from: nextEditor.state.selection.from,
          to: nextEditor.state.selection.to,
        };
        refreshTableControls(nextEditor);
        refreshImageControls(nextEditor);
        refreshOutline(nextEditor);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        const nextMarkdown = (nextEditor.storage as any).markdown.getMarkdown() as string;
        lastSyncedMarkdown.current = nextMarkdown;
        onChangeRef.current(nextMarkdown);
      },
      onSelectionUpdate: ({ editor: nextEditor }) => {
        liveEditorRef.current = nextEditor;
        selectionSnapshotRef.current = {
          from: nextEditor.state.selection.from,
          to: nextEditor.state.selection.to,
        };
        refreshTableControls(nextEditor);
        refreshImageControls(nextEditor);
      },
    },
    [],
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
  }, [content, editor, refreshOutline]);

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

  const isMacLike = navigator.platform.includes("Mac");
  const linkOpenShortcutHint = isMacLike ? "Open link (Cmd+Click)" : "Open link (Ctrl+Click)";
  const headerPaddingClass =
    (isSidebarCollapsed || isFocusLayout) && isMacLike ? "pl-20 pr-4" : "px-4";
  const shouldShowOutlineRail = !isFocusLayout && showOutline;
  const shouldShowCommandPalette = Boolean(onOpenCommandPalette);
  const modeButtonsVisible = Boolean(onToggleFocusMode);
  const searchButtonLabel = commandPaletteLabel ?? "Search notes";
  const normalizedDocumentLabel = documentLabel.trim() || "note";
  const backTooltipLabel = `Back (${navigateBackShortcut ?? "⌘["})`;
  const forwardTooltipLabel = `Forward (${navigateForwardShortcut ?? "⌘]"})`;

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
          {onNavigateBack ? (
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
          ) : null}
          {onNavigateForward ? (
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
          ) : null}
          {onCreateNote ? (
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
          ) : null}
          {fileName ? (
            <span
              className="max-w-[220px] truncate pl-1 text-sm font-medium text-foreground"
              title={filePath ?? fileName}
            >
              {fileName.replace(MARKDOWN_FILE_SUFFIX_PATTERN, "")}
            </span>
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
                <span>{searchButtonLabel}</span>
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
            <div className="flex items-center gap-0.5 relative after:absolute after:right-0 after:-mr-1.5 after:h-4 after:w-px after:bg-border/50 pr-2.5 mr-1">
              {onToggleFocusMode ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={`text-muted-foreground transition-colors ${
                        isFocusLayout ? "text-foreground" : "hover:text-foreground hover:bg-muted"
                      }`}
                      onClick={onToggleFocusMode}
                      aria-pressed={isFocusLayout}
                      type="button"
                    >
                      <FocusIcon size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isFocusLayout ? "Exit Focus Mode" : "Enter Focus Mode"}
                    {focusModeShortcut ? ` (${focusModeShortcut})` : ""}
                  </TooltipContent>
                </Tooltip>
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
          {headerAccessory ? <div className="mr-1 flex items-center">{headerAccessory}</div> : null}
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
                  {`Copy ${normalizedDocumentLabel} path`}
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
                  <FileManagerLogo label={revealInFolderLabel} size={14} className="opacity-70" />
                  {revealInFolderLabel}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                  onClick={() => {
                    void handleExportPDF();
                    setIsMenuOpen(false);
                  }}
                  disabled={!filePath}
                  type="button"
                >
                  <FileDownIcon size={14} className="opacity-70" />
                  Export as PDF
                </Button>
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
        {tableControls.active ? (
          <div className="sticky top-4 z-20 h-0 overflow-visible">
            <div
              className={`pointer-events-none flex justify-end ${
                shouldShowOutlineRail ? "xl:pr-[316px]" : "pr-6"
              }`}
            >
              <div className="pointer-events-auto flex max-w-[min(720px,calc(100vw-2rem))] flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/95 px-3 py-2 shadow-lg supports-backdrop-filter:backdrop-blur-sm">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Table
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().addRowAfter().run()}
                >
                  Add Row
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().addColumnAfter().run()}
                >
                  Add Column
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  disabled={!tableControls.canDeleteRow}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().deleteRow().run()}
                >
                  Remove Row
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  disabled={!tableControls.canDeleteColumn}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().deleteColumn().run()}
                >
                  Remove Column
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
                >
                  Toggle Header
                </Button>
                <Button
                  variant="destructive"
                  size="xs"
                  type="button"
                  disabled={!tableControls.canDeleteTable}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().deleteTable().run()}
                >
                  Delete Table
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {hoveredLink ? (
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
      <div className="absolute bottom-6 right-10 flex items-center gap-3 rounded-full border border-border bg-card/80 px-3 py-1.5 shadow-sm z-30 pointer-events-none">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span>{wordCount} words</span>
        </div>
        <div className="w-[1px] h-3 bg-border" />
        <span className="text-xs text-muted-foreground">{readingTime} min read</span>
        {footerMetaLabel ? (
          <>
            <div className="w-[1px] h-3 bg-border" />
            <span className="text-xs text-muted-foreground">{footerMetaLabel}</span>
          </>
        ) : null}
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
