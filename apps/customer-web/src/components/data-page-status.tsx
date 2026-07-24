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
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <img src="/images/washing-machine-preloader.svg" alt="" className="h-6 w-6" />
        {loadingMessage}
      </div>
    );
  }
  return null;
}
