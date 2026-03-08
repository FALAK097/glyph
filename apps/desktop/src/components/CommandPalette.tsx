type CommandPaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
  kind: "command" | "file" | "theme";
  onSelect: () => void;
  onPreview?: () => void;
};

type CommandPaletteProps = {
  isOpen: boolean;
  query: string;
  items: CommandPaletteItem[];
  selectedIndex: number;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onMove: (direction: 1 | -1) => void;
  onSelect: () => void;
};

export function CommandPalette({
  isOpen,
  query,
  items,
  selectedIndex,
  onChangeQuery,
  onClose,
  onMove,
  onSelect
}: CommandPaletteProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="modal-shell">
      <div className="modal-card palette-card">
        <div className="palette-input-row">
          <input
            className="palette-input"
            placeholder="Search files, commands, and themes"
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                onMove(1);
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                onMove(-1);
              }

              if (event.key === "Enter") {
                event.preventDefault();
                onSelect();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
          <button className="icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="palette-list">
          {items.map((item, index) => (
            <button
              key={item.id}
              className={`palette-item ${selectedIndex === index ? "is-active" : ""}`}
              type="button"
              onMouseEnter={item.onPreview}
              onClick={item.onSelect}
            >
              <span>{item.title}</span>
              {item.subtitle ? <small>{item.subtitle}</small> : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
