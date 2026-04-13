import type { ShortcutSetting } from "./workspace.js";

export type ShortcutId =
  | "command-palette"
  | "find-in-note"
  | "new-note"
  | "new-folder"
  | "close-tab"
  | "close-other-tabs"
  | "open-file"
  | "open-folder"
  | "check-updates"
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

export const MODIFIER_TOKENS = {
  cmdOrCtrl: "⌘",
  ctrl: "Ctrl+",
  alt: "⌥",
  shift: "⇧",
} as const;

/**
 * Returns true when the given platform string identifies macOS.
 * Accepts `navigator.platform` values (e.g. "MacIntel") and
 * `process.platform` values (e.g. "darwin").
 */
export function isMacPlatform(platform?: string): boolean {
  const normalized = platform?.toLowerCase() ?? "";
  return normalized.includes("mac") || normalized === "darwin";
}

/**
 * Converts an internal shortcut key string (e.g. "⇧ ⌘ N") to the
 * platform-appropriate display format.
 *
 * - macOS  → compact symbol form: "⇧⌘N"
 * - Windows/Linux → text form: "Ctrl+Shift+N"
 */
export function formatKeysForPlatform(keys: string, platform?: string): string {
  if (isMacPlatform(platform)) {
    return keys.replace(/\s+/g, "");
  }

  const parsed = parseShortcut(keys);
  if (!parsed) {
    return keys.replace(/\s+/g, "");
  }

  const parts: string[] = [];
  if (parsed.primary) {
    parts.push("Ctrl");
  }
  if (parsed.shift) {
    parts.push("Shift");
  }
  if (parsed.alt) {
    parts.push("Alt");
  }
  parts.push(formatShortcutKey(parsed.key));

  return parts.join("+");
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // App shortcuts (fire globally, even from inside the editor)
  { id: "command-palette", label: "Command Palette", keys: `${MODIFIER_TOKENS.cmdOrCtrl} P` },
  { id: "find-in-note", label: "Find in Note", keys: `${MODIFIER_TOKENS.cmdOrCtrl} F` },
  { id: "new-note", label: "New Note", keys: `${MODIFIER_TOKENS.cmdOrCtrl} N` },
  {
    id: "new-folder",
    label: "New Folder",
    keys: `${MODIFIER_TOKENS.shift} ${MODIFIER_TOKENS.cmdOrCtrl} N`,
  },
  { id: "close-tab", label: "Close Tab", keys: `${MODIFIER_TOKENS.cmdOrCtrl} W` },
  {
    id: "close-other-tabs",
    label: "Close Other Tabs",
    keys: `${MODIFIER_TOKENS.shift} ${MODIFIER_TOKENS.cmdOrCtrl} W`,
  },
  { id: "open-file", label: "Open File", keys: `${MODIFIER_TOKENS.cmdOrCtrl} O` },
  {
    id: "open-folder",
    label: "Open Folder",
    keys: `${MODIFIER_TOKENS.shift} ${MODIFIER_TOKENS.cmdOrCtrl} O`,
  },
  {
    id: "check-updates",
    label: "Update Action",
    keys: `${MODIFIER_TOKENS.shift} ${MODIFIER_TOKENS.cmdOrCtrl} U`,
  },
  { id: "save", label: "Save", keys: `${MODIFIER_TOKENS.cmdOrCtrl} S` },
  { id: "settings", label: "Settings", keys: `${MODIFIER_TOKENS.cmdOrCtrl} ,` },
  { id: "toggle-sidebar", label: "Toggle Sidebar", keys: `${MODIFIER_TOKENS.cmdOrCtrl} \\` },
  { id: "navigate-back", label: "Navigate Back", keys: `${MODIFIER_TOKENS.cmdOrCtrl} [` },
  { id: "navigate-forward", label: "Navigate Forward", keys: `${MODIFIER_TOKENS.cmdOrCtrl} ]` },
  {
    id: "focus-mode",
    label: "Toggle Focus Mode",
    keys: `${MODIFIER_TOKENS.shift} ${MODIFIER_TOKENS.cmdOrCtrl} F`,
  },
];

export function getPrimaryShortcutPrefix(platform?: string): string {
  return isMacPlatform(platform) ? MODIFIER_TOKENS.cmdOrCtrl : MODIFIER_TOKENS.ctrl;
}

export const MAX_DIRECT_NOTE_TAB_SHORTCUTS = 9;

