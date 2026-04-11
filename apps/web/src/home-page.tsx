import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppleIcon, BREW_INSTALL_COMMAND, DOWNLOAD_URLS, WindowsIcon } from "./site-config";

type Shot = {
  alt: string;
  fit?: "contain" | "cover";
  position?: string;
  src: string;
};

type FeatureSection = {
  body: string;
  eyebrow: string;
  points: string[];
  reverse?: boolean;
  shot: Shot;
  title: string;
};

type FaqItem = {
  answer: string;
  question: string;
};

type FeatureCard = {
  body: string;
  title: string;
};

const featureSections: FeatureSection[] = [
  {
    eyebrow: "Command Palette",
    title: "Everything important stays one shortcut away.",
    body: "Open notes, pin favorites, switch themes, reveal files, export documents, and move through the app without breaking the flow of writing.",
    points: [
      "Cmd/Ctrl+P at the center",
      "Pinned notes and quick actions",
      "Custom shortcuts for daily actions",
    ],
    shot: {
      src: "/command-palette.png",
      alt: "Glyph command palette and keyboard shortcuts",
    },
  },
  {
    eyebrow: "Files + Navigation",
    title: "Your notes stay organized like files, not a database.",
    body: "Glyph works with folders and markdown files you already own, then adds tabs, search, history, and pinned notes so the workspace stays easy to move through.",
    points: [
      "Folders and explorer",
      "Tabs, back/forward history, and search",
      "Local-first with no account wall",
    ],
    reverse: true,
    shot: {
      src: "/og-image.png",
      alt: "Glyph workspace with explorer and editor",
    },
  },
  {
    eyebrow: "Writing + Output",
    title: "A calm editor when you are writing, useful tools when you are done.",
    body: "Markdown stays readable with syntax highlighting and structured editing, while copy as markdown, reveal in Finder or Explorer, and PDF export stay close at hand.",
    points: [
      "Readable code blocks and markdown structure",
      "Slash-command editing flow",
      "Copy as markdown, reveal on disk, and export as PDF",
    ],
    shot: {
      src: "/syntax-highlighting.png",
      alt: "Glyph editor with syntax highlighting",
    },
  },
];

const featureCards: FeatureCard[] = [
  {
    title: "Multi-note tabs",
    body: "Keep several notes open, jump between them with shortcuts, and reorder tabs without losing your place.",
  },
  {
    title: "Direct tab shortcuts",
    body: "Move through open notes with Cmd or Ctrl plus numbers, plus adjacent-tab navigation when you are moving quickly.",
  },
  {
    title: "Global search",
    body: "Search file names, paths, and note content so large folders still feel easy to navigate.",
  },
  {
    title: "In-note find",
    body: "Find and step through matches inside the current note when you are editing longer documents.",
  },
  {
    title: "Outline and focus mode",
    body: "Jump by heading when you need structure, then hide extra interface when you want a quieter writing surface.",
  },
  {
    title: "Internal note links",
    body: "Follow note-to-note links directly in the workspace and keep your markdown connected instead of siloed.",
  },
  {
    title: "Link previews",
    body: "Preview linked notes before opening them, which makes cross-referenced writing much easier to scan.",
  },
  {
    title: "Slash commands",
    body: "Insert headings, lists, tasks, tables, links, and other markdown structure without breaking your typing rhythm.",
  },
  {
    title: "Local image insertion",
    body: "Drop images into notes and keep them close to the files they belong with on disk.",
  },
  {
    title: "Autosave and safe refresh",
    body: "Changes stay saved as you work, and the app stays in sync when files change outside Glyph.",
  },
  {
    title: "Session restore",
    body: "Return to your working context with tabs, navigation state, and the flow of the previous session intact.",
  },
  {
    title: "Copy note path",
    body: "Grab the current file path instantly when you need to share location details or jump to the file outside Glyph.",
  },
  {
    title: "Reveal on disk",
    body: "Open the current note in Finder or Explorer without leaving the editor to manually hunt through folders.",
  },
  {
    title: "PDF export",
    body: "Turn a note into a cleaner handoff when you need something easier to share, print, or archive.",
  },
  {
    title: "Settings and shortcuts",
    body: "Adjust themes, default folders, PDF behavior, and keyboard shortcuts so the app fits the way you already work.",
  },
];

