type FooterStatsProps = {
  wordCount: number;
  readingTime: number;
  fileSize?: string;
  saveState?: string;
};

export function FooterStats({ wordCount, readingTime, fileSize, saveState }: FooterStatsProps) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
      {saveState && (
        <>
          <span
            key={saveState}
            className="font-medium text-foreground animate-in fade-in duration-300 ease-out whitespace-nowrap"
          >
            {saveState}
          </span>
          <div className="w-px h-2.5 bg-border/50 shrink-0" />
        </>
      )}
      <span className="shrink-0">{wordCount} words</span>
      <div className="w-px h-2.5 bg-border/50 shrink-0" />
      <span className="shrink-0">{readingTime} min read</span>
      {fileSize && (
        <>
          <div className="w-px h-2.5 bg-border/50 shrink-0" />
          <span className="shrink-0">{fileSize}</span>
        </>
      )}
    </div>
  );
}
