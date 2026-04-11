import remarkParse from "remark-parse";
import { unified } from "unified";

import changelogSource from "../../../CHANGELOG.md?raw";

type InlineToken =
  | {
      type: "code";
      value: string;
    }
  | {
      href: string;
      type: "link";
      value: string;
    }
  | {
      type: "text";
      value: string;
    };

type ChangelogItem = {
  children: ChangelogItem[];
  tokens: InlineToken[];
};

type ChangelogSection = {
  items: ChangelogItem[];
  title: string;
};

type ChangelogRelease = {
  compareHref: string | null;
  date: string;
  sections: ChangelogSection[];
  version: string;
};

type MarkdownTextNode = {
  type: "text";
  value: string;
};

type MarkdownInlineCodeNode = {
  type: "inlineCode";
  value: string;
};

type MarkdownBreakNode = {
  type: "break";
};

type MarkdownLinkNode = {
  children: MarkdownInlineNode[];
  type: "link";
  url: string;
};

type MarkdownContainerInlineNode = {
  children: MarkdownInlineNode[];
  type: "delete" | "emphasis" | "strong";
};

type MarkdownInlineNode =
  | MarkdownBreakNode
  | MarkdownContainerInlineNode
  | MarkdownInlineCodeNode
  | MarkdownLinkNode
  | MarkdownTextNode;

type MarkdownParagraphNode = {
  children: MarkdownInlineNode[];
  type: "paragraph";
};

type MarkdownListNode = {
  children: MarkdownListItemNode[];
  type: "list";
};

type MarkdownListItemNode = {
  children: MarkdownBlockNode[];
  type: "listItem";
};

type MarkdownHeadingNode = {
  children: MarkdownInlineNode[];
  depth: number;
  type: "heading";
};

type MarkdownBlockNode = MarkdownHeadingNode | MarkdownListNode | MarkdownParagraphNode;

type MarkdownRoot = {
  children: MarkdownBlockNode[];
  type: "root";
};

const changelogParser = unified().use(remarkParse);

function extractPlainText(nodes: MarkdownInlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "inlineCode") {
        return node.value;
      }

      if (node.type === "break") {
        return " ";
      }

      return extractPlainText(node.children);
    })
    .join("");
}

function mergeInlineTokens(tokens: InlineToken[]): InlineToken[] {
  const merged: InlineToken[] = [];

  for (const token of tokens) {
    if (token.type === "text" && token.value.length === 0) {
      continue;
    }

    const previousToken = merged.at(-1);
    if (previousToken?.type === "text" && token.type === "text") {
      previousToken.value += token.value;
      continue;
    }

    merged.push({ ...token });
  }

  return merged;
}

function stripScopePrefix(tokens: InlineToken[]): InlineToken[] {
  const normalizedTokens = mergeInlineTokens(tokens);
  const firstToken = normalizedTokens[0];

  if (firstToken?.type === "text") {
    firstToken.value = firstToken.value.replace(/^\s*[a-z0-9_-]+:\s*/i, "");
  }

  while (normalizedTokens[0]?.type === "text" && normalizedTokens[0].value.length === 0) {
    normalizedTokens.shift();
  }

  const firstRemainingToken = normalizedTokens[0];
  if (firstRemainingToken?.type === "text") {
    firstRemainingToken.value = firstRemainingToken.value.replace(/^\s+/, "");
  }

  return normalizedTokens.filter((token) => token.type !== "text" || token.value.length > 0);
}

function tokenizeInlineNodes(nodes: MarkdownInlineNode[]): InlineToken[] {
  const tokens: InlineToken[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      tokens.push({
        type: "text",
        value: node.value,
      });
      continue;
    }

    if (node.type === "inlineCode") {
      tokens.push({
        type: "code",
        value: node.value,
      });
      continue;
    }

    if (node.type === "break") {
      tokens.push({
        type: "text",
        value: " ",
      });
      continue;
    }

    if (node.type === "link") {
      const label = extractPlainText(node.children).trim();
      tokens.push({
        href: node.url,
        type: "link",
        value: label.length > 0 ? label : node.url,
      });
      continue;
    }

    tokens.push(...tokenizeInlineNodes(node.children));
  }

  return mergeInlineTokens(tokens);
}

