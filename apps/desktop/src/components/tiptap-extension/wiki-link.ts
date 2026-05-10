import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const WIKI_LINK_PATTERN = /!?\[\[([^\]\n]+)\]\]/g;

function parseWikiLink(rawTarget: string) {
  const [target, alias] = rawTarget.split("|").map((part) => part.trim());
  if (!rawTarget.trim()) {
    return null;
  }

  return {
    href: `[[${rawTarget}]]`,
    label: alias || target || rawTarget,
    target: rawTarget,
  };
}

function buildWikiLinkDecorations(doc: Parameters<DecorationSet["map"]>[1]) {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) {
      return;
    }

    WIKI_LINK_PATTERN.lastIndex = 0;
    for (const match of node.text.matchAll(WIKI_LINK_PATTERN)) {
      const rawTarget = match[1] ?? "";
      const parsed = parseWikiLink(rawTarget);
      if (!parsed || match.index === undefined) {
        continue;
      }

      const from = position + match.index;
      const to = from + match[0].length;
      decorations.push(
        Decoration.inline(from, to, {
          "aria-label": `Open ${parsed.label}`,
          class: "wiki-link",
          "data-wiki-link": parsed.href,
          role: "link",
          title: parsed.label,
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const WikiLink = Extension.create({
  name: "wikiLink",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("wikiLink"),
        props: {
          decorations(state) {
            return buildWikiLinkDecorations(state.doc);
          },
        },
      }),
    ];
  },
});
