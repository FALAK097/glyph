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
  | "project";

export type SkillMetadataValue = string | number | boolean;

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
  sourceId: string;
  sourceName: string;
  sourceKind: SkillSourceKind;
  sourceRootPath: string;
  directoryPath: string;
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
};

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

function parseFrontmatterValue(rawValue: string): SkillMetadataValue {
  const trimmed = rawValue.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  if (/^(true|false)$/i.test(unquoted)) {
    return unquoted.toLowerCase() === "true";
  }

  if (/^-?\d+(?:\.\d+)?$/.test(unquoted)) {
    return Number(unquoted);
  }

  return unquoted;
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
  const frontmatter: Record<string, SkillMetadataValue> = {};
  let body = normalizedContent;
  let frontmatterText: string | null = null;

  if (lines[0] === "---") {
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

    if (endIndex > 0) {
      const frontmatterLines = lines.slice(1, endIndex);
      frontmatterText = frontmatterLines.join("\n").trim() || null;

      for (const line of frontmatterLines) {
        const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
        if (!match) {
          continue;
        }

        frontmatter[match[1]] = parseFrontmatterValue(match[2]);
      }

      body = lines
        .slice(endIndex + 1)
        .join("\n")
        .trimStart();
    }
  }

  const titleFromFrontmatter =
    typeof frontmatter.name === "string" && frontmatter.name.trim().length > 0
      ? frontmatter.name.trim()
      : null;
  const descriptionFromFrontmatter =
    typeof frontmatter.description === "string" && frontmatter.description.trim().length > 0
      ? frontmatter.description.trim()
      : null;

  return {
    frontmatter,
    frontmatterText,
    body,
    title: titleFromFrontmatter ?? extractBodyTitle(body),
    description: descriptionFromFrontmatter ?? extractBodyDescription(body),
  };
}
