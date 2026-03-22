import type { ShortcutSetting } from "./workspace.js";

export type ShortcutId =
  | "command-palette"
  | "new-note"
  | "open-file"
  | "open-folder"
  | "save"
  | "settings"
  | "toggle-sidebar"
  | "navigate-back"
  | "navigate-forward"
  | "focus-mode";

export type ShortcutDefinition = ShortcutSetting & {
  id: ShortcutId;
  label: string;
};

type ParsedShortcut = {
  primary: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

export type ShortcutEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
};

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // App shortcuts (fire globally, even from inside the editor)
  { id: "command-palette", label: "Command Palette", keys: "⌘ P" },
  { id: "new-note", label: "New Note", keys: "⌘ N" },
  { id: "open-file", label: "Open File", keys: "⌘ O" },
  { id: "open-folder", label: "Open Folder", keys: "⇧ ⌘ O" },
  { id: "save", label: "Save", keys: "⌘ S" },
  { id: "settings", label: "Settings", keys: "⌘ ," },
  { id: "toggle-sidebar", label: "Toggle Sidebar", keys: "⌘ \\" },
  { id: "navigate-back", label: "Navigate Back", keys: "⌘ [" },
  { id: "navigate-forward", label: "Navigate Forward", keys: "⌘ ]" },
  { id: "focus-mode", label: "Toggle Focus Mode", keys: "⇧ ⌘ F" },
];

export const MODIFIER_TOKENS = {
  cmdOrCtrl: "⌘",
  alt: "⌥",
  shift: "⇧",
} as const;

const MODIFIER_TOKENS_SET = new Set(Object.values(MODIFIER_TOKENS));

const NORMALIZED_KEY_ALIASES: Record<string, string> = {
  up: "arrowup",
  arrowup: "arrowup",
  "↑": "arrowup",
  down: "arrowdown",
  arrowdown: "arrowdown",
  "↓": "arrowdown",
  left: "arrowleft",
  arrowleft: "arrowleft",
  "←": "arrowleft",
  right: "arrowright",
  arrowright: "arrowright",
  "→": "arrowright",
  space: " ",
  comma: ",",
  esc: "escape",
  escape: "escape",
  enter: "enter",
  return: "enter",
  tab: "tab",
  backspace: "backspace",
  delete: "delete",
};

const DISPLAY_KEY_ALIASES: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  " ": "Space",
  escape: "Esc",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
};

const ELECTRON_KEY_ALIASES: Record<string, string> = {
  arrowup: "Up",
  arrowdown: "Down",
  arrowleft: "Left",
  arrowright: "Right",
  " ": "Space",
  ",": "Comma",
  escape: "Escape",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  "/": "Slash",
  "\\": "Backslash",
  ".": "Period",
};

const SHIFTED_SYMBOL_ALIASES: Record<string, string> = {
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
  _: "-",
  "+": "=",
  "{": "[",
  "}": "]",
  "|": "\\",
  ":": ";",
  '"': "'",
  "<": ",",
  ">": ".",
  "?": "/",
  "~": "`",
};

function normalizeShortcutKeyToken(token: string): string | null {
  const trimmed = token.trim();

  if (!trimmed || MODIFIER_TOKENS_SET.has(trimmed as any)) {
    return null;
  }

  let lower = trimmed.toLowerCase();

  if (trimmed.length === 1 && SHIFTED_SYMBOL_ALIASES[trimmed]) {
    lower = SHIFTED_SYMBOL_ALIASES[trimmed];
  }

  if (NORMALIZED_KEY_ALIASES[lower]) {
    return NORMALIZED_KEY_ALIASES[lower];
  }

  return lower;
}

function formatShortcutKey(key: string): string {
  if (DISPLAY_KEY_ALIASES[key]) {
    return DISPLAY_KEY_ALIASES[key];
  }

  return key.length === 1 ? key.toUpperCase() : key;
}

export function parseShortcut(keys: string): ParsedShortcut | null {
  const parts = keys.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  let key: string | null = null;
  for (const part of parts) {
    const normalized = normalizeShortcutKeyToken(part);
    if (normalized) {
      key = normalized;
    }
  }

  if (!key) {
    return null;
  }

  return {
    primary: parts.includes(MODIFIER_TOKENS.cmdOrCtrl),
    alt: parts.includes(MODIFIER_TOKENS.alt),
    shift: parts.includes(MODIFIER_TOKENS.shift),
    key,
  };
}

export function canonicalizeShortcut(keys: string): string | null {
  const parsed = parseShortcut(keys);
  if (!parsed) {
    return null;
  }

  const parts: string[] = [];
  if (parsed.shift) {
    parts.push(MODIFIER_TOKENS.shift);
  }
  if (parsed.alt) {
    parts.push(MODIFIER_TOKENS.alt);
  }
  if (parsed.primary) {
    parts.push(MODIFIER_TOKENS.cmdOrCtrl);
  }
  parts.push(formatShortcutKey(parsed.key));

  return parts.join(" ");
}

export function mergeShortcutSettings(shortcuts?: ShortcutSetting[] | null): ShortcutDefinition[] {
  const saved = new Map(
    (shortcuts ?? [])
      .filter(
        (shortcut): shortcut is ShortcutSetting =>
          typeof shortcut?.id === "string" && typeof shortcut?.keys === "string",
      )
      .map((shortcut) => [
        shortcut.id,
        canonicalizeShortcut(shortcut.keys) ?? shortcut.keys.trim(),
      ]),
  );

  return DEFAULT_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    keys: saved.get(shortcut.id) ?? shortcut.keys,
  }));
}

export function getShortcutKeys(
  shortcuts: ShortcutSetting[] | undefined | null,
  id: ShortcutId,
): string | undefined {
  return mergeShortcutSettings(shortcuts).find((shortcut) => shortcut.id === id)?.keys;
}

export function getShortcutDisplay(
  shortcuts: ShortcutSetting[] | undefined | null,
  id: ShortcutId,
): string | undefined {
  const keys = getShortcutKeys(shortcuts, id);
  return keys?.replace(/\s+/g, "");
}

export function matchShortcut(event: ShortcutEventLike, shortcut: string): boolean {
  if (event.repeat) {
    return false;
  }

  const parsed = parseShortcut(shortcut);
  if (!parsed) {
    return false;
  }

  const eventKey = normalizeShortcutKeyToken(event.key);
  const primaryPressed = event.metaKey !== event.ctrlKey && (event.metaKey || event.ctrlKey);

  return (
    eventKey === parsed.key &&
    primaryPressed === parsed.primary &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift
  );
}

export function toElectronAccelerator(shortcut: string): string | undefined {
  const parsed = parseShortcut(shortcut);
  if (!parsed) {
    return undefined;
  }

  const parts: string[] = [];
  if (parsed.primary) {
    parts.push("CmdOrCtrl");
  }
  if (parsed.alt) {
    parts.push("Alt");
  }
  if (parsed.shift) {
    parts.push("Shift");
  }

  const key =
    ELECTRON_KEY_ALIASES[parsed.key] ??
    (parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key);
  parts.push(key);

  return parts.join("+");
}
