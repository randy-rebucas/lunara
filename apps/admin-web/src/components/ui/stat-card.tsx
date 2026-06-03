import Link from 'next/link';

export function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  href?: string;
  accent?: 'primary' | 'secondary' | 'accent' | 'warning';
}) {
  const accentRing =
    accent === 'secondary'
      ? 'hover:ring-secondary/25'
      : accent === 'accent'
        ? 'hover:ring-accent/25'
        : accent === 'warning'
          ? 'hover:ring-amber-300/50'
          : 'hover:ring-primary/25';

  const content = (
    <>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`stat-card block ${accentRing}`}>
        {content}
      </Link>
    );
  }

  return <div className="stat-card">{content}</div>;
}

export function LiveBadge() {
  return (
    <span className="badge-live">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      Live
    </span>
  );
}
