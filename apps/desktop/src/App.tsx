import { ErrorBoundary } from "./components/error-boundary";
import { DesktopApp } from "./components/desktop-app";

export const App = () => {
  const glyph = window.glyph;

  if (!glyph) {
    return (
      <main className="min-h-screen grid place-items-center bg-background text-foreground p-10">
        <section className="w-full max-w-lg bg-card border border-border rounded-xl p-6 shadow-lg">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Renderer Boot Error
          </p>
          <h1 className="mt-2 text-xl font-semibold leading-snug">
            Glyph could not connect to the Electron preload API.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Check the terminal for preload errors, then restart{" "}
            <span className="font-mono">pnpm dev:desktop</span>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <DesktopApp glyph={glyph} />
    </ErrorBoundary>
  );
};
