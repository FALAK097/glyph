export type CommandPaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
  hint?: string;
  shortcut?: string;
  section: string;
  kind: "command" | "file";
  onSelect: () => void;
  onPreview?: () => void;
};

export type CommandPaletteProps = {
  isOpen: boolean;
  query: string;
  items: CommandPaletteItem[];
  selectedIndex: number;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onHoverItem: (index: number) => void;
  onMove: (direction: 1 | -1) => void;
  onSelect: () => void;
};
