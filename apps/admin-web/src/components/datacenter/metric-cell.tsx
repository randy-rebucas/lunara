import Link from 'next/link';

export function MetricCell({
  label,
  value,
  sub,
  href,
  highlight,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  highlight?: 'warning' | 'accent' | 'primary' | 'danger';
  /** Optional delta vs. a prior period, e.g. +12 or -4.5. Rendered as a signed % pill. */
  trend?: number;
}) {
  const borderAccent =
    highlight === 'warning'
      ? 'border-amber-400'
      : highlight === 'danger'
        ? 'border-red-400'
        : highlight === 'accent'
          ? 'border-accent'
          : highlight === 'primary'
            ? 'border-primary'
            : 'border-border';

  const valueClass =
    highlight === 'warning' && Number(value) > 0
      ? 'text-amber-700'
      : highlight === 'danger' && Number(value) > 0
        ? 'text-red-700'
        : '';

  const trendClass =
    trend == null || trend === 0
      ? 'dc-metric-trend-flat'
      : trend > 0
        ? 'dc-metric-trend-up'
        : 'dc-metric-trend-down';

  const inner = (
    <>
      <div className="relative flex items-start justify-between gap-2">
        <p className="dc-label">{label}</p>
        {trend != null ? (
          <span className={`dc-metric-trend ${trendClass} shrink-0`}>
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '–'} {Math.abs(trend)}%
          </span>
        ) : null}
      </div>
      <p className={`dc-value relative mt-1.5 ${valueClass}`}>{value}</p>
      {sub ? <p className="dc-sublabel relative mt-0.5">{sub}</p> : null}
    </>
  );

  const className = `dc-metric ${borderAccent} transition-all hover:shadow-md hover:ring-border/70`;

  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
