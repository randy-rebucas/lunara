import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { cn } from '@lunara/ui';

export function accentClasses(accent: 'primary' | 'secondary' | 'accent') {
  if (accent === 'secondary') {
    return { bg: 'bg-secondary/10', text: 'text-secondary', ring: 'ring-secondary/15' };
  }
  if (accent === 'accent') {
    return { bg: 'bg-accent/10', text: 'text-accent', ring: 'ring-accent/15' };
  }
  return { bg: 'bg-primary/10', text: 'text-primary', ring: 'ring-primary/15' };
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function MarketingGradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
      {children}
    </span>
  );
}

export function MarketingHeroGlow() {
  return (
    <>
      <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
    </>
  );
}

function marketingContentWidth({
  wide,
  narrow,
}: {
  wide?: boolean;
  narrow?: boolean;
}) {
  if (narrow) return 'mx-auto w-full max-w-3xl';
  if (wide) return 'mx-auto w-full max-w-5xl';
  return 'w-full';
}

type MarketingPageHeroProps = {
  badge?: string;
  title: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  align?: 'left' | 'center';
  wide?: boolean;
  narrow?: boolean;
  glow?: boolean;
};

export function MarketingPageHero({
  badge,
  title,
  description,
  children,
  align = 'left',
  wide = false,
  narrow = false,
  glow = true,
}: MarketingPageHeroProps) {
  const centered = align === 'center';

  return (
    <section
      className={cn(
        'marketing-container relative overflow-hidden pb-12 pt-12 sm:pb-16 sm:pt-16',
        glow && 'lg:pb-20',
      )}
    >
      {glow ? <MarketingHeroGlow /> : null}
      <div
        className={cn(
          'relative',
          marketingContentWidth({ wide, narrow }),
          centered && 'text-center',
        )}
      >
        {badge ? <span className="badge-primary">{badge}</span> : null}
        <h1
          className={cn(
            'font-extrabold tracking-tight text-slate-900',
            badge ? 'mt-4' : '',
            centered
              ? 'text-3xl sm:text-4xl lg:text-5xl'
              : 'text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]',
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              'mt-4 text-lg leading-relaxed text-muted sm:mt-5',
              centered ? 'mx-auto max-w-2xl' : 'max-w-2xl',
            )}
          >
            {description}
          </p>
        ) : null}
        {children ? (
          <div className={cn('mt-8', centered && 'flex flex-col items-center')}>{children}</div>
        ) : null}
      </div>
    </section>
  );
}

type MarketingSectionProps = {
  id?: string;
  tint?: 'none' | 'muted' | 'bordered';
  className?: string;
  children: React.ReactNode;
  containerClassName?: string;
};

export function MarketingSection({
  id,
  tint = 'none',
  className,
  children,
  containerClassName,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'py-14 sm:py-16',
        tint === 'muted' && 'border-t border-border/40 bg-surface/60',
        tint === 'bordered' && 'border-t border-border/40',
        className,
      )}
    >
      <div className={cn('marketing-container', containerClassName)}>{children}</div>
    </section>
  );
}

export function MarketingSectionHeader({
  title,
  description,
  align = 'center',
}: {
  title: string;
  description?: string;
  align?: 'left' | 'center';
}) {
  const centered = align === 'center';
  return (
    <div className={cn(centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl')}>
      <h2 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h2>
      {description ? <p className="mt-3 text-muted">{description}</p> : null}
    </div>
  );
}

export function MarketingSectionIcon({
  icon: Icon,
  title,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
  );
}

export function MarketingStatRow({
  stats,
  align = 'left',
  className,
}: {
  stats: { icon: React.ComponentType<{ className?: string }>; label: string }[];
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2.5',
        align === 'center' && 'justify-center',
        className,
      )}
    >
      {stats.map((stat, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)] ring-1 ring-border/50"
        >
          <stat.icon className="h-4 w-4 text-primary" />
          {stat.label}
        </span>
      ))}
    </div>
  );
}

