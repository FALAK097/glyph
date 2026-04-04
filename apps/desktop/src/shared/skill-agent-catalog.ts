import type { SkillSourceKind, SkillToolKind } from "./skills.js";

export type SkillSourceRootTemplate = {
  base: "home" | "project";
  segments: string[];
};

export type SkillSourceCatalogEntry = {
  id: string;
  kind: SkillSourceKind;
  name: string;
  description: string;
  root: SkillSourceRootTemplate;
  isReadOnly: boolean;
  maxDepth: number;
};

export type SkillAgentCatalogEntry = {
  kind: SkillToolKind;
  label: string;
  description: string;
  supportsUniversalScope: boolean;
  globalRootSegments?: string[];
};

export const UNIVERSAL_SKILL_TOOL_KINDS: SkillToolKind[] = [
  "amp",
  "codex",
  "cursor",
  "gemini",
  "copilot",
  "kimi",
  "opencode",
  "warp",
];

export const SKILL_AGENT_CATALOG: SkillAgentCatalogEntry[] = [
  {
    kind: "codex",
    label: "Codex",
    description: "Codex-specific local skills",
    supportsUniversalScope: true,
    globalRootSegments: [".codex", "skills"],
  },
  {
    kind: "claude",
    label: "Claude Code",
    description: "Claude Code skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".claude", "skills"],
  },
  {
    kind: "cursor",
    label: "Cursor",
    description: "Cursor agent skills on this machine",
    supportsUniversalScope: true,
    globalRootSegments: [".cursor", "skills"],
  },
  {
    kind: "opencode",
    label: "OpenCode",
    description: "OpenCode skills on this machine",
    supportsUniversalScope: true,
    globalRootSegments: [".config", "opencode", "skills"],
  },
  {
    kind: "windsurf",
    label: "Windsurf",
    description: "Windsurf agent skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".windsurf", "skills"],
  },
  {
    kind: "amp",
    label: "Amp",
    description: "Amp agent skills on this machine",
    supportsUniversalScope: true,
    globalRootSegments: [".amp", "skills"],
  },
  {
    kind: "gemini",
    label: "Gemini CLI",
    description: "Gemini CLI skills on this machine",
    supportsUniversalScope: true,
    globalRootSegments: [".gemini", "skills"],
  },
  {
    kind: "copilot",
    label: "GitHub Copilot",
    description: "Universal skills compatible with GitHub Copilot",
    supportsUniversalScope: true,
  },
  {
    kind: "kimi",
    label: "Kimi CLI",
    description: "Universal skills compatible with Kimi Code CLI",
    supportsUniversalScope: true,
  },
  {
    kind: "warp",
    label: "Warp",
    description: "Universal skills compatible with Warp",
    supportsUniversalScope: true,
  },
  {
    kind: "kiro",
    label: "Kiro",
    description: "Kiro CLI skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".kiro", "skills"],
  },
  {
    kind: "kilocode",
    label: "Kilo Code",
    description: "Kilo Code skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".kilocode", "skills"],
  },
  {
    kind: "mistral",
    label: "Mistral",
    description: "Mistral Vibe skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".vibe", "skills"],
  },
  {
    kind: "pi",
    label: "Pi",
    description: "Pi skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".pi", "agent", "skills"],
  },
  {
    kind: "openclaw",
    label: "OpenClaw",
    description: "OpenClaw skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".openclaw", "skills"],
  },
  {
    kind: "augment",
    label: "Augment",
    description: "Augment skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".augment", "skills"],
  },
  {
    kind: "bob",
    label: "IBM Bob",
    description: "IBM Bob skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".bob", "skills"],
  },
  {
    kind: "codebuddy",
    label: "CodeBuddy",
    description: "CodeBuddy skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".codebuddy", "skills"],
  },
  {
    kind: "commandcode",
    label: "Command Code",
    description: "Command Code skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".commandcode", "skills"],
  },
  {
    kind: "continue",
    label: "Continue",
    description: "Continue skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".continue", "skills"],
  },
  {
    kind: "cortex",
    label: "Cortex Code",
    description: "Cortex Code skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".cortex", "skills"],
  },
  {
    kind: "crush",
    label: "Crush",
    description: "Crush skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".config", "crush", "skills"],
  },
  {
    kind: "factory",
    label: "Droid",
    description: "Droid skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".factory", "skills"],
  },
  {
    kind: "goose",
    label: "Goose",
    description: "Goose skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".goose", "skills"],
  },
  {
    kind: "junie",
    label: "Junie",
    description: "Junie skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".junie", "skills"],
  },
  {
    kind: "iflow",
    label: "iFlow CLI",
    description: "iFlow CLI skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".iflow", "skills"],
  },
  {
    kind: "kode",
    label: "Kode",
    description: "Kode skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".kode", "skills"],
  },
  {
    kind: "mcpjam",
    label: "MCPJam",
    description: "MCPJam skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".mcpjam", "skills"],
  },
  {
    kind: "mux",
    label: "Mux",
    description: "Mux skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".mux", "skills"],
  },
  {
    kind: "openhands",
    label: "OpenHands",
    description: "OpenHands skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".openhands", "skills"],
  },
  {
    kind: "qoder",
    label: "Qoder",
    description: "Qoder skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".qoder", "skills"],
  },
  {
    kind: "qwen",
    label: "Qwen Code",
    description: "Qwen Code skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".qwen", "skills"],
  },
  {
    kind: "roo",
    label: "Roo Code",
    description: "Roo Code skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".roo", "skills"],
  },
  {
    kind: "trae",
    label: "Trae",
    description: "Trae skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".trae", "skills"],
  },
  {
    kind: "zencoder",
    label: "Zencoder",
    description: "Zencoder skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".zencoder", "skills"],
  },
  {
    kind: "neovate",
    label: "Neovate",
    description: "Neovate skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".neovate", "skills"],
  },
  {
    kind: "pochi",
    label: "Pochi",
    description: "Pochi skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".pochi", "skills"],
  },
  {
    kind: "adal",
    label: "AdaL",
    description: "AdaL skills on this machine",
    supportsUniversalScope: false,
    globalRootSegments: [".adal", "skills"],
  },
];

export const SKILL_AGENT_CATALOG_BY_KIND = new Map(
  SKILL_AGENT_CATALOG.map((entry) => [entry.kind, entry] as const),
);

export const SKILL_SOURCE_CATALOG: SkillSourceCatalogEntry[] = [
  {
    id: "agents-global",
    kind: "agents",
    name: "Global",
    description: "Editable universal skills shared across supported tools",
    root: {
      base: "home",
      segments: [".agents", "skills"],
    },
    isReadOnly: false,
    maxDepth: 3,
  },
  {
    id: "project-skills",
    kind: "project",
    name: "Project",
    description: "Universal skills installed inside the active project",
    root: {
      base: "project",
      segments: [".agents", "skills"],
    },
    isReadOnly: false,
    maxDepth: 3,
  },
  ...SKILL_AGENT_CATALOG.filter((entry) => entry.globalRootSegments).map((entry) => ({
    id: `${entry.kind}-user`,
    kind: entry.kind,
    name: entry.label,
    description: entry.description,
    root: {
      base: "home" as const,
      segments: entry.globalRootSegments ?? [],
    },
    isReadOnly: false,
    maxDepth: 3,
  })),
];

export function getUniversalCompatibleToolKinds() {
  return [...UNIVERSAL_SKILL_TOOL_KINDS];
}

export function getCatalogEntryForTool(kind: SkillSourceKind | SkillToolKind) {
  return SKILL_AGENT_CATALOG_BY_KIND.get(kind as SkillToolKind) ?? null;
}
