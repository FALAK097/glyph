import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BREW_INSTALL_COMMAND, DOWNLOAD_URLS } from "./site-config";

type Feature = {
  eyebrow: string;
  title: string;
  description: string;
  className: string;
  tone: string;
  compactHeight?: boolean;
  emphasis?: "default" | "media";
  image?: {
    src: string;
    alt: string;
    frame?: "wide" | "compact" | "panel";
  };
  themes?: boolean;
};

const features: Feature[] = [
  {
    eyebrow: "Organization",
    title: "Folders + Editing",
    description:
      "Open entire directories and manage your markdown library in one focused editor designed for long-form writing.",
    className: "md:col-span-8",
    tone: "feature-card--paper",
    emphasis: "media",
    image: {
      src: "/demo.png",
      alt: "Glyph interface preview",
      frame: "wide",
    },
  },
  {
    eyebrow: "Privacy",
    title: "Local-First",
    description:
      "Your notes stay on your device. No accounts, no forced sync, and no cloud dependency between you and your files.",
    className: "md:col-span-4",
    tone: "feature-card--ink",
    compactHeight: true,
  },
  {
    eyebrow: "Favorites",
    title: "Pinned Notes",
    description:
      "Keep your most important notes anchored for instant access in the sidebar and the command palette.",
    className: "md:col-span-4",
    tone: "feature-card--paper",
  },
  {
    eyebrow: "Discovery",
    title: "Find Notes",
    description:
      "Search all your markdown files in one place and find the exact note you need in seconds.",
    className: "md:col-span-4",
    tone: "feature-card--white",
  },
  {
    eyebrow: "Ethics",
    title: "Open Source",
    description:
      "Glyph is transparent and community-friendly. Inspect the code, contribute improvements, or adapt it to your workflow.",
    className: "md:col-span-4",
    tone: "feature-card--tint",
  },
  {
    eyebrow: "Workflow",
    title: "Keyboard Shortcuts",
    description:
      "Built for speed, with fast navigation and commands that keep your hands on the keyboard.",
    className: "md:col-span-6",
    tone: "feature-card--paper",
    image: {
      src: "/keyboard-shortcut.png",
      alt: "Glyph keyboard shortcuts interface preview",
      frame: "wide",
    },
  },
  {
    eyebrow: "Visuals",
    title: "Syntax Highlighting",
    description:
      "Readable markdown structure and code blocks make it easier to scan, edit, and stay oriented while writing.",
    className: "md:col-span-6",
    tone: "feature-card--white",
    image: {
      src: "/syntax-highlighting.png",
      alt: "Glyph syntax highlighting preview",
      frame: "wide",
    },
  },
  {
    eyebrow: "Appearance",
    title: "Light & Dark Themes",
    description:
      "Carefully tuned themes for every lighting condition, whether you are writing in daylight or reviewing notes late at night.",
    className: "md:col-span-12",
    tone: "feature-card--paper",
    themes: true,
  },
];

type ProductShotProps = {
  src: string;
  alt: string;
  frame?: "wide" | "compact" | "panel";
};

