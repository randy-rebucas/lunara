export function AuthLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="laundry-bg flex min-h-screen flex-col items-center justify-center gap-3">
      <img src="/images/washing-machine-preloader.svg" alt="" className="h-16 w-16" />
      <div className="text-sm text-muted">{message}</div>
    </div>
  );
}
