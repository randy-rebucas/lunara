'use client';

import { useEffect, useState } from 'react';
import { extractDominantHue } from '../lib/extract-image-hue';
import { buildPalette, DEFAULT_PALETTE, type BrandPalette } from '../lib/brand-palette';
import { LUNARA_BASE_BRAND } from '../lib/base-brand';
import { PHONE_PREVIEW_CONFIG } from './phone-preview-config';
import { ICONS } from './ui/icon';

interface PhonePreviewMockupProps {
  logoUrl?: string;
  businessName: string;
  /** 'branded' shows all three screens with the partner's own logo/colors; 'default'
   * (no custom branding) only shows the Book screen, so they can still see where
   * their shop appears in the default Lunara-branded app. */
  variant?: 'branded' | 'default';
}

const CALENDAR_ICON =
  'M6.75 3v2.25m10.5-2.25v2.25M3.75 18.75V7.5a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v11.25m-16.5 0a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25m-16.5 0V11.25a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v7.5';
const WALLET_ICON =
  'M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6.75A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V12m18 0V9.75A2.25 2.25 0 0018.75 7.5h-13.5A2.25 2.25 0 003 9.75V12';
const SHIELD_ICON =
  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.286z';
const ZAP_ICON = 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z';
const CHEVRON_ICON = 'M8.25 4.5l7.5 7.5-7.5 7.5';
const BACK_ICON = 'M15.75 19.5L8.25 12l7.5-7.5';
const PHONE_ICON =
  'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z';
const MAIL_ICON =
  'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75';
const HEART_ICON =
  'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z';
const CLOCK_ICON = 'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z';
const ZOOM_ICON = 'M21 21l-4.34-4.34m0 0a7.5 7.5 0 10-10.6-10.6 7.5 7.5 0 0010.6 10.6zM10.5 7.5v6m-3-3h6';
const CLOSE_ICON = 'M6 18L18 6M6 6l12 12';

const FEATURE_ICON: Record<string, string> = { calendar: CALENDAR_ICON, box: ICONS.box, wallet: WALLET_ICON };
const TRUST_ICON: Record<string, string> = { shield: SHIELD_ICON, zap: ZAP_ICON, bell: ICONS.bell };