function ProductShot({ src, alt, frame = "compact" }: ProductShotProps) {
  return (
    <div
      className={`product-shot ${
        frame === "wide" ? "product-shot--wide" : frame === "panel" ? "product-shot--panel" : ""
      }`}
    >
      <img src={src} alt={alt} width="2880" height="1800" className="product-shot__image" />
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
      <header className="mx-auto max-w-screen-2xl px-6 pb-18 pt-16 sm:px-8 sm:pb-22 sm:pt-20 lg:px-12 lg:pb-24 lg:pt-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <span className="hero-kicker">The Interface of Thought</span>
          <h1 id="main-content" className="hero-display mt-6 max-w-[10ch] text-balance">
            Designed for
            <span className="hero-display__break">
              the <em>discerning</em>
            </span>
            writer.
          </h1>
          <p className="hero-body mt-7 max-w-2xl text-balance">
            Glyph is free to use, local-first, and built around plain markdown files. It strips away
            digital noise, leaving only your words, your folders, and a reading experience built for
            clarity.
          </p>
          <div
            id="install-with-homebrew"
            className="mt-10 w-full max-w-[46rem] overflow-hidden rounded-2xl border border-black/8 bg-[color:color-mix(in_oklab,white_86%,var(--surface-paper))] text-left shadow-[0_16px_48px_-44px_oklch(0.17_0.01_110_/_0.3)]"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:gap-4">
              <code className="block min-w-0 whitespace-normal break-all text-[0.98rem] leading-relaxed text-[var(--ink-soft)] sm:break-words">
                {BREW_INSTALL_COMMAND}
              </code>
              <button
                type="button"
                aria-label={hasCopiedBrew ? "Copied command" : "Copy command"}
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center self-start rounded-[0.55rem] border border-black/8 bg-[color:color-mix(in_oklab,white_92%,var(--surface-page))] text-[var(--ink-soft)] transition-transform duration-150 ease-out hover:-translate-y-px hover:text-[var(--ink-strong)] sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[0.82rem] sm:font-semibold"
                onClick={() => void handleCopyBrewCommand()}
              >
                {hasCopiedBrew ? (
                  <>
                    <Check size={15} aria-hidden="true" />
                    <span className="hidden sm:inline">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} aria-hidden="true" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </div>
            {brewCopyError ? (
              <div className="border-t border-black/8 px-4 py-4">
                <p className="text-[0.8rem] font-medium text-[var(--ink-soft)]">
                  Copy failed. Click to select the command manually.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    ref={brewFallbackInputRef}
                    type="text"
                    readOnly
                    value={BREW_INSTALL_COMMAND}
                    onClick={selectBrewFallbackInput}
                    onFocus={selectBrewFallbackInput}
                    className="min-w-0 flex-1 rounded-[0.7rem] border border-black/10 bg-white px-3 py-2 text-[0.88rem] text-[var(--ink-soft)] outline-none selection:bg-[var(--surface-strong)]/20"
                    aria-label="Homebrew install command"
                  />
                  <button
                    type="button"
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[0.55rem] border border-black/8 bg-[color:color-mix(in_oklab,white_92%,var(--surface-page))] px-3 py-2 text-[0.8rem] font-semibold text-[var(--ink-soft)] transition-transform duration-150 ease-out hover:-translate-y-px hover:text-[var(--ink-strong)]"
                    onClick={selectBrewFallbackInput}
                  >
                    Copy failed - Click to select
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-screen-2xl px-6 pb-28 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:auto-rows-[minmax(300px,_auto)]">
          {features.map((feature) => {
            const darkCard = feature.title === "Local-First";

            return (
              <article
                key={feature.title}
                className={`${feature.className} ${feature.tone} feature-card ${
                  feature.compactHeight ? "feature-card--compact" : ""
                } ${feature.emphasis === "media" ? "feature-card--media" : ""} flex flex-col justify-between`}
              >
                <div
                  className={
                    feature.themes
                      ? "flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12"
                      : feature.emphasis === "media"
                        ? "max-w-none"
                        : "max-w-md"
                  }
                >
                  <div className={feature.themes ? "max-w-[44rem]" : undefined}>
                    <span
                      className={`feature-card__eyebrow ${darkCard ? "feature-card__eyebrow--dark" : ""}`}
                    >
                      {feature.eyebrow}
                    </span>
                    <h2
                      className={`feature-card__title ${darkCard ? "feature-card__title--dark" : ""} ${
                        feature.emphasis === "media" ? "feature-card__title--media" : ""
                      } ${
                        feature.title === "Find Notes" || feature.themes
                          ? "lg:whitespace-nowrap"
                          : ""
                      }`}
                    >
                      {feature.title}
                    </h2>
                    <p
                      className={`feature-card__description ${
                        darkCard ? "feature-card__description--dark" : ""
                      } ${feature.emphasis === "media" ? "feature-card__description--media" : ""}`}
                    >
                      {feature.title === "Open Source" ? (
                        <>
                          <a
                            href={DOWNLOAD_URLS.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-link"
                          >
                            Glyph
                          </a>{" "}
                          is transparent and community-friendly. Inspect the code, contribute
                          improvements, or adapt it to your workflow.
                        </>
                      ) : (
                        feature.description
                      )}
                    </p>
                  </div>

                  {feature.themes ? (
                    <div className="hidden w-full max-w-[20rem] lg:mt-6 lg:block">
                      <div className="rounded-[1.35rem] border border-black/8 bg-white/70 p-5 shadow-[0_10px_30px_-28px_oklch(0.18_0.01_110_/_0.28)]">
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                          Theme Mode
                        </span>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-[0.74rem] font-medium text-[var(--ink-strong)]">
                            Light
                          </span>
                          <span className="rounded-full border border-black/8 bg-[var(--surface-strong)] px-3 py-1.5 text-[0.74rem] font-medium text-[var(--ink-inverse)]">
                            Dark
                          </span>
                          <span className="rounded-full border border-black/8 bg-[color:color-mix(in_oklab,white_88%,var(--surface-page))] px-3 py-1.5 text-[0.74rem] font-medium text-[var(--ink-soft)]">
                            System
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {feature.image ? (
                  <div className="mt-10">
                    <ProductShot
                      src={feature.image.src}
                      alt={feature.image.alt}
                      frame={feature.image.frame}
                    />
                  </div>
                ) : null}

                {feature.themes ? (
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <ProductShot
                      src="/light-theme.png"
                      alt="Glyph light theme preview"
                      frame="wide"
                    />
                    <ProductShot
                      src="/dark-theme.png"
                      alt="Glyph dark theme preview"
                      frame="wide"
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
