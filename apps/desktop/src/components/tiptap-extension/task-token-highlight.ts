import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const TASK_TOKEN_PLUGIN_KEY = new PluginKey("glyphTaskTokens");

const TAG_PATTERN = /#[A-Za-z][\w/-]*/g;
const DUE_PATTERN = /\bdue:\d{4}-\d{2}-\d{2}\b/g;

export const TaskTokenHighlight = Extension.create({
  name: "taskTokenHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: TASK_TOKEN_PLUGIN_KEY,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc);
          },
          apply(tr, old) {
            return tr.docChanged ? buildDecorations(tr.doc) : old;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function buildDecorations(doc: Parameters<typeof DecorationSet.create>[0]) {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "taskItem") return;

    node.descendants((child, childPos) => {
      if (!child.isText || !child.text) return;
      const text = child.text;
      const absPos = pos + childPos + 1; // +1 for taskItem opening token

      TAG_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TAG_PATTERN.exec(text)) !== null) {
        decorations.push(
          Decoration.inline(absPos + match.index, absPos + match.index + match[0].length, {
            class: "task-tag",
          }),
        );
      }

      DUE_PATTERN.lastIndex = 0;
      while ((match = DUE_PATTERN.exec(text)) !== null) {
        const fullStart = absPos + match.index;
        const prefixEnd = fullStart + 4; // length of "due:"
        const fullEnd = absPos + match.index + match[0].length;
        // Hide the "due:" prefix
        decorations.push(Decoration.inline(fullStart, prefixEnd, { class: "task-due-prefix" }));
        // Style just the date portion as the badge
        decorations.push(Decoration.inline(prefixEnd, fullEnd, { class: "task-due" }));
      }
    });
  });

  return DecorationSet.create(doc, decorations);
}
