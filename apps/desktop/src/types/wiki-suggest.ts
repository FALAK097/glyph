export type WikiSuggestItem = {
  id: string;
  title: string;
  path: string;
  icon?: string | null;
};

export type WikiSuggestListProps = {
  items: WikiSuggestItem[];
  onSelect: (item: WikiSuggestItem) => void;
};

export type WikiSuggestListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};
