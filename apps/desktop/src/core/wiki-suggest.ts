import { Extension } from "@tiptap/core";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance, type Props } from "tippy.js";
import "tippy.js/dist/tippy.css";
import { PluginKey } from "@tiptap/pm/state";
import { useWorkspaceStore } from "@/store/workspace";
import { WikiSuggestList } from "../components/wiki-suggest-list";
import type {
  WikiSuggestItem,
  WikiSuggestListHandle,
} from "../types/wiki-suggest";

export const WikiLinkSuggestPluginKey = new PluginKey("wiki-link-suggest");

const runCommand = ({
  editor,
  range,
  props,
}: {
  editor: SuggestionProps<WikiSuggestItem>["editor"];
  range: SuggestionProps<WikiSuggestItem>["range"];
  props: WikiSuggestItem;
}) => {
  // Insert standard wikilink syntax, overwriting the typed trigger [[query
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent(`[[${props.title}]] `)
    .run();
};

const getSuggestionItems = async ({ query }: { query: string }): Promise<WikiSuggestItem[]> => {
  try {
    const index = useWorkspaceStore.getState().knowledgeIndex;
    if (!index || !index.notes) return [];

    const items: WikiSuggestItem[] = index.notes.map((note) => ({
      id: note.path,
      title: note.title,
      path: note.path,
      icon: (note.frontmatter?.icon as string) || null,
    }));

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      // Limit initial list to a few items
      return items.slice(0, 20);
    }

    return items
      .filter((item) => item.title.toLowerCase().includes(normalizedQuery))
      .slice(0, 20);
  } catch (error) {
    console.error("Failed to fetch wiki-link suggestions:", error);
    return [];
  }
};

const wikiSuggestion: Omit<SuggestionOptions<WikiSuggestItem>, "editor"> = {
  char: "[[",
  allowSpaces: true,
  startOfLine: false,
  allowedPrefixes: [" ", "\n", "\t"],
  items: getSuggestionItems,
  command: runCommand,
  render: () => {
    let component: ReactRenderer<WikiSuggestListHandle> | null = null;
    let popup: Instance<Props> | null = null;

    return {
      onStart: (props: SuggestionProps<WikiSuggestItem>) => {
        component = new ReactRenderer(WikiSuggestList, {
          props: {
            items: props.items,
            onSelect: (item: WikiSuggestItem) => props.command(item),
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
          theme: "slash-menu", // Reuse same styling theme
        });
      },
      onUpdate: (props: SuggestionProps<WikiSuggestItem>) => {
        component?.updateProps({
          items: props.items,
          onSelect: (item: WikiSuggestItem) => props.command(item),
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

export const WikiLinkSuggest = Extension.create({
  name: "wiki-link-suggest",
  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: WikiLinkSuggestPluginKey,
        editor: this.editor,
        ...wikiSuggestion,
      }),
    ];
  },
});
