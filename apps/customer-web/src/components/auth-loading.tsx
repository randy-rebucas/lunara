export function AuthLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="laundry-bg flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        {message}
      </div>
    </div>
  );
}
