export function AuthLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3" role="status">
      <div className="text-sm text-muted-foreground">{message}</div>
    </div>
  );
}
