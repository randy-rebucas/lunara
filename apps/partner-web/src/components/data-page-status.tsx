export function DataPageStatus({
  loading,
  error,
  loadingMessage = 'Loading…',
}: {
  loading: boolean;
  error: string;
  loadingMessage?: string;
}) {
  if (error) {
    return <div className="alert-error">{error}</div>;
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
          aria-hidden
        />
        {loadingMessage}
      </div>
    );
  }
  return null;
}
