import { parseDocument } from "yaml";

export const SKILL_FILE_NAME = "SKILL.md";
export const AGENTS_FILE_NAME = "AGENTS.md";

export type SkillSourceKind =
  | "codex"
  | "agents"
  | "claude"
  | "cursor"
  | "opencode"
  | "windsurf"
  | "amp"
  | "gemini"
  | "copilot"
  | "kimi"
  | "kiro"
  | "kilocode"
  | "mistral"
  | "openclaw"
  | "warp"
  | "pi"
  | "augment"
  | "bob"
  | "codebuddy"
  | "commandcode"
  | "continue"
  | "cortex"
  | "crush"
  | "factory"
  | "goose"
  | "junie"
  | "iflow"
  | "kode"
  | "mcpjam"
  | "mux"
  | "openhands"
  | "qoder"
  | "qwen"
  | "roo"
  | "trae"
  | "zencoder"
  | "neovate"
  | "pochi"
  | "adal"
  | "project";

export type SkillToolKind = Exclude<SkillSourceKind, "agents" | "project">;

export type SkillMetadataScalar = string | number | boolean | null;
export type SkillMetadataValue =
  | SkillMetadataScalar
  | SkillMetadataValue[]
  | {
      [key: string]: SkillMetadataValue;
    };

export type SkillSource = {
  id: string;
  kind: SkillSourceKind;
  name: string;
  rootPath: string;
  description: string | null;
  isReadOnly: boolean;
  skillCount: number;
};

export type SkillEntry = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  version: string | null;
  tags: string[];
  sourceId: string;
  sourceName: string;
  sourceKind: SkillSourceKind;
  compatibleToolKinds: SkillToolKind[];
  sourceRootPath: string;
  directoryPath: string;
  resolvedDirectoryPath: string;
  skillFilePath: string;
  agentsFilePath: string | null;
  isReadOnly: boolean;
  hasAgentsFile: boolean;
  hasScripts: boolean;
  hasAssets: boolean;
  hasReferences: boolean;
  hasRules: boolean;
  hasExamples: boolean;
  lastModifiedAt: string | null;
  frontmatter: Record<string, SkillMetadataValue>;
};

export type SkillDocumentKind = "skill" | "agents";

export type SkillDocument = {
  kind: SkillDocumentKind;
  path: string;
  name: string;
  content: string;
  isEditable: boolean;
  lastModifiedAt: string | null;
};

export type SkillLibrarySnapshot = {
  sources: SkillSource[];
  skills: SkillEntry[];
  scannedAt: string;
};

export type SkillLibraryChangeEvent = {
  snapshot: SkillLibrarySnapshot;
  changedPaths: string[];
};

export type ParsedSkillDocument = {
  frontmatter: Record<string, SkillMetadataValue>;
  frontmatterText: string | null;
  body: string;
  title: string | null;
  description: string | null;
  tags: string[];
};

export function getSkillMetadataValue(
  frontmatter: Record<string, SkillMetadataValue>,
  ...paths: string[][]
): SkillMetadataValue | undefined {
  for (const path of paths) {
    let current: SkillMetadataValue | Record<string, SkillMetadataValue> | undefined = frontmatter;

    for (const segment of path) {
      if (!current || Array.isArray(current) || typeof current !== "object") {
        current = undefined;
        break;
      }

      current = current[segment];
    }

    if (current !== undefined) {
      return current;
    }
  }

  return undefined;
}

export function getSkillMetadataString(
  frontmatter: Record<string, SkillMetadataValue>,
  ...paths: string[][]
) {
  const value = getSkillMetadataValue(frontmatter, ...paths);

  if (typeof value === "string") {
    return value.trim().length > 0 ? value.trim() : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

export function serializeSkillDocument({
  frontmatterText,
  body,
}: {
  frontmatterText: string | null;
  body: string;
}) {
  const normalizedFrontmatter = (frontmatterText ?? "").replace(/\r\n?/g, "\n").trim();
  const normalizedBody = body.replace(/\r\n?/g, "\n").replace(/^\n+/, "");

  if (!normalizedFrontmatter) {
    return normalizedBody;
  }

  if (!normalizedBody) {
    return `---\n${normalizedFrontmatter}\n---\n`;
  }

  return `---\n${normalizedFrontmatter}\n---\n\n${normalizedBody}`;
}

function normalizeFrontmatterValue(value: unknown): SkillMetadataValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFrontmatterValue(entry));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeFrontmatterValue(entry)]),
    );
  }

  return String(value);
}

