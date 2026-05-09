type AppFooterProps = {
  content: React.ReactNode;
};

export function AppFooter({ content }: AppFooterProps) {
  return (
    <div className="shrink-0 flex items-center justify-between border-t border-border/40 bg-footer px-4 py-1.5 h-8">
      <div>{/* Left side - reserved for future use */}</div>
      <div className="flex items-center gap-3">{content}</div>
    </div>
  );
}
