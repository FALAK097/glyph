export type SlashCommandItem = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  group?: string;
  icon?: string;
  shortcut?: string;
};

export type SlashCommandListProps = {
  items: SlashCommandItem[];
  onSelect: (item: SlashCommandItem) => void;
};

export type SlashCommandListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export type SlashCommandKey =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "codeblock"
  | "inlinecode"
  | "table"
  | "image"
  | "bold"
  | "italic"
  | "strike"
  | "link"
  | "rule";

export type SlashCommandWithKey = SlashCommandItem & { id: SlashCommandKey };
