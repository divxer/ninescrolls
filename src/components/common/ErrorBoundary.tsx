import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom UI to render in place of the default fallback. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere in the tree below it and shows a
 * recoverable fallback instead of unmounting the whole app to a blank white
 * screen. Pairs with `lazyWithReload`, which already auto-reloads recoverable
 * stale-chunk failures — so anything reaching this boundary is either a genuine
 * render error or a chunk that stayed broken across a reload.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-5">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-on-surface mb-3">Something went wrong</h1>
        <p className="text-on-surface-variant mb-6">
          This page failed to load. It may have been updated in the background — reloading usually
          fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
