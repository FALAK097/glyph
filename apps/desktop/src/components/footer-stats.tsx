type FooterStatsProps = {
  wordCount: number;
  readingTime: number;
  fileSize?: string;
  saveState?: string;
};

export function FooterStats({ wordCount, readingTime, fileSize, saveState }: FooterStatsProps) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
      <span>{wordCount} words</span>
      <div className="w-px h-2.5 bg-border/50" />
      <span>{readingTime} min read</span>
      {fileSize && (
        <>
          <div className="w-px h-2.5 bg-border/50" />
          <span>{fileSize}</span>
        </>
      )}
      {saveState && (
        <>
          <div className="w-px h-2.5 bg-border/50" />
          <span className="font-medium text-foreground">{saveState}</span>
        </>
      )}
    </div>
  );
}
