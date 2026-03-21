import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

const AppleIcon = () => (
  <svg
    viewBox="0 0 384 512"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    height="18"
    width="18"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 56-12 69.5-34.3z" />
  </svg>
);

const WindowsIcon = () => (
  <svg
    viewBox="0 0 88 88"
    xmlns="http://www.w3.org/2000/svg"
    height="18"
    width="18"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="m0 12.402 35.687-4.86.016 34.423-35.67.203zm35.67 33.529.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349-.011 41.34-47.318-6.678-.066-34.739z"
      fill="currentColor"
    />
  </svg>
);

const DOWNLOAD_URLS = {
  mac: "https://github.com/FALAK097/glyph/releases/latest/download/Glyph-mac.dmg",
  windows: "https://github.com/FALAK097/glyph/releases/latest/download/Glyph-windows.exe",
  releases: "https://github.com/FALAK097/glyph/releases",
  changelog: "https://github.com/FALAK097/glyph/blob/main/CHANGELOG.md",
  github: "https://github.com/FALAK097/glyph",
} as const;

const BREW_INSTALL_COMMAND = "brew install --cask FALAK097/glyph/glyph";

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
    eyebrow: "Native",
    title: "QuickLook",
    description:
      "Preview markdown files right in Finder. Press Space on any .md file and read instantly.",
    className: "md:col-span-4",
    tone: "feature-card--paper",
  },
  {
    eyebrow: "Discovery",
    title: "Search Everything",
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

export function App() {
  const [hasCopiedBrew, setHasCopiedBrew] = useState(false);

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

  const handleCopyBrewCommand = async () => {
    try {
      await navigator.clipboard.writeText(BREW_INSTALL_COMMAND);
      setHasCopiedBrew(true);
    } catch {
      setHasCopiedBrew(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--surface-page)] text-[var(--ink-strong)] [font-family:var(--font-sans)]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--ink-strong)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--surface-page)]"
        href="#main-content"
      >
        Skip to content
      </a>

      <nav className="sticky top-0 z-40 border-b border-black/5 bg-[color:color-mix(in_oklab,var(--surface-page)_88%,white)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8 lg:px-12">
          <a
            href="/"
            aria-label="Glyph Home"
            className="brand-lockup rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-page)]"
          >
            <img
              src="/logo-wordmark-dark.png"
              alt="Glyph"
              width="512"
              height="128"
              className="brand-lockup__wordmark"
            />
          </a>

          <div className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-end">
            <a href={DOWNLOAD_URLS.mac} className="download-button">
              <AppleIcon />
              Download for macOS
            </a>
            <a href={DOWNLOAD_URLS.windows} className="download-button download-button--secondary">
              <WindowsIcon />
              Download for Windows
            </a>
          </div>
        </div>
      </nav>

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
            className="mt-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-black/8 bg-[color:color-mix(in_oklab,white_86%,var(--surface-paper))] text-left shadow-[0_16px_48px_-44px_oklch(0.17_0.01_110_/_0.3)]"
          >
            <div className="border-b border-black/8 px-4 pt-3 text-[0.82rem] text-[var(--ink-muted)]">
              <span className="relative inline-block border-b-2 border-[var(--ink-strong)] px-1 pb-3 font-medium text-[var(--ink-strong)]">
                brew
              </span>
            </div>

            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <code className="overflow-x-auto whitespace-nowrap text-[0.98rem] text-[var(--ink-soft)]">
                {BREW_INSTALL_COMMAND}
              </code>
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[0.55rem] border border-black/8 bg-[color:color-mix(in_oklab,white_92%,var(--surface-page))] px-3 py-2 text-[0.82rem] font-semibold text-[var(--ink-soft)] transition-transform duration-150 ease-out hover:-translate-y-px hover:text-[var(--ink-strong)] sm:self-auto"
                onClick={() => void handleCopyBrewCommand()}
              >
                {hasCopiedBrew ? (
                  <>
                    <Check size={15} aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={15} aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
            </div>
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
                <div className={feature.emphasis === "media" ? "max-w-none" : "max-w-md"}>
                  <span
                    className={`feature-card__eyebrow ${darkCard ? "feature-card__eyebrow--dark" : ""}`}
                  >
                    {feature.eyebrow}
                  </span>
                  <h2
                    className={`feature-card__title ${darkCard ? "feature-card__title--dark" : ""} ${
                      feature.emphasis === "media" ? "feature-card__title--media" : ""
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
                  <div className="mt-12 grid gap-5 sm:grid-cols-2">
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

      <footer className="bg-[var(--surface-page)]">
        <div className="mx-auto max-w-screen-2xl px-6 py-10 text-center sm:px-8 lg:px-12">
          <div className="mx-auto mb-8 h-px max-w-4xl bg-black/10" />
          <p className="text-[0.8rem] font-medium tracking-[0.03em] text-[var(--ink-soft)]">
            Made by{" "}
            <a
              href="https://falakgala.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-page)]"
            >
              Falak Gala
            </a>
            <span className="px-2 text-black/25">·</span>
            <a
              href="https://github.com/FALAK097/glyph"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-page)]"
            >
              GitHub
            </a>
            <span className="px-2 text-black/25">·</span>
            <a
              href={DOWNLOAD_URLS.changelog}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-page)]"
            >
              Changelog
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

export default App;
