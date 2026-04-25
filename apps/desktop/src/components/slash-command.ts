import { Extension } from "@tiptap/core";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance, type Props } from "tippy.js";
import "tippy.js/dist/tippy.css";
import { SlashCommandList } from "./slash-command-list";
import type {
  SlashCommandItem,
  SlashCommandListHandle,
  SlashCommandWithKey,
} from "../types/slash-command";
import { MODIFIER_TOKENS } from "../shared/shortcuts";

/**
 * Hardcoded TipTap/StarterKit default shortcuts displayed as hints in the
 * slash command menu. These are the real bindings — not configurable — so the
 * hint always matches what actually works in the editor.
 *
 * Stored in the internal space-separated token format (same as settings
 * shortcuts) and converted to the platform-appropriate display form at
 * render time by the ShortcutBadge component.
 */
const COMMANDS: SlashCommandWithKey[] = [
  {
    id: "h1",
    title: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "heading", "title", "#"],
    group: "Headings",
    icon: "Heading01Icon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} ${MODIFIER_TOKENS.alt} 1`,
  },
  {
    id: "h2",
    title: "Heading 2",
    description: "Medium section heading",
    keywords: ["h2", "heading", "##"],
    group: "Headings",
    icon: "Heading02Icon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} ${MODIFIER_TOKENS.alt} 2`,
  },
  {
    id: "h3",
    title: "Heading 3",
    description: "Small section heading",
    keywords: ["h3", "heading", "###"],
    group: "Headings",
    icon: "Heading03Icon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} ${MODIFIER_TOKENS.alt} 3`,
  },
  {
    id: "bullet",
    title: "Bullet List",
    description: "Create an unordered list",
    keywords: ["list", "bullet", "ul", "-"],
    group: "Lists",
    icon: "BulletIcon",
    shortcut: undefined,
  },
  {
    id: "ordered",
    title: "Numbered List",
    description: "Create an ordered list",
    keywords: ["list", "number", "ordered", "ol", "1."],
    group: "Lists",
    icon: "ListViewIcon",
    shortcut: undefined,
  },
  {
    id: "task",
    title: "Task List",
    description: "Checklist with markdown tasks",
    keywords: ["task", "todo", "checklist", "- [ ]"],
    group: "Lists",
    icon: "CheckListIcon",
    shortcut: undefined,
  },
  {
    id: "quote",
    title: "Quote",
    description: "Insert blockquote",
    keywords: ["quote", "blockquote", ">"],
    group: "Blocks",
    icon: "QuoteDownIcon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} ${MODIFIER_TOKENS.shift} B`,
  },
  {
    id: "table",
    title: "Table",
    description: "Insert markdown table",
    keywords: ["table", "grid", "|---|"],
    group: "Blocks",
    icon: "Table01Icon",
    shortcut: undefined,
  },
  {
    id: "codeblock",
    title: "Code Block",
    description: "Insert a code block with syntax highlighting",
    keywords: ["code", "codeblock", "block", "```"],
    group: "Blocks",
    icon: "CodeSimpleIcon",
    shortcut: undefined,
  },
  {
    id: "rule",
    title: "Horizontal Rule",
    description: "Insert thematic break",
    keywords: ["rule", "divider", "---"],
    group: "Blocks",
    icon: "HorizontalResizeIcon",
    shortcut: undefined,
  },
  {
    id: "bold",
    title: "Bold",
    description: "Mark selected text as bold",
    keywords: ["bold", "strong", "**"],
    group: "Inline",
    icon: "TextBoldIcon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} B`,
  },
  {
    id: "italic",
    title: "Italic",
    description: "Mark selected text as italic",
    keywords: ["italic", "emphasis", "*"],
    group: "Inline",
    icon: "TextItalicIcon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} I`,
  },
  {
    id: "strike",
    title: "Strikethrough",
    description: "Cross out selected text",
    keywords: ["strike", "strikethrough", "~~"],
    group: "Inline",
    icon: "TextStrikethroughIcon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} ${MODIFIER_TOKENS.shift} S`,
  },
  {
    id: "inlinecode",
    title: "Inline Code",
    description: "Mark selected text as code",
    keywords: ["inline", "code", "`"],
    group: "Inline",
    icon: "CodeSimpleIcon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} E`,
  },
  {
    id: "link",
    title: "Link",
    description: "Insert markdown link",
    keywords: ["link", "url", "[]()"],
    group: "Inline",
    icon: "Link01Icon",
    shortcut: `${MODIFIER_TOKENS.cmdOrCtrl} K`,
  },
  {
    id: "image",
    title: "Image",
    description: "Insert markdown image",
    keywords: ["image", "img", "![]()"],
    group: "Inline",
    icon: "Image01Icon",
    shortcut: undefined,
  },
];

