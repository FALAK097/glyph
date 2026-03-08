import type { SearchResult } from "../shared/workspace";

type SearchPanelProps = {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onOpenResult: (result: SearchResult) => void;
};

export function SearchPanel({
  query,
  results,
  isLoading,
  isOpen,
  onChangeQuery,
  onClose,
  onOpenResult
}: SearchPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="search-panel">
      <div className="search-header">
        <div>
          <p className="panel-label">Global Search</p>
          <h2>Search this workspace</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <input
        aria-label="Search workspace"
        className="search-input"
        type="search"
        placeholder="Search markdown files..."
        value={query}
        onChange={(event) => onChangeQuery(event.target.value)}
      />
      <div className="search-results">
        {isLoading ? <p className="search-empty">Searching...</p> : null}
        {!isLoading && !query.trim() ? <p className="search-empty">Type to search across the opened workspace.</p> : null}
        {!isLoading && query.trim() && results.length === 0 ? (
          <p className="search-empty">No results found for “{query}”.</p>
        ) : null}
        {!isLoading &&
          results.map((result) => (
            <button key={`${result.path}:${result.line}:${result.snippet}`} className="search-result" type="button" onClick={() => onOpenResult(result)}>
              <div className="search-result-top">
                <strong>{result.name}</strong>
                <span>Line {result.line}</span>
              </div>
              <p>{result.snippet || "Match found in file."}</p>
            </button>
          ))}
      </div>
    </section>
  );
}
