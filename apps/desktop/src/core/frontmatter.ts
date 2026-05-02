import { parseDocument } from "yaml";

export type ParsedMarkdownFrontmatter = {
  frontmatterText: string | null;
  body: string;
};

export function parseMarkdownFrontmatter(content: string): ParsedMarkdownFrontmatter {
  const normalizedContent = content.replace(/\r\n?/g, "\n");
  const lines = normalizedContent.split("\n");

  if (lines[0] !== "---") {
    return { frontmatterText: null, body: normalizedContent };
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex <= 0) {
    return { frontmatterText: null, body: normalizedContent };
  }

  const frontmatterText = lines.slice(1, endIndex).join("\n");

  return {
    frontmatterText: frontmatterText.length > 0 ? frontmatterText : null,
    body: lines
      .slice(endIndex + 1)
      .join("\n")
      .trimStart(),
  };
}

export function serializeMarkdownFrontmatter({
  frontmatterText,
  body,
}: {
  frontmatterText: string | null;
  body: string;
}) {
  const normalizedFrontmatter = (frontmatterText ?? "").replace(/\r\n?/g, "\n");
  const normalizedBody = body.replace(/\r\n?/g, "\n").replace(/^\n+/, "");

  if (!normalizedFrontmatter.trim()) {
    return normalizedBody;
  }

  if (!normalizedBody) {
    return `---\n${normalizedFrontmatter}\n---\n`;
  }

  return `---\n${normalizedFrontmatter}\n---\n\n${normalizedBody}`;
}

export function formatMarkdownFrontmatter(frontmatterText: string) {
  const normalizedFrontmatter = frontmatterText.replace(/\r\n?/g, "\n").trim();
  if (!normalizedFrontmatter) {
    return "";
  }

  const document = parseDocument(normalizedFrontmatter, {
    merge: true,
    prettyErrors: false,
    strict: false,
    uniqueKeys: false,
  });

  if (document.errors.length > 0) {
    return null;
  }

  return document
    .toString({
      collectionStyle: "block",
      indent: 2,
      lineWidth: 0,
      minContentWidth: 20,
    })
    .trim();
}
