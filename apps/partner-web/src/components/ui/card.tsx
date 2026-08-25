import { cn } from '@lunara/ui';
import Link from 'next/link';

export function Card({
  className,
  elevated,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return <div className={cn(elevated ? 'card-elevated' : 'card', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-body', className)} {...props} />;
}

export function SectionPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('section-panel', className)}>
      <div className="section-panel-header">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function TrendBadge({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null) {
    return <span className="badge-trend-flat">—</span>;
  }
  if (deltaPct === 0) {
    return <span className="badge-trend-flat">0%</span>;
  }
  const up = deltaPct > 0;
  return (
    <span className={up ? 'badge-trend-up' : 'badge-trend-down'}>
      {up ? '↑' : '↓'} {Math.abs(deltaPct)}%
    </span>
  );
}

export function StatCard({
  label,
  value,
  href,
  warning,
  accent,
  trend,
}: {
  label: string;
  value: string | number;
  href?: string;
  warning?: boolean;
  accent?: 'primary' | 'secondary' | 'accent';
  trend?: { deltaPct: number | null };
}) {
  const className = warning ? 'stat-card-warning block' : 'stat-card block';
  const content = (
    <>
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p
          className={`text-3xl font-semibold tracking-tight ${
            accent === 'accent' ? 'text-accent' : accent === 'secondary' ? 'text-secondary' : 'text-slate-900'
          }`}
        >
          {value}
        </p>
        {trend && <TrendBadge deltaPct={trend.deltaPct} />}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={warning ? 'stat-card-warning' : 'stat-card'}>{content}</div>;
}

const STATUS_PILL_STYLES: Record<'blue' | 'amber' | 'green' | 'slate', string> = {
  blue: 'bg-primary/10 text-primary',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-accent/10 text-accent',
  slate: 'bg-slate-100 text-slate-600',
};

function statusPillTone(status: string): 'blue' | 'amber' | 'green' | 'slate' {
  const s = status.toLowerCase();
  if (s.includes('delivered') || s.includes('completed')) return 'green';
  if (
    s.includes('transit') ||
    s.includes('pickup') ||
    s.includes('picked_up') ||
    s.includes('washing') ||
    s.includes('drying') ||
    s.includes('folding') ||
    s.includes('ironing') ||
    s.includes('ready')
  ) {
    return 'amber';
  }
  if (s.includes('assigned') || s.includes('confirmed') || s.includes('received') || s.includes('sorting')) {
    return 'blue';
  }
  return 'slate';
}

export function StatusPill({ status }: { status: string }) {
  const tone = statusPillTone(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_PILL_STYLES[tone]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="badge-live">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      Live
    </span>
  );
}
