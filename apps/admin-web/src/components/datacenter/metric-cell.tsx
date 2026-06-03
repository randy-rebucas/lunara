import Link from 'next/link';

export function MetricCell({
  label,
  value,
  sub,
  href,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  highlight?: 'warning' | 'accent' | 'primary' | 'danger';
}) {
  const highlightRing =
    highlight === 'warning'
      ? 'ring-amber-400/50 bg-amber-50/30'
      : highlight === 'danger'
        ? 'ring-red-400/50 bg-red-50/30'
        : highlight === 'accent'
          ? 'ring-accent/30 bg-accent/5'
          : highlight === 'primary'
            ? 'ring-primary/25 bg-primary/5'
            : 'ring-border/50 bg-slate-50/50';

  const valueClass =
    highlight === 'warning' && Number(value) > 0
      ? 'text-amber-700'
      : highlight === 'danger' && Number(value) > 0
        ? 'text-red-700'
        : '';

  const inner = (
    <>
      <p className="dc-label">{label}</p>
      <p className={`dc-value mt-2 ${valueClass}`}>{value}</p>
      {sub ? <p className="dc-sublabel mt-1">{sub}</p> : null}
    </>
  );

  const className = `dc-metric ${highlightRing} transition-colors hover:bg-slate-50`;

  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
