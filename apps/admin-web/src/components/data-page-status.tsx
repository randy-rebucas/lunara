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
    return (
      <div className="alert-error" role="alert">
        {error}
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
