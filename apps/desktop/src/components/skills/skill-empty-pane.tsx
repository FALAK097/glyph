type SkillEmptyPaneProps = {
  description: string;
  title: string;
  titleLabel?: string;
};

export function SkillEmptyPane({ description, title, titleLabel = "Skills" }: SkillEmptyPaneProps) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 items-center justify-center px-10">
        <div className="mx-auto max-w-md text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {titleLabel}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
  );
}
