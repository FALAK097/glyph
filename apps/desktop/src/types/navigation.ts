export type BreadcrumbItem = {
  id: string;
  label: string;
  path: string;
};

export type OutlineItem = {
  id: string;
  depth: number;
  title: string;
  line: number;
};

export type NoteShortcutItem = {
  path: string;
  title: string;
  subtitle: string;
  badge?: string;
};
