import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type FindHighlightMatch = {
  from: number;
  to: number;
};

export type FindHighlightState = {
  activeIndex: number;
  decorations: DecorationSet;
  matches: FindHighlightMatch[];
  query: string;
};

type FindHighlightMeta =
  | {
      activeIndex?: number;
      query?: string;
    }
  | undefined;

const EMPTY_FIND_HIGHLIGHT_STATE: FindHighlightState = {
  activeIndex: -1,
  decorations: DecorationSet.empty,
  matches: [],
  query: "",
};

export const FIND_HIGHLIGHT_PLUGIN_KEY = new PluginKey<FindHighlightState>("glyphFindHighlight");

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function collectFindHighlightMatches(doc: ProseMirrorNode, query: string): FindHighlightMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const matches: FindHighlightMatch[] = [];

  // Walk block-level nodes that contain inline content (paragraphs, headings,
  // etc.). For each block we flatten all child text nodes into a single
  // lowercase string and build a parallel position map so that matches
  // spanning adjacent text nodes (e.g. across bold/italic marks) are found.
  doc.descendants((node, pos) => {
    if (!node.isBlock || !node.inlineContent) {
      return; // keep descending into container blocks
    }

    let flatText = "";
    const positionMap: number[] = [];

    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        const basePos = pos + 1 + offset;
        for (let i = 0; i < child.text.length; i++) {
          positionMap.push(basePos + i);
        }
        flatText += child.text.toLowerCase();
      } else {
        // Non-text inline node (image, hard break) — sentinel prevents
        // false matches across non-text boundaries.
        flatText += "\n";
        positionMap.push(-1);
      }
    });

    let fromIndex = 0;

    while (fromIndex <= flatText.length - normalizedQuery.length) {
      const matchIndex = flatText.indexOf(normalizedQuery, fromIndex);
      if (matchIndex === -1) {
        break;
      }

      const from = positionMap[matchIndex];
      const to = positionMap[matchIndex + normalizedQuery.length - 1] + 1;

      matches.push({ from, to });
      fromIndex = matchIndex + Math.max(normalizedQuery.length, 1);
    }

    return false; // already processed inline children via node.forEach
  });

  return matches;
}

function buildFindHighlightState(
  doc: ProseMirrorNode,
  query: string,
  activeIndex: number,
): FindHighlightState {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return EMPTY_FIND_HIGHLIGHT_STATE;
  }

  const matches = collectFindHighlightMatches(doc, normalizedQuery);
  if (matches.length === 0) {
    return {
      activeIndex: -1,
      decorations: DecorationSet.empty,
      matches: [],
      query: normalizedQuery,
    };
  }

  const nextActiveIndex = clamp(activeIndex, 0, matches.length - 1);
  const decorations = DecorationSet.create(
    doc,
    matches.map((match, index) =>
      Decoration.inline(match.from, match.to, {
        class:
          index === nextActiveIndex
            ? "glyph-find-match glyph-find-match-active"
            : "glyph-find-match",
      }),
    ),
  );

  return {
    activeIndex: nextActiveIndex,
    decorations,
    matches,
    query: normalizedQuery,
  };
}

export const FindHighlightExtension = Extension.create({
  name: "findHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<FindHighlightState>({
        key: FIND_HIGHLIGHT_PLUGIN_KEY,
        state: {
          init: () => EMPTY_FIND_HIGHLIGHT_STATE,
          apply: (transaction, pluginState, _oldState, newState) => {
            const meta = transaction.getMeta(FIND_HIGHLIGHT_PLUGIN_KEY) as FindHighlightMeta;

            if (meta) {
              return buildFindHighlightState(
                newState.doc,
                meta.query ?? pluginState.query,
                meta.activeIndex ?? pluginState.activeIndex,
              );
            }

            if (transaction.docChanged && pluginState.query) {
              return buildFindHighlightState(
                newState.doc,
                pluginState.query,
                pluginState.activeIndex,
              );
            }

            return pluginState;
          },
        },
        props: {
          decorations(state) {
            return FIND_HIGHLIGHT_PLUGIN_KEY.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export function getFindHighlightState(editor: Editor | null): FindHighlightState {
  if (!editor) {
    return EMPTY_FIND_HIGHLIGHT_STATE;
  }

  return FIND_HIGHLIGHT_PLUGIN_KEY.getState(editor.state) ?? EMPTY_FIND_HIGHLIGHT_STATE;
}

export function setFindHighlightQuery(editor: Editor, query: string, activeIndex = 0) {
  editor.view.dispatch(
    editor.state.tr.setMeta(FIND_HIGHLIGHT_PLUGIN_KEY, {
      activeIndex,
      query,
    }),
  );
}

export function setActiveFindHighlightMatch(editor: Editor, activeIndex: number) {
  editor.view.dispatch(
    editor.state.tr.setMeta(FIND_HIGHLIGHT_PLUGIN_KEY, {
      activeIndex,
    }),
  );
}