export function MarketingFeatureCard({
  badge,
  badgeVariant = 'primary',
  title,
  subtitle,
  description,
  children,
  className,
  href,
}: {
  badge?: string;
  badgeVariant?: 'primary' | 'secondary' | 'accent';
  title: string;
  subtitle?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const badgeClass =
    badgeVariant === 'secondary'
      ? 'badge-secondary'
      : badgeVariant === 'accent'
        ? 'badge-accent'
        : 'badge-primary';

  const cardClassName = cn(
    'card flex h-full flex-col',
    href && 'block hover:shadow-[var(--shadow-elevated)]',
    className,
  );

  const content = (
    <div className="card-body flex flex-1 flex-col">
      {badge ? <span className={cn(badgeClass, 'w-fit')}>{badge}</span> : null}
      <h3 className={cn('text-lg font-semibold text-slate-900', badge && 'mt-3')}>{title}</h3>
      {subtitle ? <p className="mt-1 text-sm font-medium text-primary">{subtitle}</p> : null}
      {description ? (
        <p className={cn('flex-1 text-sm leading-relaxed text-muted', subtitle ? 'mt-3' : 'mt-2')}>
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return <article className={cardClassName}>{content}</article>;
}

const ctaPanelGradients = {
  primary: 'bg-gradient-to-br from-primary/8 via-surface to-primary/5',
  secondary: 'bg-gradient-to-br from-secondary/8 via-surface to-accent/5',
  neutral: 'bg-gradient-to-br from-primary/5 via-surface to-secondary/5',
  dark: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white',
} as const;

export function MarketingInfoCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card', className)}>
      <div className="card-body">
        {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
        <div className={title ? 'mt-4' : undefined}>{children}</div>
      </div>
    </div>
  );
}

export function MarketingCtaPanel({
  badge,
  badgeVariant = 'primary',
  title,
  description,
  footer,
  children,
  variant = 'neutral',
  align = 'left',
  layout = 'stack',
  className,
}: {
  badge?: string;
  badgeVariant?: 'primary' | 'secondary' | 'accent';
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  variant?: keyof typeof ctaPanelGradients;
  align?: 'left' | 'center';
  layout?: 'stack' | 'split';
  className?: string;
}) {
  const isDark = variant === 'dark';
  const split = layout === 'split' || isDark;
  const badgeClass =
    badgeVariant === 'secondary'
      ? 'badge-secondary'
      : badgeVariant === 'accent'
        ? 'badge-accent'
        : 'badge-primary';
  const centered = align === 'center';

  return (
    <div className={cn('card-elevated overflow-hidden', className)}>
      <div
        className={cn(
          'card-body sm:py-10',
          ctaPanelGradients[variant],
          centered && !split && 'text-center',
          split &&
            'flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:text-left',
        )}
      >
        <div className={cn(centered && !split && 'mx-auto max-w-lg', split && 'max-w-xl')}>
          {badge ? <span className={badgeClass}>{badge}</span> : null}
          <h2
            className={cn(
              'text-xl font-bold tracking-tight sm:text-2xl',
              badge ? 'mt-3' : '',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            {title}
          </h2>
          {description ? (
            <p
              className={cn(
                'mt-2 max-w-2xl text-sm leading-relaxed sm:text-base',
                isDark ? 'text-slate-300' : 'text-muted',
                centered && 'mx-auto',
              )}
            >
              {description}
            </p>
          ) : null}
          {footer ? (
            <p className={cn('mt-4 text-xs', isDark ? 'text-slate-400' : 'text-muted-foreground')}>
              {footer}
            </p>
          ) : null}
        </div>
        {children ? (
          <div
            className={cn(
              !split && 'mt-6',
              centered && !split && 'flex justify-center',
              split && 'w-full shrink-0 sm:w-auto',
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MarketingBackLink({
  href = '/',
  label = '← Back to home',
  extra,
}: {
  href?: string;
  label?: string;
  extra?: React.ReactNode;
}) {
  return (
    <p className="mt-10 text-center text-sm text-muted">
      <Link href={href} className="link-primary">
        {label}
      </Link>
      {extra}
    </p>
  );
}

export function MarketingContentBody({
  children,
  wide,
  narrow,
  className,
}: {
  children: React.ReactNode;
  wide?: boolean;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(marketingContentWidth({ wide, narrow }), className)}>{children}</div>
  );
}