const faqItems: FaqItem[] = [
  {
    question: "Does Glyph store my notes in plain markdown files?",
    answer:
      "Yes. Glyph works with plain markdown files on disk, so your notes stay portable and readable outside the app.",
  },
  {
    question: "Can I open an existing folder of notes?",
    answer:
      "Yes. You can open whole folders or individual markdown files and keep working with the structure you already use.",
  },
  {
    question: "Is Glyph local-first?",
    answer:
      "Yes. Glyph is built around local files and does not require an account or a forced cloud workflow between you and your notes.",
  },
  {
    question: "How much of the app is accessible from the keyboard?",
    answer:
      "The core workflow is keyboard-first. The command palette, customizable shortcuts, search, navigation, and many note actions are designed to stay easy to reach without leaving the keyboard.",
  },
  {
    question: "Can I export or share notes easily?",
    answer:
      "Yes. You can copy notes as markdown, reveal them in Finder or Explorer, and export them as PDF when you need a cleaner handoff.",
  },
  {
    question: "How much does it cost?",
    answer: "Glyph is completely free to use.",
  },
  {
    question: "Can I sync my notes across devices?",
    answer:
      "Yes. Because your notes are local files on disk, you can use any syncing service you like, such as iCloud, Dropbox, Google Drive, or a Git repository.",
  },
  {
    question: "What flavors of markdown are supported?",
    answer:
      "Glyph supports standard Markdown along with GitHub Flavored Markdown (GFM) features like tables, task lists, and syntax highlighting in code blocks.",
  },
  {
    question: "Does Glyph have mobile apps?",
    answer:
      "Not currently. Glyph is a desktop-first app designed specifically for macOS and Windows, focusing on a fast, keyboard-centric workflow.",
  },
];

const BREW_COMMAND_PREFIX = "brew install --cask";
const BREW_COMMAND_FORMULA = BREW_INSTALL_COMMAND.startsWith(`${BREW_COMMAND_PREFIX} `)
  ? BREW_INSTALL_COMMAND.slice(BREW_COMMAND_PREFIX.length + 1)
  : BREW_INSTALL_COMMAND;

type ShotCardProps = {
  shot: Shot;
  variant?: "default" | "hero";
};

function ShotCard({ shot, variant = "default" }: ShotCardProps) {
  return (
    <div className={`clean-shot ${variant === "hero" ? "clean-shot--hero" : ""}`}>
      <div className="clean-shot__frame">
        <img
          src={shot.src}
          alt={shot.alt}
          width="1920"
          height="1080"
          loading={variant === "hero" ? "eager" : "lazy"}
          // @ts-expect-error React 18 types might lack fetchpriority
          fetchpriority={variant === "hero" ? "high" : "auto"}
          decoding="async"
          className={`clean-shot__image ${shot.fit === "cover" ? "clean-shot__image--cover" : ""}`}
          style={shot.position ? { objectPosition: shot.position } : undefined}
        />
      </div>
    </div>
  );
}

