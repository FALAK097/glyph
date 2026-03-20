import { createLowlight } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";

import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import bash from "highlight.js/lib/languages/bash";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import markdown from "highlight.js/lib/languages/markdown";

import { CodeBlockNodeView } from "../code-block-node-view";

const lowlight = createLowlight();

// Register languages
lowlight.register("javascript", javascript);
lowlight.register("js", javascript);
lowlight.register("typescript", typescript);
lowlight.register("ts", typescript);
lowlight.register("python", python);
lowlight.register("html", xml);
lowlight.register("xml", xml);
lowlight.register("css", css);
lowlight.register("bash", bash);
lowlight.register("sh", bash);
lowlight.register("shell", bash);
lowlight.register("dockerfile", dockerfile);
lowlight.register("json", json);
lowlight.register("yaml", yaml);
lowlight.register("yml", yaml);
lowlight.register("sql", sql);
lowlight.register("go", go);
lowlight.register("golang", go);
lowlight.register("rust", rust);
lowlight.register("rs", rust);
lowlight.register("markdown", markdown);
lowlight.register("md", markdown);

export const CustomCodeBlockLowlight = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: "plaintext",
  enableTabIndentation: true,
  tabSize: 2,
  languageClassPrefix: "language-",
  HTMLAttributes: {
    class: "hljs",
  },
}).extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": ({ editor }) => {
        const { $cursor } = editor.state.selection as any;
        if (!$cursor) return false;

        const node = $cursor.parent;
        if (node.type.name === "codeBlock") {
          const endPos = $cursor.after();
          const nextNode = editor.state.doc.nodeAt(endPos);

          if (!nextNode) {
            editor.commands.insertContent({
              type: "paragraph",
            });
          }
        }
        return false;
      },
    };
  },
});
