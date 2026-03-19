import { useEffect, useRef, useState } from "react";
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
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";

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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

import { SlashCommand } from "./slash-command";
import {
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
  PlusIcon,
  RevealInFolderIcon,
  SearchIcon,
  TrashIcon,
} from "./icons";

import type {
  MarkdownEditorProps,
  MarkdownEditorToast,
} from "../types/markdown-editor";

const LINK_IMAGE_PATTERN = /(!?)\[([^\]]+)\]\(([^)]+)\)$/;
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

type HoveredLinkState = {
  href: string;
  left: number;
  top: number;
};

type TableControlsState = {
  active: boolean;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
  canDeleteTable: boolean;
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

  if (
    /^[a-z]+:/i.test(trimmed) &&
    !/^(https?:\/\/|file:\/\/|glyph-local:\/\/)/i.test(trimmed)
  ) {
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
  canGoBack,
  canGoForward,
  autoOpenPDFSetting,
}: MarkdownEditorProps) => {
  const lastSyncedMarkdown = useRef(content);
  const isAutoConvertingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tableControlsRef = useRef<TableControlsState>({
    active: false,
    canDeleteRow: false,
    canDeleteColumn: false,
    canDeleteTable: false,
  });
  const toastTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const hoveredLinkHideTimeoutRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<MarkdownEditorToast | null>(null);
  const [activeDialog, setActiveDialog] = useState<EditorActionType | null>(
    null,
  );
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
  const [imageControls, setImageControls] = useState<ImageControlsState | null>(
    null,
  );
  const [hoveredLink, setHoveredLink] = useState<HoveredLinkState | null>(null);
  const [tableControls, setTableControls] = useState<TableControlsState>({
    active: false,
    canDeleteRow: false,
    canDeleteColumn: false,
    canDeleteTable: false,
  });

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
        showToast(
          "Could not open link",
          error instanceof Error ? error.message : "Unknown error",
        );
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
      showToast(
        "Could not open link",
        error instanceof Error ? error.message : "Unknown error",
      );
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

      if (
        current &&
        current.left === nextState.left &&
        current.top === nextState.top
      ) {
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
        placeholder:
          "Start with a title, then let markdown shortcuts shape the page.",
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
        class: [
          "tiptap-editor",
          "mx-auto max-w-[800px] px-10 py-5 pb-20 text-[15px] leading-[1.7] text-foreground outline-none",
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
        ].join(" "),
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
          const link =
            target instanceof HTMLElement ? target.closest("a") : null;

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
            left: rect.right + 8,
            top: rect.top + rect.height / 2,
          });
          return false;
        },
        mouseout: (_view, event) => {
          const nextTarget =
            event.relatedTarget instanceof HTMLElement
              ? event.relatedTarget
              : null;

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
      if (runMarkdownShortcutConversion(nextEditor, isAutoConvertingRef)) {
        return;
      }

      refreshTableControls(nextEditor);
      refreshImageControls(nextEditor);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      const nextMarkdown = (
        nextEditor.storage as any
      ).markdown.getMarkdown() as string;
      lastSyncedMarkdown.current = nextMarkdown;
      onChange(nextMarkdown);
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      refreshTableControls(nextEditor);
      refreshImageControls(nextEditor);
    },
  });

  useEffect(() => {
    if (!editor || content === lastSyncedMarkdown.current) {
      return;
    }

    editor.commands.setContent(content, {
      emitUpdate: false,
    });
    lastSyncedMarkdown.current = content;
    refreshTableControls(editor);
    refreshImageControls(editor);
  }, [content, editor]);

  useEffect(() => {
    if (!filePath) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    });
  }, [filePath]);

  useEffect(() => {
    return () => {
      clearHoveredLinkHideTimeout();
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

    window.addEventListener(
      "glyph:editor-action",
      handleEditorAction as EventListener,
    );
    return () => {
      window.removeEventListener(
        "glyph:editor-action",
        handleEditorAction as EventListener,
      );
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

    const rows = Math.min(
      12,
      Math.max(2, Number.parseInt(tableForm.rows, 10) || 3),
    );
    const cols = Math.min(
      8,
      Math.max(1, Number.parseInt(tableForm.cols, 10) || 3),
    );

    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
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
        showToast("Path copied to clipboard", "");
      } catch (err) {
        console.error("Failed to copy path:", err);
        showToast("Failed to copy path", "");
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
          showToast("Could not open in Finder", "");
        }
      } catch (err) {
        console.error("Failed to open in Finder:", err);
        showToast("Could not open in Finder", "");
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
      const markdown =
        (editor as any).storage.markdown.getMarkdown?.() || editor.getHTML();
      const filename = fileName.replace(/\.(md|markdown)$/i, ".pdf");

      if (window.glyph) {
        const absolutePath = await window.glyph.exportMarkdownToPDF(
          markdown,
          filename,
        );
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
      showToast(
        "Failed to export PDF",
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  };

  const isMacLike = navigator.platform.includes("Mac");
  const headerPaddingClass =
    isSidebarCollapsed && isMacLike ? "pl-20 pr-4" : "px-4";

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
                  {isSidebarCollapsed ? (
                    <PanelRightIcon size={16} />
                  ) : (
                    <PanelLeftIcon size={16} />
                  )}
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
            <TooltipContent side="bottom">Back</TooltipContent>
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
            <TooltipContent side="bottom">Forward</TooltipContent>
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
            <TooltipContent side="bottom">
              {`New Note (${newNoteShortcut ?? "⌘N"})`}
            </TooltipContent>
          </Tooltip>
          {fileName && (
            <>
              <span className="text-border/60 text-xs flex-shrink-0 mx-0.5">
                ·
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                    {fileName.replace(/\.(md|markdown)$/i, "")}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {fileName.replace(/\.(md|markdown)$/i, "")}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Center: search bar */}
        {onOpenCommandPalette && (
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
                <span>Search glyph</span>
              </div>
              <span className="font-mono text-xs opacity-50 ml-4 flex-shrink-0">
                {commandPaletteShortcut ?? "⌘P"}
              </span>
            </Button>
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-1 relative flex-shrink-0">
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
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMenuOpen(false)}
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
                  Copy as MD
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
                  Copy file path
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
                  <RevealInFolderIcon
                    size={14}
                    className="opacity-70 shrink-0"
                  />
                  Open in Finder
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
        className="flex-1 min-h-0 overflow-y-auto relative [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={() => {
          setImageControls(null);
          clearHoveredLinkHideTimeout();
          setHoveredLink(null);
        }}
      >
        {tableControls.active ? (
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
          <div
            className="fixed z-30"
            data-link-hover-affordance="true"
            onMouseEnter={clearHoveredLinkHideTimeout}
            onMouseLeave={scheduleHoveredLinkHide}
            style={{
              left: hoveredLink.left,
              top: hoveredLink.top,
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
      <div className="absolute bottom-6 right-10 flex items-center gap-3 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border shadow-sm z-10 pointer-events-none">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span>{wordCount} words</span>
          <span>{readingTime} min read</span>
        </div>
        <div className="w-[1px] h-3 bg-border" />
        <p className="text-xs font-medium text-foreground m-0">
          {saveStateLabel}
        </p>
      </div>
      <Dialog
        open={activeDialog === "insert-table"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Table</DialogTitle>
            <DialogDescription>
              Start with the right shape, then use the table controls to add or
              remove rows and columns anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Rows</span>
              <Input
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
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Columns</span>
              <Input
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
            <Button
              variant="outline"
              type="button"
              onClick={() => setActiveDialog(null)}
            >
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
              Paste a URL and Glyph will normalize bare domains like
              `example.com` to `https://` automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Label</span>
              <Input
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
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">URL</span>
              <Input
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
            <Button
              variant="outline"
              type="button"
              onClick={() => setActiveDialog(null)}
            >
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
              Paste an image URL or choose a local file. Local images are served
              through Glyph so they render reliably while editing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Alt text</span>
              <Input
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
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Image source</span>
              <Input
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
                Local images open a native file picker and avoid broken
                `file://` previews.
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
            <Button
              variant="outline"
              type="button"
              onClick={() => setActiveDialog(null)}
            >
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
            <p className="m-0 text-sm font-medium text-foreground leading-snug">
              {toast.title}
            </p>
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
