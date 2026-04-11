import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

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

export function App() {
  const [page, setPage] = useState<SitePage>(() => resolvePage(window.location.pathname));

  useEffect(() => {
    updateDocumentMeta(page);
  }, [page]);

  const commitNavigation = useCallback((nextPage: SitePage, pushHistory: boolean) => {
    const nextHref = resolveHref(nextPage);
    const currentPath =
      window.location.pathname.endsWith("/") || window.location.pathname === "/"
        ? window.location.pathname
        : `${window.location.pathname}/`;

    if (pushHistory && currentPath !== nextHref) {
      window.history.pushState({ page: nextPage }, "", nextHref);
    }

    startTransition(() => {
      setPage(nextPage);
    });

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    });
  }, []);

  const navigate = useCallback(
    (nextPage: SitePage, pushHistory = true) => {
      if (nextPage === page && pushHistory) {
        return;
      }

      const viewTransitionDocument = document as ViewTransitionDocument;
      if (viewTransitionDocument.startViewTransition) {
        void viewTransitionDocument.startViewTransition(() => {
          commitNavigation(nextPage, pushHistory);
        });
        return;
      }

      commitNavigation(nextPage, pushHistory);
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
