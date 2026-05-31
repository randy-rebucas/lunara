export const theme = {
  colors: {
    primary: '#4F46E5',
    secondary: '#06B6D4',
    accent: '#22C55E',
    background: '#F8FAFC',
    foreground: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    destructive: '#EF4444',
  },
  fonts: {
    sans: 'Inter, system-ui, sans-serif',
  },
} as const;

export const marketingConfig = {
  websiteUrl: 'https://lunara.app',
  shareHashtag: 'LunaraLaundry',
} as const;

export const appConfig = {
  name: 'Lunara',
  tagline: 'Laundry made simple',
  defaultCurrency: 'PHP',
  defaultLocale: 'en-PH',
  supportEmail: 'support@lunara.dev',
  marketing: marketingConfig,
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
} as const;

/** Share URL with fallback for stale bundles missing appConfig.marketing. */
export function getShareWebsiteUrl(): string {
  return appConfig.marketing?.websiteUrl ?? marketingConfig.websiteUrl;
}
