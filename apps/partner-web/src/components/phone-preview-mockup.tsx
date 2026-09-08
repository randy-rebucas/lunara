'use client';

import { useEffect, useState } from 'react';
import { extractDominantHue } from '../lib/extract-image-hue';

interface PhonePreviewMockupProps {
  logoUrl?: string;
  businessName: string;
}

/** Hue (degrees) of the purple/indigo accent baked into the reference
 * screenshots — the filter below rotates from this hue toward the logo's. */
const BASE_ACCENT_HUE = 245;

const SCREENS = [
  { src: '/images/intro.jpg', label: 'Intro', logoBox: { left: 40.6, top: 9.1, width: 16.3, height: 7.4 } },
  { src: '/images/auth.jpg', label: 'Sign in', logoBox: { left: 60.6, top: 6.8, width: 34.9, height: 16.1 } },
  { src: '/images/book.jpg', label: 'Book', logoBox: null },
] as const;

function PhoneFrame({
  src,
  label,
  hueRotate,
  logoUrl,
  logoBox,
}: {
  src: string;
  label: string;
  hueRotate: number;
  logoUrl?: string;
  logoBox: { left: number; top: number; width: number; height: number } | null;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[168px] rounded-[1.6rem] border-[5px] border-slate-900 bg-slate-900 shadow-xl">
        <div className="relative h-[336px] w-full overflow-hidden rounded-[1.3rem] bg-white">
          <div className="absolute left-1/2 top-0 z-10 h-3 w-16 -translate-x-1/2 rounded-b-lg bg-slate-900" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover object-top"
            style={{ filter: hueRotate ? `hue-rotate(${hueRotate}deg) saturate(1.05)` : undefined }}
          />
          {logoUrl && logoBox && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="absolute rounded-lg object-cover shadow-md ring-1 ring-white/70"
              style={{
                left: `${logoBox.left}%`,
                top: `${logoBox.top}%`,
                width: `${logoBox.width}%`,
                height: `${logoBox.height}%`,
              }}
            />
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

/** Phone-frame previews built from real customer-mobile screenshots (intro, sign-in,
 * book) with the partner's uploaded logo overlaid on top and the screenshots' accent
 * color hue-rotated to roughly match the logo, so partners get a feel for their
 * branded app without us having to regenerate the screens per brand. */
export function PhonePreviewMockup({ logoUrl }: PhonePreviewMockupProps) {
  const [hueRotate, setHueRotate] = useState(0);

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
    <div className="grid grid-cols-3 gap-3">
      {SCREENS.map((screen) => (
        <PhoneFrame
          key={screen.src}
          src={screen.src}
          label={screen.label}
          hueRotate={hueRotate}
          logoUrl={logoUrl}
          logoBox={screen.logoBox}
        />
      ))}
    </div>
  );
}
