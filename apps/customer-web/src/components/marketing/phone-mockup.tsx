import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Bell,
  Bike,
  CalendarCheck,
  ChevronRight,
  Gift,
  Layers,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Shirt,
  Sparkles,
  Tag,
  Wallet,
  WashingMachine,
} from 'lucide-react';
import { cn } from '@lunara/ui';
import { appConfig } from '@lunara/config';

/**
 * CSS-only phone frame — no raster mockup images. Content is decorative
 * (aria-hidden) miniature app UI rendered at a fixed intrinsic width.
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
          {/* Notch pill */}
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

function ScreenTopBar({ title, back = false }: { title?: string; back?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-8">
      {back ? <ArrowLeft className="h-3 w-3 text-slate-500" /> : null}
      {title ? <p className="flex-1 text-center text-[10px] font-semibold text-slate-900">{title}</p> : null}
      {back ? <span className="h-3 w-3" /> : null}
    </div>
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

export function ScreenHome() {
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <div className="px-3 pb-3 pt-9">
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
            <WashingMachine className="h-2.5 w-2.5 text-white" />
          </span>
          <p className="text-[9px] font-bold text-primary">{appConfig.name}</p>
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

export function ScreenBooking() {
  const options = [
    { icon: Shirt, label: 'Wash & Fold', price: '₱99 / kg', active: false },
    { icon: WashingMachine, label: 'Wash, Dry & Fold', price: '₱119 / kg', active: true },
    { icon: Sparkles, label: 'Iron only', price: '₱49 / kg', active: false },
    { icon: Layers, label: 'Comforter / blanket', price: '₱199 / pc', active: false },
  ];
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <ScreenTopBar title="Booking" back />
      <div className="px-3">
        <p className="text-[8px] text-muted">Step 2 of 4</p>
        <p className="text-[11px] font-bold text-slate-900">Select service</p>
      </div>
      <div className="mt-2 flex-1 space-y-1.5 px-3">
        {options.map((option) => (
          <div
            key={option.label}
            className={cn(
              'flex items-center gap-2 rounded-xl bg-surface p-2',
              option.active ? 'ring-2 ring-primary' : 'ring-1 ring-border/60',
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                option.active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500',
              )}
            >
              <option.icon className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-semibold text-slate-900">{option.label}</p>
              <p className="text-[8px] text-muted">{option.price}</p>
            </div>
            <span
              className={cn(
                'h-3 w-3 shrink-0 rounded-full border',
                option.active ? 'border-primary bg-primary' : 'border-border',
              )}
            />
          </div>
        ))}
      </div>
      <div className="p-3">
        <div className="rounded-lg bg-primary py-2 text-center text-[9px] font-semibold text-white">
          Next
        </div>
      </div>
    </div>
  );
}

export function ScreenTracking() {
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <ScreenTopBar title="Track order" back />
      <div className="px-3">
        <p className="text-[8px] text-muted">Order #LNR-12345</p>
        <p className="text-[10px] font-bold text-slate-900">On the way</p>
      </div>
      {/* Map-ish canvas with dashed route */}
      <div className="relative mx-3 mt-2 flex-1 overflow-hidden rounded-xl bg-blue-50 ring-1 ring-border/60">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgb(191_219_254/0.5)_1px,transparent_1px),linear-gradient(90deg,rgb(191_219_254/0.5)_1px,transparent_1px)] [background-size:18px_18px]" />
        <svg viewBox="0 0 100 140" className="absolute inset-0 h-full w-full">
          <path
            d="M20 120 C 35 95, 20 70, 45 55 S 80 35, 78 18"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute left-[14%] top-[80%] flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white shadow">
          <Bike className="h-2.5 w-2.5" />
        </span>
        <span className="absolute right-[16%] top-[8%] flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white shadow">
          <MapPin className="h-2.5 w-2.5" />
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface p-2 ring-1 ring-border/60">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">
            JD
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold text-slate-900">John D. · Rider</p>
            <p className="text-[8px] text-muted">Arrives in ~12 mins</p>
          </div>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Phone className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function ScreenRewards() {
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <ScreenTopBar title="Rewards" back />
      <div className="px-3">
        <div className="rounded-xl bg-primary p-3 text-white">
          <p className="text-[8px] text-blue-100">Your balance</p>
          <p className="mt-0.5 text-base font-bold leading-none">120</p>
          <p className="text-[8px] text-blue-100">laundry credits</p>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-white/15 px-2 py-1">
            <span className="text-[8px] font-medium">Top up wallet</span>
            <Wallet className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>
      <div className="mt-2 flex-1 space-y-1.5 px-3">
        <p className="text-[9px] font-semibold text-slate-900">Ways to earn</p>
        <MiniRow icon={Gift} title="Refer a friend" subtitle="+100 credits" />
        <MiniRow
          icon={PackageCheck}
          title="Place an order"
          subtitle="+20 credits"
          tint="bg-accent/10 text-accent"
        />
      </div>
    </div>
  );
}

export function ScreenNotifications() {
  const items = [
    { icon: Bell, title: 'Order update', body: 'Your order is on the way', time: '2m' },
    { icon: Bike, title: 'Order picked up', body: 'Your laundry has been collected', time: '20m' },
    { icon: PackageCheck, title: 'Order confirmed', body: 'Your rider has been assigned', time: '45m' },
  ];
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <ScreenTopBar title="Notifications" back />
      <div className="flex-1 space-y-1.5 px-3">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-2 rounded-xl bg-surface p-2 ring-1 ring-border/60">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <item.icon className="h-2.5 w-2.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold text-slate-900">{item.title}</p>
              <p className="truncate text-[8px] text-muted">{item.body}</p>
            </div>
            <span className="text-[7px] text-muted-foreground">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
