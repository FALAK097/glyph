import {
  Extension,
  nodeInputRule,
  textblockTypeInputRule,
  wrappingInputRule,
} from "@tiptap/core";

const HEADING_LEVELS = [1, 2, 3, 4];

const BLOCKQUOTE_INPUT_REGEX = /^\s*>\s$/;
const BULLET_LIST_INPUT_REGEX = /^\s*([-+*])\s$/;
const ORDERED_LIST_INPUT_REGEX = /^(\d+)\.\s$/;
const HORIZONTAL_RULE_INPUT_REGEX = /^(?:---|___|\*\*\*)$/;
const CODE_BLOCK_BACKTICK_INPUT_REGEX = /^```([a-z]+)?[\s\n]$/;
const CODE_BLOCK_TILDE_INPUT_REGEX = /^~~~([a-z]+)?[\s\n]$/;

export const MarkdownShortcuts = Extension.create({
  name: "markdownShortcuts",
  addInputRules() {
    const { nodes } = this.editor.schema;
    const rules = [];

    if (nodes.heading) {
      for (const level of HEADING_LEVELS) {
        rules.push(
          textblockTypeInputRule({
            find: new RegExp(`^(#{${level}})\\s$`),
            type: nodes.heading,
            getAttributes: { level },
          }),
        );
      }
    }

    if (nodes.blockquote) {
      rules.push(
        wrappingInputRule({
          find: BLOCKQUOTE_INPUT_REGEX,
          type: nodes.blockquote,
        }),
      );
    }

    if (nodes.bulletList) {
      rules.push(
        wrappingInputRule({
          find: BULLET_LIST_INPUT_REGEX,
          type: nodes.bulletList,
        }),
      );
    }

    if (nodes.orderedList) {
      rules.push(
        wrappingInputRule({
          find: ORDERED_LIST_INPUT_REGEX,
          type: nodes.orderedList,
          getAttributes: (match) => ({
            start: Number.parseInt(match[1], 10),
          }),
          joinPredicate: (match, node) =>
            node.childCount + node.attrs.start === Number.parseInt(match[1], 10),
        }),
      );
    }

    if (nodes.horizontalRule) {
      rules.push(
        nodeInputRule({
          find: HORIZONTAL_RULE_INPUT_REGEX,
          type: nodes.horizontalRule,
        }),
      );
    }

    if (nodes.codeBlock) {
      rules.push(
        textblockTypeInputRule({
          find: CODE_BLOCK_BACKTICK_INPUT_REGEX,
          type: nodes.codeBlock,
          getAttributes: (match) => ({
            language: match[1],
          }),
        }),
      );
      rules.push(
        textblockTypeInputRule({
          find: CODE_BLOCK_TILDE_INPUT_REGEX,
          type: nodes.codeBlock,
          getAttributes: (match) => ({
            language: match[1],
          }),
        }),
      );
    }

    return rules;
  },
});
