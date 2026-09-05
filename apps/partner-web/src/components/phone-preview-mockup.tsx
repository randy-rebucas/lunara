'use client';

import { Icon, ICONS } from './ui/icon';

interface PhonePreviewMockupProps {
  logoUrl?: string;
  businessName: string;
}

const CALENDAR_ICON =
  'M6.75 3v2.25m10.5-2.25v2.25M3.75 18.75V7.5a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v11.25m-16.5 0a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25m-16.5 0V11.25a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v7.5';
const WALLET_ICON =
  'M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6.75A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V12m18 0V9.75A2.25 2.25 0 0018.75 7.5h-13.5A2.25 2.25 0 003 9.75V12';
const SHIELD_ICON =
  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.286z';
const ZAP_ICON = 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z';
const HOME_ICON =
  'M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0L21.75 12M4.5 9.75V21a.75.75 0 00.75.75h4.5v-6a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v6h4.5a.75.75 0 00.75-.75V9.75';
const PROFILE_ICON = 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0';
const GIFT_ICON =
  'M12 8.25v13.5m0-13.5c-1.5-3-4.5-3.75-6-2.25s-.75 4.5 2.25 6h3.75zm0 0c1.5-3 4.5-3.75 6-2.25s.75 4.5-2.25 6H12zM4.5 12.75h15v6.75a1.5 1.5 0 01-1.5 1.5h-12a1.5 1.5 0 01-1.5-1.5v-6.75zM2.25 8.25h19.5v4.5H2.25v-4.5z';

const FEATURES = [
  { icon: CALENDAR_ICON, label: 'Book pickup' },
  { icon: ICONS.box, label: 'Track orders' },
  { icon: WALLET_ICON, label: 'Pay securely' },
] as const;

const TRUST_ITEMS = [
  { icon: SHIELD_ICON, title: 'Secure', description: 'Data safe with us' },
  { icon: ZAP_ICON, title: 'Quick', description: 'Sign in in seconds' },
  { icon: ICONS.bell, title: 'Updates', description: 'Order alerts fast' },
] as const;

const QUICK_ACTIONS = [
  { icon: CALENDAR_ICON, label: 'Book Laundry' },
  { icon: ICONS.arrow, label: 'Track Order' },
  { icon: ICONS.receipt, label: 'Order History' },
  { icon: GIFT_ICON, label: 'Rewards' },
] as const;

const NAV_ITEMS = [
  { icon: HOME_ICON, label: 'Home' },
  { icon: ICONS.receipt, label: 'Orders' },
  { icon: WALLET_ICON, label: 'Wallet' },
  { icon: PROFILE_ICON, label: 'Profile' },
] as const;