function Icon({ d, className, style }: { d: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} style={style}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function LogoBadge({
  logoUrl,
  shopName,
  size = 'h-11 w-11',
  textSize = 'text-lg',
  palette,
}: {
  logoUrl?: string;
  shopName: string;
  size?: string;
  textSize?: string;
  palette: BrandPalette;
}) {
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`${textSize} font-bold`} style={{ color: palette.primary }}>
          {shopName.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

type ScreenProps = { logoUrl?: string; shopName: string; palette: BrandPalette };

function IntroScreen({ logoUrl, shopName, palette }: ScreenProps) {
  const cfg = PHONE_PREVIEW_CONFIG.intro;
  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden px-4 pb-4 pt-10 text-center">
      <div
        className="pointer-events-none absolute -top-12 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: palette.primaryTint }}
        aria-hidden
      />
      <div className="relative">
        <LogoBadge logoUrl={logoUrl} shopName={shopName} palette={palette} />
      </div>
      <p className="relative mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.primary }}>
        {shopName}
      </p>
      <h3 className="relative mt-1.5 text-base font-extrabold leading-tight text-slate-900">{cfg.headline}</h3>
      <p className="relative text-[9px] text-slate-400">{cfg.subheadline}</p>

      <div className="relative mt-4 w-full space-y-1.5">
        <div
          className="w-full rounded-lg py-2 text-[11px] font-bold text-white shadow-sm"
          style={{ backgroundColor: palette.primary }}
        >
          {cfg.primaryCta}
        </div>
        <div className="w-full rounded-lg py-2 text-[11px] font-semibold text-slate-700 ring-1 ring-border/60">
          {cfg.secondaryCta}
        </div>
      </div>

      <p className="relative mt-2.5 flex items-center gap-1 text-[8px] font-medium text-slate-500">
        <Icon d={SHIELD_ICON} className="h-2.5 w-2.5" style={{ color: palette.primary }} />
        {cfg.trustLine}
      </p>
      <p className="relative mt-1 text-[7px] text-slate-300">{cfg.paymentMethods.join('   ')}</p>

      <p className="relative mt-3 text-[9px] font-bold text-slate-900">{cfg.featuresHeading}</p>
      <div className="relative mt-1.5 grid w-full grid-cols-3 gap-1.5">
        {cfg.features.map((f) => (
          <div key={f.label} className="rounded-lg bg-surface-muted px-1 py-2 ring-1 ring-border/50">
            <span
              className="mx-auto flex h-5 w-5 items-center justify-center rounded-md"
              style={{ backgroundColor: palette.primaryTint, color: palette.primary }}
            >
              <Icon d={FEATURE_ICON[f.icon]} className="h-3 w-3" />
            </span>
            <p className="mt-1 text-[7.5px] font-semibold leading-tight" style={{ color: palette.primaryDark }}>
              {f.label}
            </p>
            <p className="text-[6.5px] leading-tight text-slate-500">{f.description}</p>
          </div>
        ))}
      </div>

      <div
        className="relative mt-auto w-full rounded-lg px-2 py-1.5 text-[9px] font-medium"
        style={{ backgroundColor: palette.primaryTint, color: palette.primaryDark }}
      >
        {cfg.promo}
      </div>
    </div>
  );
}

function AuthScreen({ logoUrl, shopName, palette }: ScreenProps) {
  const cfg = PHONE_PREVIEW_CONFIG.auth;
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-4 pb-5 pt-10" style={{ backgroundColor: palette.primaryTint }}>
        <div className="flex items-center gap-2">
          <LogoBadge logoUrl={logoUrl} shopName={shopName} size="h-8 w-8" textSize="text-xs" palette={palette} />
          <div className="min-w-0 text-left">
            <p className="truncate text-[11px] font-bold text-slate-900">{shopName}</p>
            <p className="truncate text-[8px]" style={{ color: palette.primary }}>
              {cfg.tagline}
            </p>
          </div>
        </div>
        <h3 className="mt-3 text-left text-sm font-extrabold text-slate-900">{cfg.headline}</h3>
        <p className="mt-0.5 text-left text-[9px] text-slate-500">{cfg.subheadline}</p>
      </div>

      <div className="flex flex-1 flex-col px-4 py-3">
        <div className="grid grid-cols-2 gap-1.5">
          <div
            className="flex items-center justify-center gap-1 rounded-lg py-1.5 text-center text-[9px] font-semibold ring-1"
            style={{ backgroundColor: palette.primaryTint, color: palette.primary, boxShadow: `inset 0 0 0 1px ${palette.primary}66` }}
          >
            <Icon d={PHONE_ICON} className="h-2.5 w-2.5" />
            {cfg.tabs[0]}
          </div>
          <div className="flex items-center justify-center gap-1 rounded-lg py-1.5 text-center text-[9px] font-semibold text-slate-500 ring-1 ring-border/60">
            <Icon d={MAIL_ICON} className="h-2.5 w-2.5" />
            {cfg.tabs[1]}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[9px] text-slate-400 ring-1 ring-border/60">
          <span>🇵🇭 +63</span>
          <Icon d={CHEVRON_ICON} className="h-2 w-2 rotate-90" />
          <span className="ml-1">{cfg.phonePlaceholder}</span>
        </div>
        <p className="mt-1 text-left text-[6.5px] leading-tight text-slate-400">{cfg.helperText}</p>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {cfg.trustItems.map((t) => (
            <div key={t.title} className="text-center">
              <span
                className="mx-auto flex h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: palette.primaryTint, color: palette.primary }}
              >
                <Icon d={TRUST_ICON[t.icon]} className="h-3 w-3" />
              </span>
              <p className="mt-1 text-[7.5px] font-semibold leading-tight text-slate-700">{t.title}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-auto w-full rounded-lg py-2 text-center text-[11px] font-bold text-white shadow-sm"
          style={{ backgroundColor: palette.primary }}
        >
          {cfg.submitCta}
        </div>
        <p className="mt-2 text-center text-[8.5px] text-slate-500">
          {cfg.signupPrompt} <span className="font-semibold" style={{ color: palette.primary }}>{cfg.signupCta}</span>
        </p>
      </div>
    </div>
  );
}

function BookScreen({ logoUrl, shopName, palette }: ScreenProps) {
  const cfg = PHONE_PREVIEW_CONFIG.book;
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-muted">
      <div className="flex items-center gap-2 border-b border-border/60 bg-white px-3.5 pb-2.5 pt-9">
        <span className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-border/60">
          <Icon d={BACK_ICON} className="h-3 w-3 text-slate-500" />
        </span>
        <p className="text-[11px] font-bold text-slate-900">{cfg.title}</p>
      </div>

      <div className="overflow-hidden px-3.5 pt-2.5">
        <p className="text-[7.5px] text-slate-500">{cfg.stepLabel}</p>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/4 rounded-full" style={{ backgroundColor: palette.primary }} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-3.5 py-2.5">
        <p className="text-[9px] font-bold text-slate-900">{cfg.sectionHeading}</p>

        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-dashed border-border/70 bg-white px-2 py-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: palette.primaryTint, color: palette.primary }}
          >
            <Icon d={ZAP_ICON} className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[8px] font-bold text-slate-900">{cfg.autoPick.title}</p>
            <p className="truncate text-[6.5px] leading-tight text-slate-500">{cfg.autoPick.description}</p>
          </div>
        </div>

        <div
          className="relative mt-2 rounded-lg bg-white p-2 shadow-sm ring-2"
          style={{ boxShadow: `0 0 0 2px ${palette.primary}` }}
        >
          <span
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide text-white shadow-sm"
            style={{ backgroundColor: palette.primary }}
          >
            {shopName} {cfg.pointerLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-border/60">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[9px] font-bold" style={{ color: palette.primary }}>
                  {shopName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[8px] font-bold leading-tight text-slate-900">{shopName}</p>
              <p className="flex items-center gap-0.5 text-[6.5px] text-slate-500">
                <Icon d={CLOCK_ICON} className="h-2 w-2" /> Opens today
              </p>
            </div>
            <Icon d={HEART_ICON} className="h-3 w-3 text-slate-300" />
          </div>
          <div
            className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[6.5px] font-bold"
            style={{ backgroundColor: palette.primaryTint, color: palette.primaryDark }}
          >
            From ₱299.00 / load
          </div>
        </div>

        {cfg.otherShops.map((shop) => (
          <div key={shop.name} className="mt-2 rounded-lg bg-white p-2 opacity-70 ring-1 ring-border/50">
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 shrink-0 rounded-md bg-slate-100" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[7.5px] font-bold leading-tight text-slate-600">{shop.name}</p>
                <p className="truncate text-[6.5px] text-slate-400">{shop.location}</p>
              </div>
              <Icon d={HEART_ICON} className="h-3 w-3 text-slate-200" />
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[6px] font-semibold text-slate-500">
                {shop.status}
              </span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[6px] font-semibold text-slate-500">
                {shop.price}
              </span>
            </div>
            {shop.badge && (
              <span className="mt-1 inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-[6px] font-semibold text-amber-600">
                {shop.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const SCREENS = [
  { key: 'intro', label: 'Intro', Component: IntroScreen },
  { key: 'auth', label: 'Sign in', Component: AuthScreen },
  { key: 'book', label: 'Book', Component: BookScreen },
] as const;

function PhoneChrome({
  label,
  children,
  onZoom,
}: {
  label: string;
  children: React.ReactNode;
  onZoom: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onZoom}
        className="group relative w-full max-w-[168px] rounded-[1.6rem] border-[5px] border-slate-900 bg-slate-900 shadow-xl transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Zoom into the ${label} screen`}
      >
        <div className="relative h-[336px] w-full overflow-hidden rounded-[1.3rem] bg-white">
          <div className="absolute left-1/2 top-0 z-10 h-3 w-16 -translate-x-1/2 rounded-b-lg bg-slate-900" aria-hidden />
          {children}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/25">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              <Icon d={ZOOM_ICON} className="h-4.5 w-4.5" />
            </span>
          </div>
        </div>
      </button>
      <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function ZoomLightbox({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} screen, zoomed in`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close zoomed preview"
      >
        <Icon d={CLOSE_ICON} className="h-5 w-5" />
      </button>
      <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-[280px] max-w-[80vw] rounded-[2.2rem] border-[8px] border-slate-900 bg-slate-900 shadow-2xl sm:w-[320px]">
          <div className="relative aspect-[168/336] w-full overflow-hidden rounded-[1.6rem] bg-white">
            <div className="absolute left-1/2 top-0 z-10 h-4 w-24 -translate-x-1/2 rounded-b-xl bg-slate-900" aria-hidden />
            {children}
          </div>
        </div>
        <p className="mt-4 text-center text-sm font-medium text-white/80">{label}</p>
      </div>
    </div>
  );
}

/** Fully coded phone-mockup screens (Intro, Sign in, Book) driven by
 * phone-preview-config.ts for copy and by the partner's logo/business name/extracted
 * accent color for branding — no reference screenshots or pixel overlays involved,
 * so every screen recolors and relabels itself cleanly for any partner. */
export function PhonePreviewMockup({ logoUrl, businessName, variant = 'branded' }: PhonePreviewMockupProps) {
  const [palette, setPalette] = useState<BrandPalette>(DEFAULT_PALETTE);
  const [zoomedKey, setZoomedKey] = useState<string | null>(null);
  const isDefaultBrand = variant === 'default';
  const partnerShopName = businessName.trim() || 'Your Shop';
  const zoomedScreen = SCREENS.find((s) => s.key === zoomedKey);

  useEffect(() => {
    if (isDefaultBrand || !logoUrl) {
      setPalette(DEFAULT_PALETTE);
      return;
    }
    let cancelled = false;
    extractDominantHue(logoUrl).then((hue) => {
      if (!cancelled) setPalette(buildPalette(hue));
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl, isDefaultBrand]);

  // The app shell (Intro/Sign in) reflects the base Lunara brand when the partner
  // keeps the default app; the Book screen always highlights their own real shop,
  // since that listing shows up either way.
  function screenProps(key: (typeof SCREENS)[number]['key']) {
    if (key !== 'book' && isDefaultBrand) {
      return { logoUrl: LUNARA_BASE_BRAND.logoUrl, shopName: LUNARA_BASE_BRAND.name, palette: LUNARA_BASE_BRAND.palette };
    }
    return { logoUrl, shopName: partnerShopName, palette: isDefaultBrand ? LUNARA_BASE_BRAND.palette : palette };
  }

  return (
    <div>
      <p className="alert-info mb-4 text-xs">
        {isDefaultBrand
          ? "Your customer app keeps Lunara's own look and feel — your shop still shows up when customers book."
          : 'This preview illustrates the design and colors that will be applied across every screen of your customer-facing mobile app.'}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {SCREENS.map(({ key, label, Component }) => (
          <PhoneChrome key={key} label={label} onZoom={() => setZoomedKey(key)}>
            <Component {...screenProps(key)} />
          </PhoneChrome>
        ))}
      </div>

      {zoomedScreen && (
        <ZoomLightbox label={zoomedScreen.label} onClose={() => setZoomedKey(null)}>
          <zoomedScreen.Component {...screenProps(zoomedScreen.key)} />
        </ZoomLightbox>
      )}
    </div>
  );
}
