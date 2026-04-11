import type { ReactNode } from "react";
import type { MouseEvent } from "react";

import { AppleIcon, DOWNLOAD_URLS, WindowsIcon } from "./site-config";

type SiteLayoutProps = {
  activePage: "changelog" | "home";
  children: ReactNode;
  onNavigate: (page: "changelog" | "home") => void;
};

const footerLinkClassName =
  "footer-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-page)]";

function shouldHandleInternalNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  );
}

export function SiteLayout({ activePage, children, onNavigate }: SiteLayoutProps) {
  const handleInternalLink =
    (page: "changelog" | "home") => (event: MouseEvent<HTMLAnchorElement>) => {
      if (!shouldHandleInternalNavigation(event)) {
        return;
      }

      event.preventDefault();
      onNavigate(page);
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
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-8 sm:py-0 lg:px-12">
          <a
            href="/"
            aria-label="Glyph Home"
            className="brand-lockup rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-page)]"
            onClick={handleInternalLink("home")}
          >
            <img
              src="/logo-wordmark-dark.png"
              alt="Glyph"
              width="512"
              height="128"
              className="brand-lockup__wordmark"
            />
          </a>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <a href={DOWNLOAD_URLS.mac} className="download-button cursor-pointer border-0">
              <AppleIcon />
              <span className="sm:hidden">macOS</span>
              <span className="hidden sm:inline">Download for macOS</span>
            </a>
            <a
              href={DOWNLOAD_URLS.windows}
              className="download-button download-button--secondary cursor-pointer border-0"
            >
              <WindowsIcon />
              <span className="sm:hidden">Windows</span>
              <span className="hidden sm:inline">Download for Windows</span>
            </a>
          </div>
        </div>
      </nav>

      {children}

      <footer className="bg-[var(--surface-page)]">
        <div className="mx-auto max-w-screen-2xl px-6 py-10 text-center sm:px-8 lg:px-12">
          <div className="mx-auto mb-8 h-px max-w-4xl bg-black/10" />
          <p className="text-[0.8rem] font-medium tracking-[0.03em] text-[var(--ink-soft)]">
            Made by{" "}
            <a
              href="https://falakgala.dev"
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClassName}
            >
              Falak Gala
            </a>
            <span className="px-2 text-black/25">·</span>
            <a
              href={DOWNLOAD_URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClassName}
            >
              GitHub
            </a>
            <span className="px-2 text-black/25">·</span>
            <a
              href={DOWNLOAD_URLS.changelog}
              aria-current={activePage === "changelog" ? "page" : undefined}
              className={footerLinkClassName}
              onClick={handleInternalLink("changelog")}
            >
              Changelog
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
