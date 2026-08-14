'use client';

import Link from 'next/link';

export const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

export function StatTile({
  label,
  value,
  sub,
  delta,
  tone,
  href,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  tone: keyof typeof TILE_TONES;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const trendClass =
    delta == null || delta === 0
      ? 'dc-metric-trend-flat'
      : delta > 0
        ? 'dc-metric-trend-up'
        : 'dc-metric-trend-down';
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {delta != null ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`dc-metric-trend ${trendClass}`}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}%
          </span>
          {sub ? <span className="dc-sublabel">{sub}</span> : null}
        </div>
      ) : sub ? (
        <p className="dc-sublabel mt-0.5">{sub}</p>
      ) : null}
    </>
  );
  const cls = `rounded-xl p-4 text-left ring-1 transition-all ${TILE_TONES[tone]} ${
    active ? 'ring-2 ring-primary/40' : ''
  }`;

  if (href) {
    return (
      <Link href={href} className={`block ${cls} hover:shadow-[var(--shadow-elevated)]`}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} hover:shadow-[var(--shadow-elevated)]`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Utilization bar for a capacity metric (e.g. active orders vs a branch's max). */
export function CapacityBar({ label, pct, sub }: { label: string; pct: number; sub?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const barColor = clamped >= 90 ? 'bg-rose-500' : clamped >= 70 ? 'bg-amber-500' : 'bg-accent';
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900">{label}</span>
        <span className="text-xs text-muted">{sub ?? `${clamped}%`}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