function LogoBadge({ logoUrl, shopName, size = 'h-12 w-12', textSize = 'text-lg' }: { logoUrl?: string; shopName: string; size?: string; textSize?: string }) {
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-border/60`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`${textSize} font-bold text-primary`}>{shopName.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function IntroScreen({ logoUrl, shopName }: { logoUrl?: string; shopName: string }) {
  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden px-3.5 pb-3 pt-9 text-center">
      <div
        className="pointer-events-none absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/10"
        aria-hidden
      />
      <div className="relative">
        <LogoBadge logoUrl={logoUrl} shopName={shopName} />
      </div>
      <p className="relative mt-2 text-[10px] font-bold uppercase tracking-wide text-primary">{shopName}</p>
      <h3 className="relative mt-1.5 text-base font-extrabold leading-tight text-slate-900">
        Laundry made simple
      </h3>

      <div className="relative mt-4 w-full space-y-1.5">
        <div className="w-full rounded-lg bg-primary py-2 text-[11px] font-bold text-white shadow-sm">
          Get started
        </div>
        <div className="w-full rounded-lg py-2 text-[11px] font-semibold text-slate-700 ring-1 ring-border/60">
          Sign in
        </div>
      </div>

      <p className="relative mt-2.5 text-[9px] font-medium text-slate-500">Secure · Reliable · Convenient</p>

      <div className="relative mt-3 grid w-full grid-cols-3 gap-1.5">
        {FEATURES.map((f) => (
          <div key={f.label} className="rounded-lg bg-surface-muted px-1 py-2 ring-1 ring-border/50">
            <Icon d={f.icon} className="mx-auto h-3.5 w-3.5 text-primary" />
            <p className="mt-1 text-[8px] font-semibold leading-tight text-slate-700">{f.label}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-auto w-full rounded-lg bg-primary/10 px-2 py-1.5 text-[9px] font-medium text-primary">
        New here? Get 20% off your first order!
      </div>
    </div>
  );
}

function AuthScreen({ logoUrl, shopName }: { logoUrl?: string; shopName: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="bg-primary/10 px-3.5 pb-5 pt-9">
        <div className="flex items-center gap-2">
          <LogoBadge logoUrl={logoUrl} shopName={shopName} size="h-8 w-8" textSize="text-xs" />
          <div className="min-w-0 text-left">
            <p className="truncate text-[11px] font-bold text-slate-900">{shopName}</p>
            <p className="truncate text-[8px] text-primary">Laundry made simple</p>
          </div>
        </div>
        <h3 className="mt-3 text-left text-sm font-extrabold text-slate-900">Welcome back!</h3>
        <p className="mt-0.5 text-left text-[9px] text-slate-500">Sign in to book and track your laundry.</p>
      </div>

      <div className="flex flex-1 flex-col px-3.5 py-3">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-primary/10 py-1.5 text-center text-[9px] font-semibold text-primary ring-1 ring-primary/40">
            Phone OTP
          </div>
          <div className="rounded-lg py-1.5 text-center text-[9px] font-semibold text-slate-500 ring-1 ring-border/60">
            Email
          </div>
        </div>

        <div className="mt-2 rounded-lg px-2.5 py-2 text-left text-[9px] text-slate-400 ring-1 ring-border/60">
          +63 &nbsp;·&nbsp; Mobile number
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="text-center">
              <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon d={t.icon} className="h-3 w-3" />
              </span>
              <p className="mt-1 text-[7.5px] font-semibold leading-tight text-slate-700">{t.title}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto w-full rounded-lg bg-primary py-2 text-center text-[11px] font-bold text-white shadow-sm">
          Send OTP
        </div>
        <p className="mt-2 text-center text-[8.5px] text-slate-500">
          New here? <span className="font-semibold text-primary">Create account</span>
        </p>
      </div>
    </div>
  );
}

function HomeScreen({ logoUrl, shopName }: { logoUrl?: string; shopName: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 px-3.5 pb-2.5 pt-9">
        <p className="text-[11px] font-bold text-slate-900">Home</p>
        <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon d={ICONS.bell} className="h-3 w-3" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
        </span>
      </div>

      <div className="flex-1 overflow-hidden px-3.5 py-2.5">
        <div className="flex items-center justify-between rounded-xl bg-primary/10 px-2.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold text-primary">Good evening!</p>
            <p className="mt-0.5 text-[7.5px] leading-tight text-slate-600">
              Fresh clothes, happy you. We handle the rest.
            </p>
          </div>
          <LogoBadge logoUrl={logoUrl} shopName={shopName} size="h-8 w-8" textSize="text-xs" />
        </div>

        <p className="mt-2.5 text-left text-[9px] font-bold text-slate-900">Quick actions</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <div key={a.label} className="rounded-lg py-2 text-center ring-1 ring-border/50">
              <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon d={a.icon} className="h-3 w-3" />
              </span>
              <p className="mt-1 text-[7.5px] font-semibold leading-tight text-slate-700">{a.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-2.5 rounded-lg bg-primary px-2.5 py-2 text-left text-white">
          <p className="text-[7px] font-bold uppercase tracking-wide text-white/80">Hot deal</p>
          <p className="text-[10px] font-bold leading-tight">Welcome discount</p>
          <p className="text-[7.5px] text-white/80">10% off your first order</p>
        </div>
      </div>

      <div className="flex items-center justify-around border-t border-border/60 px-2 py-1.5">
        {NAV_ITEMS.map((n, i) => (
          <div key={n.label} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-primary' : 'text-slate-400'}`}>
            <Icon d={n.icon} className="h-3.5 w-3.5" />
            <span className="text-[6.5px] font-semibold">{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-[168px] shrink-0 snap-center">
      <div className="rounded-[1.6rem] border-[5px] border-slate-900 bg-slate-900 shadow-xl">
        <div className="relative h-[336px] w-full overflow-hidden rounded-[1.3rem] bg-gradient-to-b from-indigo-50 via-white to-white">
          <div className="absolute left-1/2 top-0 z-10 h-3 w-16 -translate-x-1/2 rounded-b-lg bg-slate-900" aria-hidden />
          {children}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

/** Static phone-frame mockups of the customer app's intro, sign-in, and home screens with the
 * partner's uploaded logo and business name, shown side by side — mirrors the real
 * customer-mobile screens so partners see what their branded app looks like across the flow. */
export function PhonePreviewMockup({ logoUrl, businessName }: PhonePreviewMockupProps) {
  const shopName = businessName.trim() || 'Your Shop';

  return (
    <div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        <PhoneFrame label="Intro">
          <IntroScreen logoUrl={logoUrl} shopName={shopName} />
        </PhoneFrame>
        <PhoneFrame label="Sign in">
          <AuthScreen logoUrl={logoUrl} shopName={shopName} />
        </PhoneFrame>
        <PhoneFrame label="Home">
          <HomeScreen logoUrl={logoUrl} shopName={shopName} />
        </PhoneFrame>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Preview of your branded customer app
      </p>
    </div>
  );
}
