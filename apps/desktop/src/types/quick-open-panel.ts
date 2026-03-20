export type QuickOpenItem = {
  path: string;
  name: string;
  relativePath: string;
};

export type QuickOpenPanelProps = {
  query: string;
  items: QuickOpenItem[];
  isOpen: boolean;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onOpenItem: (item: QuickOpenItem) => void;
};
