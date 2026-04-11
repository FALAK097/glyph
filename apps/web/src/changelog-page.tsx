import changelogSource from "../../../CHANGELOG.md?raw";

type InlineToken =
  | {
      type: "code";
      value: string;
    }
  | {
      type: "link";
      href: string;
      value: string;
    }
  | {
      type: "text";
      value: string;
    };

type ChangelogSection = {
  title: string;
  items: string[];
};

type ChangelogRelease = {
  compareHref: string | null;
  date: string;
  sections: ChangelogSection[];
  version: string;
};

const VERSION_LINE_REGEX = /^## \[([^\]]+)\]\(([^)]+)\) \((\d{4}-\d{2}-\d{2})\)$/;
const SECTION_LINE_REGEX = /^### (.+)$/;
const LIST_ITEM_REGEX = /^\* (.+)$/;
const INLINE_TOKEN_REGEX = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let currentRelease: ChangelogRelease | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const versionMatch = line.match(VERSION_LINE_REGEX);

    if (versionMatch) {
      currentRelease = {
        version: versionMatch[1],
        compareHref: versionMatch[2],
        date: versionMatch[3],
        sections: [],
      };
      releases.push(currentRelease);
      currentSection = null;
      continue;
    }

    if (!currentRelease) {
      continue;
    }

    const sectionMatch = line.match(SECTION_LINE_REGEX);
    if (sectionMatch) {
      currentSection = {
        title: sectionMatch[1],
        items: [],
      };
      currentRelease.sections.push(currentSection);
      continue;
    }

    const itemMatch = line.match(LIST_ITEM_REGEX);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1]);
    }
  }

  return releases.filter((release) => release.sections.length > 0);
}

function normalizeChangelogItem(value: string): string {
  return value
    .replace(/^\*\*[^*]+:\*\*\s*/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^-+\s*/, "")
    .trim();
}

function tokenizeInlineMarkdown(value: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(INLINE_TOKEN_REGEX)) {
    const fullMatch = match[0];
    const codeValue = match[1];
    const label = match[2];
    const href = match[3];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      tokens.push({
        type: "text",
        value: value.slice(lastIndex, matchIndex),
      });
    }

    if (codeValue) {
      tokens.push({
        type: "code",
        value: codeValue,
      });
    } else if (href && label) {
      tokens.push({
        type: "link",
        href,
        value: label,
      });
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < value.length) {
    tokens.push({
      type: "text",
      value: value.slice(lastIndex),
    });
  }

  return tokens.length > 0
    ? tokens
    : [
        {
          type: "text",
          value,
        },
      ];
}

function formatReleaseDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);

  return {
    day: new Intl.DateTimeFormat("en-US", { day: "2-digit", timeZone: "UTC" }).format(value),
    month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(value),
    year: new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }).format(value),
    long: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(value),
  };
}

function renderInlineMarkdown(value: string, keyPrefix: string) {
  return tokenizeInlineMarkdown(normalizeChangelogItem(value)).map((token, index) => {
    if (token.type === "text") {
      return <span key={`${keyPrefix}-${index}`}>{token.value}</span>;
    }

    if (token.type === "code") {
      return (
        <code key={`${keyPrefix}-${index}`} className="timeline-inline-code">
          {token.value}
        </code>
      );
    }

    return (
      <a
        key={`${keyPrefix}-${index}`}
        href={token.href}
        target="_blank"
        rel="noopener noreferrer"
        className="changelog-link"
      >
        {token.value}
      </a>
    );
  });
}

const releases = parseChangelog(changelogSource);

export function ChangelogPage() {
  return (
    <>
      <section className="mx-auto max-w-screen-2xl px-6 pb-14 pt-16 sm:px-8 sm:pb-18 sm:pt-20 lg:px-12 lg:pb-20 lg:pt-24">
        <div className="mx-auto max-w-5xl text-center">
          <span className="hero-kicker">Release History</span>
          <h1 id="main-content" className="hero-display mt-6 max-w-[12ch] text-balance mx-auto">
            Every release,
            <span className="hero-display__break">
              held in <em>view</em>.
            </span>
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 pb-28 sm:px-8 lg:px-12">
        <div className="timeline-shell mx-auto max-w-6xl space-y-8 lg:space-y-10">
          {releases.map((release, releaseIndex) => {
            const releaseDate = formatReleaseDate(release.date);
            const releaseChangeCount = release.sections.reduce(
              (count, section) => count + section.items.length,
              0,
            );

            return (
              <article
                key={release.version}
                className="timeline-entry grid gap-5 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-10"
              >
                <div className="timeline-date self-start">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--ink-muted)]">
                    {releaseDate.month}
                  </p>
                  <p className="mt-2 font-display text-5xl leading-none tracking-[-0.06em] text-[var(--ink-strong)]">
                    {releaseDate.day}
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">{releaseDate.year}</p>
                </div>

                <div
                  className={`${releaseIndex === 0 ? "" : "border-t border-black/8 pt-10"} pb-2`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                      <p className="feature-card__eyebrow">Release</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <h2 className="font-display text-[clamp(2.3rem,4vw,3.7rem)] leading-none tracking-[-0.05em] text-[var(--ink-strong)]">
                          v{release.version}
                        </h2>
                        {release.compareHref ? (
                          <a
                            href={release.compareHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-link text-sm font-medium"
                          >
                            Compare on GitHub
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                        {releaseDate.long} · {releaseChangeCount} update
                        {releaseChangeCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-7">
                    {release.sections.map((section) => (
                      <section key={`${release.version}-${section.title}`}>
                        <div className="mb-4 flex items-center gap-3">
                          <span className="h-px flex-1 bg-black/8" />
                          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--ink-muted)]">
                            {section.title}
                          </h3>
                          <span className="h-px flex-1 bg-black/8" />
                        </div>

                        <ul className="space-y-3">
                          {section.items.map((item, index) => (
                            <li
                              key={`${release.version}-${section.title}-${index}`}
                              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-3 h-1.5 w-1.5 rounded-full bg-[var(--ink-muted)]"
                              />
                              <p className="min-w-0 text-[0.97rem] leading-7 text-[var(--ink-soft)]">
                                {renderInlineMarkdown(
                                  item,
                                  `${release.version}-${section.title}-${index}`,
                                )}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
