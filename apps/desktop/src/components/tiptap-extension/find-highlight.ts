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

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    const text = node.text.toLowerCase();
    let fromIndex = 0;

    while (fromIndex <= text.length - normalizedQuery.length) {
      const matchIndex = text.indexOf(normalizedQuery, fromIndex);
      if (matchIndex === -1) {
        break;
      }

      const from = pos + matchIndex;
      const to = from + normalizedQuery.length;

      matches.push({ from, to });
      fromIndex = matchIndex + Math.max(normalizedQuery.length, 1);
    }
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
