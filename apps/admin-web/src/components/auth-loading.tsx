export function AuthLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="admin-bg flex min-h-screen flex-col items-center justify-center gap-3" role="status">
      <img src="/images/washing-machine-preloader.svg" alt="" className="h-16 w-16" aria-hidden />
      <div className="text-sm text-muted">{message}</div>
    </div>
  );
}
