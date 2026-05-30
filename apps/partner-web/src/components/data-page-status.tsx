export function DataPageStatus({
  loading,
  error,
  loadingMessage = 'Loading…',
}: {
  loading: boolean;
  error: string;
  loadingMessage?: string;
}) {
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (loading) return <p className="text-sm text-slate-500">{loadingMessage}</p>;
  return null;
}
