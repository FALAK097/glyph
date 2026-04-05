import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main className="min-h-screen grid place-items-center bg-background text-foreground p-10">
          <section className="w-full max-w-lg bg-card border border-border rounded-xl p-6 shadow-lg">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Renderer Error
            </p>
            <h1 className="mt-2 text-xl font-semibold leading-snug">
              Something went wrong in Glyph.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              type="button"
              className="mt-4 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              onClick={this.handleReset}
            >
              Try Again
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
