export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : ''}`}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-[var(--shadow-card)]"
        aria-hidden
      >
        L
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-slate-900">Lunara Admin</p>
          <p className="truncate text-xs text-muted-foreground">Platform management</p>
        </div>
      )}
    </div>
  );
}
