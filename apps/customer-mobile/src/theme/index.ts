import Constants from 'expo-constants';
import { resolveTheme, type PartnerThemeOverride } from '@lunara/config';

const partnerTheme = (Constants.expoConfig?.extra?.partnerTheme ?? null) as PartnerThemeOverride | null;
const resolvedTheme = resolveTheme(partnerTheme ?? undefined);

/** "Lunara" for the default app, or the partner's `theme.appDisplayName` for a white-labeled build. */
export const brandName = resolvedTheme.appName;

/** Default Lunara tagline, or the partner's `theme.tagline` when set in their manifest.json. */
export const brandTagline = resolvedTheme.tagline;

// Set only when partner-brands/<slug>/fonts/Regular.{ttf,otf} exists — see app.config.js.
// Falls back to the OS system font (undefined fontFamily) otherwise.
const partnerFontFamily = Constants.expoConfig?.extra?.partnerFontFamily as
  | { regular: string; bold: string }
  | null
  | undefined;
const fontRegular = partnerFontFamily?.regular;
const fontBold = partnerFontFamily?.bold;

/** Mobile design tokens — partner-brand colors merged over the default Lunara theme */
export const colors = {
  ...resolvedTheme.colors,
  surface: '#FFFFFF',
  surfaceMuted: resolvedTheme.colors.background,
  primaryLight: '#EEF2FF',
  primaryBorder: '#C7D2FE',
  primaryDark: '#4338CA',
  secondaryLight: '#ECFEFF',
  secondaryDark: '#0E7490',
  accentLight: '#DCFCE7',
  accentDark: '#166534',
  warning: '#92400E',
  warningBg: '#FEF3C7',
  warningBorder: '#FCD34D',
  mutedForeground: '#94A3B8',
  slate700: '#334155',
  slate800: '#1E293B',
  onPrimary: '#FFFFFF',
  star: '#F59E0B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

export const typography = {
  hero: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5, color: colors.foreground, fontFamily: fontBold },
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.foreground, fontFamily: fontBold },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.foreground, fontFamily: fontBold },
  subheading: { fontSize: 18, fontWeight: '600' as const, color: colors.foreground, fontFamily: fontBold },
  body: { fontSize: 15, lineHeight: 22, color: colors.slate700, fontFamily: fontRegular },
  bodySm: { fontSize: 13, lineHeight: 20, color: colors.muted, fontFamily: fontRegular },
  caption: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground, fontFamily: fontRegular },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.mutedForeground,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    fontFamily: fontBold,
  },
} as const;
