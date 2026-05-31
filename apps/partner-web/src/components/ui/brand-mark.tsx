export function BrandMark({ partner }: { partner?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-[var(--shadow-card)]"
        aria-hidden
      >
        L
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold tracking-tight text-slate-900">
          {partner ? 'Partner Portal' : 'Lunara Staff'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {partner ? 'Shop operations' : 'Laundry processing'}
        </p>
      </div>
    </div>
  );
}