export function getDirectTabShortcutDisplay(
  index: number,
  totalTabs: number,
  platform?: string,
): string | undefined {
  if (index < 0 || totalTabs <= 0) {
    return undefined;
  }

  if (totalTabs <= MAX_DIRECT_NOTE_TAB_SHORTCUTS) {
    if (index >= totalTabs) {
      return undefined;
    }

    return `${getPrimaryShortcutPrefix(platform)}${index + 1}`;
  }

  if (index < MAX_DIRECT_NOTE_TAB_SHORTCUTS - 1) {
    return `${getPrimaryShortcutPrefix(platform)}${index + 1}`;
  }

  if (index === totalTabs - 1) {
    return `${getPrimaryShortcutPrefix(platform)}${MAX_DIRECT_NOTE_TAB_SHORTCUTS}`;
  }

  return undefined;
}

export function getDirectTabTargetIndex(requestedIndex: number, totalTabs: number): number | null {
  if (requestedIndex < 0 || totalTabs <= 0) {
    return null;
  }

  if (totalTabs <= MAX_DIRECT_NOTE_TAB_SHORTCUTS) {
    return requestedIndex < totalTabs ? requestedIndex : null;
  }

  if (requestedIndex < MAX_DIRECT_NOTE_TAB_SHORTCUTS - 1) {
    return requestedIndex;
  }

  return requestedIndex === MAX_DIRECT_NOTE_TAB_SHORTCUTS - 1 ? totalTabs - 1 : null;
}

export function getAdjacentTabShortcutDisplay(
  direction: "next" | "previous",
  platform?: string,
): string {
  if (isMacPlatform(platform)) {
    return direction === "next" ? "⇧⌘]" : "⇧⌘[";
  }

  return direction === "next" ? "Ctrl+Tab" : "Ctrl+Shift+Tab";
}

export function matchAdjacentTabShortcut(
  event: ShortcutEventLike,
  direction: "next" | "previous",
  platform?: string,
): boolean {
  return matchShortcut(
    event,
    isMacPlatform(platform)
      ? `⇧ ⌘ ${direction === "next" ? "]" : "["}`
      : `${direction === "next" ? "⌘ Tab" : "⇧ ⌘ Tab"}`,
    platform,
  );
}

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

const LEGACY_SHORTCUT_MIGRATIONS: Partial<Record<ShortcutId, string[]>> = {
  "close-other-tabs": ["⌥ ⌘ W"],
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
      .map((shortcut) => {
        const normalizedKeys = canonicalizeShortcut(shortcut.keys) ?? shortcut.keys.trim();
        const shortcutId = shortcut.id as ShortcutId;
        const legacyKeys = LEGACY_SHORTCUT_MIGRATIONS[shortcutId];

        if (legacyKeys?.some((legacyKey) => canonicalizeShortcut(legacyKey) === normalizedKeys)) {
          const migratedDefault = DEFAULT_SHORTCUTS.find((entry) => entry.id === shortcutId)?.keys;
          return [shortcut.id, migratedDefault ?? normalizedKeys];
        }

        return [shortcut.id, normalizedKeys];
      }),
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
  platform?: string,
): string | undefined {
  const keys = getShortcutKeys(shortcuts, id);
  if (!keys) {
    return undefined;
  }

  return formatKeysForPlatform(keys, platform);
}

/**
 * Returns true when the platform's primary modifier is pressed — `Meta` (⌘)
 * on macOS, `Ctrl` on Windows/Linux — without the other modifier also being
 * held. The platform string should come from `navigator.platform` (renderer)
 * or `process.platform` (main process).
 */
export function isPrimaryModifierPressed(event: ShortcutEventLike, platform?: string): boolean {
  const isMac = isMacPlatform(platform);

  if (isMac) {
    return event.metaKey && !event.ctrlKey;
  }

  return event.ctrlKey && !event.metaKey;
}

export function matchShortcut(
  event: ShortcutEventLike,
  shortcut: string,
  platform?: string,
): boolean {
  if (event.repeat) {
    return false;
  }

  const parsed = parseShortcut(shortcut);
  if (!parsed) {
    return false;
  }

  const eventKey = normalizeShortcutKeyToken(event.key);
  const primaryPressed = isPrimaryModifierPressed(event, platform);

  return (
    eventKey === parsed.key &&
    primaryPressed === parsed.primary &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift
  );
}

/**
 * Split a platform-display shortcut string into individual key tokens for
 * rendering in `<kbd>` elements.
 *
 * - macOS  compact symbols: "⇧⌘N" → ["⇧", "⌘", "N"]
 * - Windows text form:      "Ctrl+Shift+N" → ["Ctrl", "Shift", "N"]
 */
export function splitShortcutTokens(shortcut: string): string[] {
  if (shortcut.includes("+")) {
    return shortcut.split("+").filter(Boolean);
  }

  return shortcut.split("");
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
