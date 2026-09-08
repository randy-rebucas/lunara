'use client';

import { useEffect, useState } from 'react';
import { extractDominantHue } from '../lib/extract-image-hue';

interface PhonePreviewMockupProps {
  logoUrl?: string;
  businessName: string;
  /** 'branded' shows all three screens with the partner's own logo/colors; 'default'
   * (no custom branding) only shows the Book screen, so they can still see where
   * their shop appears in the default Lunara-branded app. */
  variant?: 'branded' | 'default';
}

/** Hue (degrees) of the purple/indigo accent baked into the reference
 * screenshots — the filter below rotates from this hue toward the logo's. */
const BASE_ACCENT_HUE = 245;

/** Position of the first real shop card in book.jpg's list — this is where the
 * partner's own listing gets overlaid so they can see where they'd show up. */
const SHOP_CARD_BOX = { left: 4.5, top: 46.7, width: 86.5, height: 14.0 };
/** The blank logo placeholder square already baked into that card. */
const SHOP_LOGO_BOX = { left: 9.0, top: 49.2, width: 12.2, height: 5.8 };
/** The "3D Laundry Hub - 59 Salv..." name line, covered with the partner's own name.
 * Tall/low enough to fully swallow the original text's line-height, not just its top half. */
const SHOP_NAME_BOX = { left: 23.5, top: 47.0, width: 67, height: 6.2 };

/** The "LUNARA" caption printed under the logo on intro.jpg. */
const INTRO_CAPTION_BOX = { left: 18, top: 14.2, width: 64, height: 5.6 };

/** The small top-left icon + "Lunara" / tagline cluster on auth.jpg. */
const AUTH_MINI_LOGO_BOX = { left: 3.8, top: 6.5, width: 11, height: 5.4 };
const AUTH_NAME_BOX = { left: 15.6, top: 5.8, width: 42, height: 8.2 };

const SCREENS = [
  {
    src: '/images/intro.jpg',
    label: 'Intro',
    logoBoxes: [{ left: 40.6, top: 9.1, width: 16.3, height: 7.4 }],
    nameBox: INTRO_CAPTION_BOX,
    nameVariant: 'caption' as const,
    shopCard: false,
  },
  {
    src: '/images/auth.jpg',
    label: 'Sign in',
    logoBoxes: [
      { left: 60.6, top: 6.8, width: 34.9, height: 16.1 },
      AUTH_MINI_LOGO_BOX,
    ],
    nameBox: AUTH_NAME_BOX,
    nameVariant: 'header' as const,
    shopCard: false,
  },
  { src: '/images/book.jpg', label: 'Book', logoBoxes: [], nameBox: null, nameVariant: 'caption' as const, shopCard: true },
] as const;

function ShopCardHighlight({ logoUrl, businessName }: { logoUrl?: string; businessName: string }) {
  const shopName = businessName.trim() || 'Your Shop';
  return (
    <>
      <div className="absolute rounded-lg ring-2 ring-primary" style={boxStyle(SHOP_CARD_BOX)} aria-hidden />
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="absolute rounded-md object-cover" style={boxStyle(SHOP_LOGO_BOX)} />
      )}
      <div className="absolute flex items-center overflow-hidden bg-white px-1" style={boxStyle(SHOP_NAME_BOX)}>
        <p className="w-full truncate text-[9px] font-extrabold leading-tight text-slate-900">{shopName}</p>
      </div>
      <div
        className="absolute flex -translate-x-1/2 flex-col items-center"
        style={{ left: `${SHOP_CARD_BOX.left + SHOP_CARD_BOX.width / 2}%`, top: `${SHOP_CARD_BOX.top - 8}%` }}
      >
        <span className="whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white shadow-sm">
          {shopName} shows up here
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" className="text-primary">
          <path d="M0 0L5 6L10 0Z" fill="currentColor" />
        </svg>
      </div>
    </>
  );
}

type Box = { left: number; top: number; width: number; height: number };

