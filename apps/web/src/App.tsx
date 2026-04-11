import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChangelogPage } from "./changelog-page";
import { HomePage } from "./home-page";
import { SiteLayout } from "./site-shell";

type SitePage = "changelog" | "home";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished?: Promise<void>;
  };
};

const SITE_META: Record<
  SitePage,
  {
    canonical: string;
    title: string;
  }
> = {
  home: {
    canonical: "https://glyph.falakgala.dev",
    title: "Glyph - A markdown workspace that understands your workflow",
  },
  changelog: {
    canonical: "https://glyph.falakgala.dev/changelog/",
    title: "Glyph Changelog",
  },
};

function resolvePage(pathname: string): SitePage {
  return pathname === "/changelog" || pathname.startsWith("/changelog/") ? "changelog" : "home";
}

function resolveHref(page: SitePage): string {
  return page === "changelog" ? "/changelog/" : "/";
}

function updateDocumentMeta(page: SitePage) {
  const meta = SITE_META[page];
  document.title = meta.title;

  const canonicalLink = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
  if (canonicalLink) {
    canonicalLink.href = meta.canonical;
  }
}

function focusMainContent() {
  const mainContent = document.getElementById("main-content");
  if (!(mainContent instanceof HTMLElement)) {
    return;
  }

  if (!mainContent.hasAttribute("tabindex")) {
    mainContent.tabIndex = -1;
  }

  mainContent.focus();
}

export function App() {
  const [page, setPage] = useState<SitePage>(() => resolvePage(window.location.pathname));
  const shouldFocusMainContentRef = useRef(false);

  useEffect(() => {
    updateDocumentMeta(page);
  }, [page]);

  useEffect(() => {
    if (!shouldFocusMainContentRef.current) {
      return;
    }

    shouldFocusMainContentRef.current = false;

    const frame = window.requestAnimationFrame(() => {
      focusMainContent();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [page]);

  const commitNavigation = useCallback((nextPage: SitePage, pushHistory: boolean) => {
    const nextHref = resolveHref(nextPage);
    const currentPath =
      window.location.pathname.endsWith("/") || window.location.pathname === "/"
        ? window.location.pathname
        : `${window.location.pathname}/`;
    const didPushHistory = pushHistory && currentPath !== nextHref;

    if (didPushHistory) {
      window.history.pushState({ page: nextPage }, "", nextHref);
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "auto",
        });
      });
    }

    startTransition(() => {
      setPage(nextPage);
    });
  }, []);

  const navigate = useCallback(
    (nextPage: SitePage, pushHistory = true) => {
      if (nextPage === page && pushHistory) {
        return;
      }

      const performNavigation = () => {
        shouldFocusMainContentRef.current = true;
        commitNavigation(nextPage, pushHistory);
      };

      const viewTransitionDocument = document as ViewTransitionDocument;
      if (viewTransitionDocument.startViewTransition) {
        void viewTransitionDocument.startViewTransition(() => {
          performNavigation();
        });
        return;
      }

      performNavigation();
    },
    [commitNavigation, page],
  );

  useEffect(() => {
    const handlePopState = () => {
      navigate(resolvePage(window.location.pathname), false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  const pageContent = useMemo(
    () => (page === "changelog" ? <ChangelogPage /> : <HomePage />),
    [page],
  );

  return (
    <SiteLayout activePage={page} onNavigate={navigate}>
      <div key={page} className="site-route-shell">
        {pageContent}
      </div>
    </SiteLayout>
  );
}

export default App;