function parseListItem(node: MarkdownListItemNode): ChangelogItem[] {
  const tokens: InlineToken[] = [];
  const children: ChangelogItem[] = [];

  for (const child of node.children) {
    if (child.type === "paragraph") {
      if (tokens.length > 0) {
        tokens.push({
          type: "text",
          value: " ",
        });
      }

      tokens.push(...tokenizeInlineNodes(child.children));
      continue;
    }

    if (child.type === "list") {
      children.push(...child.children.flatMap((listItem) => parseListItem(listItem)));
    }
  }

  const normalizedTokens = stripScopePrefix(tokens);
  if (normalizedTokens.length === 0) {
    return children;
  }

  return [
    {
      children,
      tokens: normalizedTokens,
    },
  ];
}

function extractRelease(heading: MarkdownHeadingNode): ChangelogRelease | null {
  const headingText = extractPlainText(heading.children).trim();
  const dateMatch = headingText.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/);

  if (!dateMatch) {
    return null;
  }

  const compareLink = heading.children.find(
    (child): child is MarkdownLinkNode => child.type === "link",
  );
  const versionSource = compareLink ? extractPlainText(compareLink.children) : headingText;
  const version = versionSource.replace(/^v/i, "").trim();

  if (version.length === 0) {
    return null;
  }

  return {
    compareHref: compareLink?.url ?? null,
    date: dateMatch[1],
    sections: [],
    version,
  };
}

function parseChangelog(markdown: string): ChangelogRelease[] {
  const tree = changelogParser.parse(markdown) as MarkdownRoot;
  const releases: ChangelogRelease[] = [];
  let currentRelease: ChangelogRelease | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const node of tree.children) {
    if (node.type === "heading" && node.depth === 2) {
      currentRelease = extractRelease(node);
      currentSection = null;

      if (currentRelease) {
        releases.push(currentRelease);
      }

      continue;
    }

    if (!currentRelease) {
      continue;
    }

    if (node.type === "heading" && node.depth === 3) {
      const title = extractPlainText(node.children).trim();
      if (title.length === 0) {
        currentSection = null;
        continue;
      }

      currentSection = {
        items: [],
        title,
      };
      currentRelease.sections.push(currentSection);
      continue;
    }

    if (node.type === "list" && currentSection) {
      currentSection.items.push(...node.children.flatMap((listItem) => parseListItem(listItem)));
    }
  }

  return releases
    .map((release) => ({
      ...release,
      sections: release.sections.filter((section) => section.items.length > 0),
    }))
    .filter((release) => release.sections.length > 0);
}

function formatReleaseDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);

  return {
    day: new Intl.DateTimeFormat("en-US", { day: "2-digit", timeZone: "UTC" }).format(value),
    long: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(value),
    month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(value),
    year: new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }).format(value),
  };
}

function renderInlineTokens(tokens: InlineToken[], keyPrefix: string) {
  return tokens.map((token, index) => {
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

function renderChangelogItems(items: ChangelogItem[], keyPrefix: string, nested = false) {
  return (
    <ul className={nested ? "mt-3 space-y-3 border-l border-black/8 pl-5" : "space-y-3"}>
      {items.map((item, index) => {
        const itemKey = `${keyPrefix}-${index}`;

        return (
          <li key={itemKey} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-3 h-1.5 w-1.5 rounded-full bg-[var(--ink-muted)]"
            />
            <div className="min-w-0">
              <p className="min-w-0 text-[0.97rem] leading-7 text-[var(--ink-soft)]">
                {renderInlineTokens(item.tokens, itemKey)}
              </p>
              {item.children.length > 0 ? renderChangelogItems(item.children, itemKey, true) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const releases = parseChangelog(changelogSource);

export function ChangelogPage() {
  return (
    <>
      <section className="mx-auto max-w-screen-2xl px-6 pb-14 pt-16 sm:px-8 sm:pb-18 sm:pt-20 lg:px-12 lg:pb-20 lg:pt-24">
        <div className="mx-auto max-w-5xl text-center">
          <span className="hero-kicker">Release History</span>
          <h1 id="main-content" className="hero-display mx-auto mt-6 max-w-[12ch] text-balance">
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

                        {renderChangelogItems(section.items, `${release.version}-${section.title}`)}
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
