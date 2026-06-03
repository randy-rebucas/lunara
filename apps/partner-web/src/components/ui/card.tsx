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

export function StatCard({
  label,
  value,
  href,
  warning,
  accent,
}: {
  label: string;
  value: string | number;
  href?: string;
  warning?: boolean;
  accent?: 'primary' | 'secondary' | 'accent';
}) {
  const className = warning ? 'stat-card-warning block' : 'stat-card block';
  const content = (
    <>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tracking-tight ${
          accent === 'accent' ? 'text-accent' : accent === 'secondary' ? 'text-secondary' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
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

export function LiveBadge() {
  return (
    <span className="badge-live">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      Live
    </span>
  );
}