export function HomePage() {
  const [hasCopiedBrew, setHasCopiedBrew] = useState(false);
  const [brewCopyError, setBrewCopyError] = useState(false);
  const brewFallbackInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!hasCopiedBrew) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setHasCopiedBrew(false);
    }, 2200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasCopiedBrew]);

  useEffect(() => {
    if (!brewCopyError) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const input = brewFallbackInputRef.current;
      if (!input) {
        return;
      }

      input.focus();
      input.select();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [brewCopyError]);

  const selectBrewFallbackInput = () => {
    const input = brewFallbackInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  };

  const handleCopyBrewCommand = async () => {
    try {
      await navigator.clipboard.writeText(BREW_INSTALL_COMMAND);
      setHasCopiedBrew(true);
      setBrewCopyError(false);
    } catch (error) {
      console.error("Unable to copy Homebrew install command.", error);
      setHasCopiedBrew(false);
      setBrewCopyError(true);
      window.requestAnimationFrame(() => {
        selectBrewFallbackInput();
      });
    }
  };

  return (
    <>
      <header className="mx-auto max-w-screen-2xl px-6 pb-18 pt-14 sm:px-8 sm:pb-22 lg:px-12 lg:pb-24 lg:pt-18">
        <div className="mx-auto max-w-[82rem]">
          <div className="clean-home__copy">
            <span className="clean-home__eyebrow">The Interface of Thought</span>
            <h1 id="main-content" className="clean-home__title">
              A calmer place to write in markdown.
            </h1>
            <p className="clean-home__body">
              Glyph is a local-first desktop app for plain markdown files, built around folders,
              shortcuts, and a workspace that feels easy to move through.
            </p>

            <div id="install-with-homebrew" className="clean-home__brew">
              <div className="clean-home__brew-row">
                <code className="clean-home__brew-command">
                  <span className="clean-home__brew-prefix">{BREW_COMMAND_PREFIX}</span>
                  <span className="clean-home__brew-formula">{BREW_COMMAND_FORMULA}</span>
                </code>
                <button
                  type="button"
                  aria-label={hasCopiedBrew ? "Copied command" : "Copy command"}
                  className="clean-home__brew-copy"
                  onClick={() => void handleCopyBrewCommand()}
                >
                  {hasCopiedBrew ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                </button>
              </div>

              {brewCopyError ? (
                <div className="clean-home__brew-fallback">
                  <p className="clean-home__brew-fallback-label">
                    Copy failed. Select the command manually.
                  </p>
                  <div className="clean-home__brew-fallback-row">
                    <input
                      ref={brewFallbackInputRef}
                      type="text"
                      readOnly
                      value={BREW_INSTALL_COMMAND}
                      onClick={selectBrewFallbackInput}
                      onFocus={selectBrewFallbackInput}
                      className="clean-home__brew-input"
                      aria-label="Homebrew install command"
                    />
                    <button
                      type="button"
                      className="clean-home__brew-select"
                      onClick={selectBrewFallbackInput}
                    >
                      Select
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="clean-home__stage">
            <div className="clean-home__stage-surface">
              <div className="clean-shot clean-shot--hero">
                <div className="clean-shot__frame">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="clean-shot__image clean-shot__image--cover"
                    poster="/dark-theme.png"
                  >
                    <source src="/glyph-demo.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-screen-2xl px-6 pb-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[82rem]">
          {featureSections.map((section) => (
            <article key={section.title} className="clean-section">
              <div
                className={`clean-section__grid ${
                  section.reverse ? "clean-section__grid--reverse" : ""
                }`}
              >
                <div className="clean-section__copy">
                  <span className="clean-section__eyebrow">{section.eyebrow}</span>
                  <h2 className="clean-section__title">{section.title}</h2>
                  <p className="clean-section__body">{section.body}</p>
                  <ul className="clean-list">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>

                <div className="clean-section__media">
                  <ShotCard shot={section.shot} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 pb-12 pt-4 sm:px-8 lg:px-12 lg:pb-16">
        <div className="mx-auto max-w-[82rem]">
          <article className="clean-section">
            <div className="clean-section__grid clean-section__grid--reverse">
              <div className="clean-section__copy">
                <span className="clean-section__eyebrow">Skills</span>
                <h2 className="clean-section__title">All your agents' skills in one place.</h2>
                <p className="clean-section__body">
                  Glyph allows you to view and manage all your agent skills, custom instructions,
                  and prompts together, keeping your workspace highly organized.
                </p>
                <ul className="clean-list">
                  <li>Manage custom instructions and prompts</li>
                  <li>View all agent capabilities at a glance</li>
                  <li>Keep workspace context centralized</li>
                </ul>
              </div>

              <div className="clean-section__media">
                <ShotCard
                  shot={{
                    src: "/light-theme.png",
                    alt: "Glyph skills management",
                  }}
                />
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 pb-12 pt-2 sm:px-8 lg:px-12 lg:pb-16">
        <div className="mx-auto max-w-[82rem]">
          <article className="clean-feature-grid">
            <div className="clean-feature-grid__intro">
              <span className="clean-section__eyebrow">More</span>
              <h2 className="clean-section__title">
                The rest of the workflow stays quietly useful.
              </h2>
              <p className="clean-section__body">
                The larger moments already have their own place above. These smaller pieces are the
                ones that keep everyday work moving.
              </p>
            </div>

            <div className="clean-feature-grid__cards">
              {featureCards.map((card) => (
                <article key={card.title} className="clean-feature-grid__card">
                  <h3 className="clean-feature-grid__title">{card.title}</h3>
                  <p className="clean-feature-grid__body">{card.body}</p>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 pb-20 pt-4 sm:px-8 lg:px-12 lg:pb-24">
        <div className="mx-auto max-w-[82rem]">
          <div className="clean-faq">
            <div className="clean-faq__intro">
              <span className="clean-section__eyebrow">FAQ</span>
              <h2 className="clean-section__title">A few straightforward answers.</h2>
              <p className="clean-section__body">
                The product is intentionally simple, so the questions it raises should be simple
                too.
              </p>
            </div>

            <div className="clean-faq__list">
              {faqItems.map((item, index) => (
                // @ts-expect-error React 18 types don't include defaultOpen for details
                <details key={item.question} className="clean-faq__item" defaultOpen={index === 0}>
                  <summary className="clean-faq__summary">
                    <span>{item.question}</span>
                    <span className="clean-faq__marker" aria-hidden="true" />
                  </summary>
                  <div className="clean-faq__answer">
                    <p>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="clean-closing">
            <div>
              <span className="clean-section__eyebrow">Closing</span>
              <h2 className="clean-section__title">
                Plain markdown files, with less friction around them.
              </h2>
              <p className="clean-section__body">
                Glyph is for people who want a cleaner writing surface, stronger keyboard access,
                and files that still belong to them.
              </p>
            </div>

            <div className="clean-closing__actions">
              <a href={DOWNLOAD_URLS.mac} className="download-button cursor-pointer border-0">
                <AppleIcon />
                <span>Download for macOS</span>
              </a>
              <a
                href={DOWNLOAD_URLS.windows}
                className="download-button download-button--secondary cursor-pointer border-0"
              >
                <WindowsIcon />
                <span>Download for Windows</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
