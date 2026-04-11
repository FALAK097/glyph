import { ArrowUpRight, Check, Copy } from "lucide-react";
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
      src: "/keyboard-shortcut.png",
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
      src: "/demo.png",
      alt: "Glyph workspace with explorer and editor",
      fit: "cover",
      position: "left top",
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
];

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
          width="2880"
          height="1800"
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
            <span className="clean-home__eyebrow">Keyboard-first markdown workspace</span>
            <h1 id="main-content" className="clean-home__title">
              A calmer place to write in markdown.
            </h1>
            <p className="clean-home__body">
              Glyph is a local-first desktop app for plain markdown files, built around folders,
              shortcuts, and a command palette that makes the whole workspace feel easy to move
              through.
            </p>
            <p className="clean-home__meta">
              Command palette, pinned notes, explorer, copy as markdown, and export all stay close
              without turning the interface into noise.
            </p>

            <div className="clean-home__actions">
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
              <a
                href={DOWNLOAD_URLS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="clean-home__link"
              >
                View on GitHub
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>

            <div id="install-with-homebrew" className="clean-home__brew">
              <div className="clean-home__brew-row">
                <code className="clean-home__brew-command">{BREW_INSTALL_COMMAND}</code>
                <button
                  type="button"
                  aria-label={hasCopiedBrew ? "Copied command" : "Copy command"}
                  className="clean-home__brew-button"
                  onClick={() => void handleCopyBrewCommand()}
                >
                  {hasCopiedBrew ? (
                    <>
                      <Check size={15} aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={15} aria-hidden="true" />
                      <span>Copy</span>
                    </>
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
                      className="clean-home__brew-button"
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
              <ShotCard
                shot={{
                  src: "/demo.png",
                  alt: "Glyph workspace overview",
                }}
                variant="hero"
              />
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
          <article className="clean-theme-panel">
            <div className="clean-theme-panel__copy">
              <span className="clean-section__eyebrow">Themes</span>
              <h2 className="clean-section__title">Light and dark both feel intentional.</h2>
              <p className="clean-section__body">
                Glyph keeps the same calm reading rhythm across light, dark, and system modes, so
                the interface stays consistent through long sessions.
              </p>
            </div>

            <div className="clean-theme-panel__grid">
              <ShotCard
                shot={{
                  src: "/light-theme.png",
                  alt: "Glyph light theme",
                }}
              />
              <ShotCard
                shot={{
                  src: "/dark-theme.png",
                  alt: "Glyph dark theme",
                }}
              />
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
                <details key={item.question} className="clean-faq__item" open={index === 0}>
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
