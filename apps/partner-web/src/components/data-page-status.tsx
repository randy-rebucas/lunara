export function DataPageStatus({
  loading,
  error,
  loadingMessage = 'Loading…',
  onRetry,
}: {
  loading: boolean;
  error: string;
  loadingMessage?: string;
  /** When set, renders a "Try again" action next to the error instead of leaving the user stuck. */
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="alert-error flex flex-wrap items-center justify-between gap-3">
        <span>{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-sm font-medium underline underline-offset-2"
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <img src="/images/washing-machine-preloader.svg" alt="" className="h-6 w-6" aria-hidden />
        {loadingMessage}
      </div>
    );
  }
  return null;
}
