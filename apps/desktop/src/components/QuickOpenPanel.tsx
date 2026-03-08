type QuickOpenItem = {
  path: string;
  name: string;
  relativePath: string;
};

type QuickOpenPanelProps = {
  query: string;
  items: QuickOpenItem[];
  isOpen: boolean;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onOpenItem: (item: QuickOpenItem) => void;
};

export function QuickOpenPanel({
  query,
  items,
  isOpen,
  onChangeQuery,
  onClose,
  onOpenItem
}: QuickOpenPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="search-panel">
      <div className="search-header">
        <div>
          <p className="panel-label">Quick Open</p>
          <h2>Jump to a file</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <input
        className="search-input"
        placeholder="Type a file name..."
        value={query}
        onChange={(event) => onChangeQuery(event.target.value)}
      />
      <div className="search-results">
        {!query.trim() ? <p className="search-empty">Type to filter files in the current workspace.</p> : null}
        {query.trim() && items.length === 0 ? <p className="search-empty">No files match “{query}”.</p> : null}
        {items.map((item) => (
          <button key={item.path} className="search-result" type="button" onClick={() => onOpenItem(item)}>
            <div className="search-result-top">
              <strong>{item.name}</strong>
            </div>
            <p>{item.relativePath}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
