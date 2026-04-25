import type { Editor } from "@tiptap/core";

import type { EditorOutlineItem } from "@/types/markdown-editor";
import { createHeadingId } from "@/core/note-navigation";

export const LINK_IMAGE_PATTERN = /(!?)\[([^\]]+)\]\(([^)]+)\)$/;
export const MARKDOWN_FILE_SUFFIX_PATTERN = /\.(md|mdx|markdown)$/i;
export const WINDOWS_DRIVE_PATH_PATTERN = /^[a-z]:[\\/]/i;

export const DEFAULT_SELECTION_SNAPSHOT = {
  from: 1,
  to: 1,
};

export const EMPTY_FIND_PANEL_STATE = {
  activeIndex: -1,
  matchCount: 0,
};

export const INACTIVE_TABLE_CONTROLS = {
  active: false,
  canDeleteRow: false,
  canDeleteColumn: false,
  canDeleteTable: false,
};

export const extractLinkAttributes = (input: string) => {
  const match = input.match(/(.+?)\s+"([^"]+)"$/);
  if (match) {
    return { href: match[1].trim(), title: match[2] };
  }

  return { href: input.trim(), title: undefined };
};

export const normalizeLinkTarget = (value: string) => {
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

export const isSafeLocalLinkTarget = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("#")) {
    return true;
  }

  if (WINDOWS_DRIVE_PATH_PATTERN.test(trimmed)) {
    return true;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return false;
  }

  const [pathPart] = trimmed.split(/[?#]/, 1);
  if (!pathPart || pathPart.startsWith("//")) {
    return false;
  }

  return pathPart.includes("/") || pathPart.startsWith(".");
};

export const isExternalLink = (href: string) => {
  const trimmed = href.trim();
  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed);
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function collectEditorOutline(editor: Editor): EditorOutlineItem[] {
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

export function getSelectedEditorText(editor: Editor) {
  const { from, to } = editor.state.selection;
  if (from === to) {
    return "";
  }

  return editor.state.doc.textBetween(from, to, " ", " ").trim();
}
