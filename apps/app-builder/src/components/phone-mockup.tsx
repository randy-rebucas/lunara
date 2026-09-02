import { CalendarCheck, ChevronRight, Gift, Package, Tag, WashingMachine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@lunara/ui';
import { appConfig } from '@lunara/config';

/**
 * CSS-only phone frame — no raster mockup images, ported from customer-web's marketing phone
 * mockup so the preview matches the real app's actual UI, not a generic illustration.
 */
export function PhoneFrame({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <figure className={cn('w-56 shrink-0', className)}>
      <div className="rounded-[2.4rem] bg-slate-900 p-[6px] shadow-[0_24px_48px_-16px_rgb(15_23_42/0.35)] ring-1 ring-slate-950/60">
        <div className="relative overflow-hidden rounded-[2rem] bg-surface">
          <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-slate-900" aria-hidden />
          <div className="aspect-[9/19] overflow-hidden" aria-hidden>
            {children}
          </div>
        </div>
      </div>
      {label ? (
        <figcaption className="mt-3 text-center text-xs font-medium text-muted">{label}</figcaption>
      ) : (
        <figcaption className="sr-only">App screen preview</figcaption>
      )}
    </figure>
  );
}

function MiniRow({
  icon: Icon,
  title,
  subtitle,
  tint = 'bg-primary/10 text-primary',
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tint?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface p-2 ring-1 ring-border/60">
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', tint)}>
        <Icon className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9px] font-semibold text-slate-900">{title}</p>
        <p className="truncate text-[8px] text-muted">{subtitle}</p>
      </div>
      <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
    </div>
  );
}

export function ScreenHome({
  brandName = appConfig.name,
  logoUrl,
}: {
  brandName?: string;
  logoUrl?: string;
} = {}) {
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <div className="px-3 pb-3 pt-9">
        <div className="flex items-center gap-1.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <WashingMachine className="h-2.5 w-2.5 text-white" />
            </span>
          )}
          <p className="truncate text-[9px] font-bold text-primary">{brandName}</p>
        </div>
        <p className="mt-3 text-[9px] text-muted">Hello, Maria!</p>
        <p className="text-[11px] font-bold leading-tight text-slate-900">
          What are we washing today?
        </p>
      </div>
      <div className="flex-1 space-y-1.5 px-3">
        <MiniRow icon={CalendarCheck} title="Book now" subtitle="Schedule a pickup" />
        <MiniRow
          icon={Package}
          title="My orders"
          subtitle="Track your laundry"
          tint="bg-secondary/10 text-secondary"
        />
        <MiniRow icon={Tag} title="Offers" subtitle="Exclusive deals" tint="bg-accent/10 text-accent" />
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-2 ring-1 ring-primary/15">
          <Gift className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-primary">Refer &amp; earn</p>
            <p className="text-[8px] text-primary/70">Invite friends, get laundry credits</p>
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="rounded-lg bg-primary py-2 text-center text-[9px] font-semibold text-white">
          Book a pickup
        </div>
      </div>
    </div>
  );
}
