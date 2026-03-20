import type { SearchResult } from "../shared/workspace";

export type SearchPanelProps = {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onOpenResult: (result: SearchResult) => void;
};
