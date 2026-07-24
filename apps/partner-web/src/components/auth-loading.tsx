export function AuthLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="portal-bg flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <img src="/images/washing-machine-preloader.svg" alt="" className="h-16 w-16" aria-hidden />
      <div className="text-sm text-muted">{message}</div>
    </div>
  );
}
