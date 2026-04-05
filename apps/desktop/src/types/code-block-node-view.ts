export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "plaintext",
  "bash",
  "dockerfile",
  "json",
  "yaml",
  "sql",
  "go",
  "rust",
  "markdown",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