const runCommand = ({
  editor,
  range,
  props,
}: {
  editor: SuggestionProps<SlashCommandWithKey>["editor"];
  range: SuggestionProps<SlashCommandWithKey>["range"];
  props: SlashCommandWithKey;
}) => {
  editor.chain().focus().deleteRange(range).run();

  const dispatchEditorAction = (type: "insert-table" | "insert-link" | "insert-image") => {
    window.dispatchEvent(new CustomEvent("glyph:editor-action", { detail: { type } }));
  };

  switch (props.id) {
    case "h1":
      editor.chain().focus().toggleHeading({ level: 1 }).run();
      return;
    case "h2":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      return;
    case "h3":
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      return;
    case "bullet":
      editor.chain().focus().toggleBulletList().run();
      return;
    case "ordered":
      editor.chain().focus().toggleOrderedList().run();
      return;
    case "task":
      editor.chain().focus().toggleTaskList().run();
      return;
    case "quote":
      editor.chain().focus().toggleBlockquote().run();
      return;
    case "codeblock":
      editor.chain().focus().toggleCodeBlock().run();
      return;
    case "inlinecode":
      editor.chain().focus().toggleCode().run();
      return;
    case "table":
      dispatchEditorAction("insert-table");
      return;
    case "image":
      dispatchEditorAction("insert-image");
      return;
    case "bold":
      editor.chain().focus().toggleBold().run();
      return;
    case "italic":
      editor.chain().focus().toggleItalic().run();
      return;
    case "strike":
      editor.chain().focus().toggleStrike().run();
      return;
    case "link":
      dispatchEditorAction("insert-link");
      return;
    case "rule":
      editor.chain().focus().setHorizontalRule().run();
      return;
  }
};

const getSuggestionItems = ({ query }: { query: string }) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return COMMANDS;
  }
  return COMMANDS.filter((item) => {
    const haystack = [item.title, item.description, ...item.keywords].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
};

const slashSuggestion: Omit<SuggestionOptions<SlashCommandWithKey>, "editor"> = {
  char: "/",
  allowSpaces: true,
  startOfLine: true,
  items: getSuggestionItems,
  command: runCommand,
  render: () => {
    let component: ReactRenderer<SlashCommandListHandle> | null = null;
    let popup: Instance<Props> | null = null;

    return {
      onStart: (props: SuggestionProps<SlashCommandWithKey>) => {
        component = new ReactRenderer(SlashCommandList, {
          props: {
            items: props.items,
            onSelect: (item: SlashCommandItem) => props.command(item as SlashCommandWithKey),
          },
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy(document.body, {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          theme: "slash-menu",
        });
      },
      onUpdate: (props: SuggestionProps<SlashCommandWithKey>) => {
        component?.updateProps({
          items: props.items,
          onSelect: (item: SlashCommandItem) => props.command(item as SlashCommandWithKey),
        });

        if (!props.clientRect) {
          return;
        }

        popup?.setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
        });
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === "Escape") {
          popup?.hide();
          return true;
        }

        return component?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: () => {
        popup?.destroy();
        component?.destroy();
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: "slash-command",
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...slashSuggestion })];
  },
});