function boxStyle(box: Box) {
  return { left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` };
}

const ZOOM_ICON = 'M21 21l-4.34-4.34m0 0a7.5 7.5 0 10-10.6-10.6 7.5 7.5 0 0010.6 10.6zM10.5 7.5v6m-3-3h6';
const CLOSE_ICON = 'M6 18L18 6M6 6l12 12';

/** The screen content shared between the small grid thumbnails and the zoomed
 * lightbox — only the surrounding chrome/sizing differs between the two. */
function PhoneScreenContent({
  src,
  hueRotate,
  logoUrl,
  logoBoxes,
  nameBox,
  nameVariant,
  shopCard,
  businessName,
}: {
  src: string;
  hueRotate: number;
  logoUrl?: string;
  logoBoxes: readonly Box[];
  nameBox: Box | null;
  nameVariant: 'caption' | 'header';
  shopCard: boolean;
  businessName: string;
}) {
  const shopName = businessName.trim() || 'Your Shop';
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover object-top"
        style={{ filter: hueRotate ? `hue-rotate(${hueRotate}deg) saturate(1.05)` : undefined }}
      />
      {logoUrl &&
        logoBoxes.map((box, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={logoUrl}
            alt=""
            className="absolute rounded-lg object-cover shadow-md ring-1 ring-white/70"
            style={boxStyle(box)}
          />
        ))}
      {nameBox && nameVariant === 'caption' && (
        <div
          className="absolute flex items-center justify-center overflow-hidden bg-white px-1"
          style={boxStyle(nameBox)}
        >
          <p className="w-full truncate text-center text-[8px] font-bold uppercase tracking-wide text-primary">
            {shopName}
          </p>
        </div>
      )}
      {nameBox && nameVariant === 'header' && (
        <div
          className="absolute flex flex-col justify-center overflow-hidden rounded-md bg-white px-1.5 text-left shadow-sm"
          style={boxStyle(nameBox)}
        >
          <p className="w-full truncate text-[9px] font-extrabold leading-tight text-slate-900">{shopName}</p>
          <p className="w-full truncate text-[7px] leading-tight text-primary">Laundry made simple</p>
        </div>
      )}
      {shopCard && <ShopCardHighlight logoUrl={logoUrl} businessName={businessName} />}
    </>
  );
}

type PhoneFrameProps = {
  src: string;
  label: string;
  hueRotate: number;
  logoUrl?: string;
  logoBoxes: readonly Box[];
  nameBox: Box | null;
  nameVariant: 'caption' | 'header';
  shopCard: boolean;
  businessName: string;
};

function PhoneFrame({ label, onZoom, ...content }: PhoneFrameProps & { onZoom: () => void }) {
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
          <PhoneScreenContent {...content} />
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/25">
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

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function ZoomLightbox({ label, onClose, ...content }: PhoneFrameProps & { onClose: () => void }) {
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
            <PhoneScreenContent {...content} />
          </div>
        </div>
        <p className="mt-4 text-center text-sm font-medium text-white/80">{label}</p>
      </div>
    </div>
  );
}

/** Phone-frame previews built from real customer-mobile screenshots (intro, sign-in,
 * book) with the partner's uploaded logo overlaid on top and the screenshots' accent
 * color hue-rotated to roughly match the logo, so partners get a feel for their
 * branded app without us having to regenerate the screens per brand. */
export function PhonePreviewMockup({ logoUrl, businessName, variant = 'branded' }: PhonePreviewMockupProps) {
  const [hueRotate, setHueRotate] = useState(0);
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);
  const screens = variant === 'default' ? SCREENS.filter((s) => s.shopCard) : SCREENS;
  const zoomedScreen = screens.find((s) => s.src === zoomedSrc);

  useEffect(() => {
    if (!logoUrl) {
      setHueRotate(0);
      return;
    }
    let cancelled = false;
    extractDominantHue(logoUrl).then((hue) => {
      if (cancelled || hue === null) return;
      setHueRotate(((hue - BASE_ACCENT_HUE) + 360) % 360);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return (
    <div>
      <p className="alert-info mb-4 text-xs">
        {variant === 'default'
          ? "Here's where your shop shows up to customers in the default Lunara app."
          : 'This preview illustrates the design and colors that will be applied across every screen of your customer-facing mobile app.'}
      </p>
      <div className={variant === 'default' ? 'grid grid-cols-1 justify-items-center' : 'grid grid-cols-3 gap-3'}>
        {screens.map((screen) => (
          <PhoneFrame
            key={screen.src}
            src={screen.src}
            label={screen.label}
            hueRotate={hueRotate}
            logoUrl={logoUrl}
            logoBoxes={screen.logoBoxes}
            nameBox={screen.nameBox}
            nameVariant={screen.nameVariant}
            shopCard={screen.shopCard}
            businessName={businessName}
            onZoom={() => setZoomedSrc(screen.src)}
          />
        ))}
      </div>

      {zoomedScreen && (
        <ZoomLightbox
          src={zoomedScreen.src}
          label={zoomedScreen.label}
          hueRotate={hueRotate}
          logoUrl={logoUrl}
          logoBoxes={zoomedScreen.logoBoxes}
          nameBox={zoomedScreen.nameBox}
          nameVariant={zoomedScreen.nameVariant}
          shopCard={zoomedScreen.shopCard}
          businessName={businessName}
          onClose={() => setZoomedSrc(null)}
        />
      )}
    </div>
  );
}
