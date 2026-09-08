/** Builds a small accent palette (hex) from a hue in degrees, so the coded phone
 * mockups can recolor themselves entirely from the partner's logo instead of
 * defaulting to Lunara's indigo. */
export interface BrandPalette {
  primary: string;
  primaryDark: string;
  primaryTint: string;
}

const LUNARA_HUE = 245;

/** h in degrees (0-360); s and l as percentages (0-100), matching css hsl(). */
function hslToHex(h: number, sPct: number, lPct: number): string {
  const s = sPct / 100;
  const l = lPct / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function buildPalette(hue: number | null): BrandPalette {
  const h = hue ?? LUNARA_HUE;
  return {
    primary: hslToHex(h, 68, 52),
    primaryDark: hslToHex(h, 60, 32),
    primaryTint: hslToHex(h, 65, 95),
  };
}

export const DEFAULT_PALETTE = buildPalette(null);