function parseFrontmatter(frontmatterText: string) {
  if (!frontmatterText.trim()) {
    return {};
  }

  try {
    const document = parseDocument(frontmatterText, {
      merge: true,
      prettyErrors: false,
      strict: false,
      uniqueKeys: false,
    });

    if (document.errors.length > 0) {
      return {};
    }

    const value = document.toJS({
      mapAsMap: false,
      maxAliasCount: 50,
    });

    if (!value || Array.isArray(value) || typeof value !== "object") {
      return {};
    }

    return normalizeFrontmatterValue(value) as Record<string, SkillMetadataValue>;
  } catch {
    return {};
  }
}

function splitTagString(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toStringArray(value: SkillMetadataValue | undefined): string[] {
  if (typeof value === "string") {
    return splitTagString(value);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return splitTagString(entry);
    }

    return [];
  });
}

function normalizeTags(frontmatter: Record<string, SkillMetadataValue>) {
  const tagSources = [
    getSkillMetadataValue(frontmatter, ["tags"]),
    getSkillMetadataValue(frontmatter, ["keywords"]),
    getSkillMetadataValue(frontmatter, ["metadata", "tags"]),
    getSkillMetadataValue(frontmatter, ["metadata", "keywords"]),
  ];

  return Array.from(
    new Set(tagSources.flatMap((value) => toStringArray(value)).map((tag) => tag.toLowerCase())),
  );
}

function extractBodyTitle(body: string) {
  const lines = body.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("#")) {
      return trimmed.replace(/^#+\s*/, "").trim() || null;
    }
  }

  return null;
}

function extractBodyDescription(body: string) {
  const lines = body.split("\n");
  const paragraph: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (paragraph.length > 0) {
        break;
      }

      continue;
    }

    if (trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed.startsWith("```")) {
      if (paragraph.length > 0) {
        break;
      }

      continue;
    }

    paragraph.push(trimmed.replace(/[*_`>#-]/g, "").trim());
  }

  const summary = paragraph.join(" ").replace(/\s+/g, " ").trim();
  return summary || null;
}

export function parseSkillDocument(content: string): ParsedSkillDocument {
  const normalizedContent = content.replace(/\r\n?/g, "\n");
  const lines = normalizedContent.split("\n");
  let frontmatter: Record<string, SkillMetadataValue> = {};
  let body = normalizedContent;
  let frontmatterText: string | null = null;

  if (lines[0] === "---") {
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

    if (endIndex > 0) {
      const frontmatterLines = lines.slice(1, endIndex);
      frontmatterText = frontmatterLines.join("\n").trim() || null;
      frontmatter = frontmatterText ? parseFrontmatter(frontmatterText) : {};

      body = lines
        .slice(endIndex + 1)
        .join("\n")
        .trimStart();
    }
  }

  const titleFromFrontmatter = getSkillMetadataString(
    frontmatter,
    ["name"],
    ["title"],
    ["metadata", "name"],
    ["metadata", "title"],
  );
  const descriptionFromFrontmatter = getSkillMetadataString(
    frontmatter,
    ["description"],
    ["summary"],
    ["metadata", "description"],
    ["metadata", "summary"],
  );
  const tags = normalizeTags(frontmatter);

  return {
    frontmatter,
    frontmatterText,
    body,
    title: titleFromFrontmatter ?? extractBodyTitle(body),
    description: descriptionFromFrontmatter ?? extractBodyDescription(body),
    tags,
  };
}
