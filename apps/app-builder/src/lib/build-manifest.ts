import type { BrandTheme } from './derive-theme';

export interface PartnerBrandManifest {
  appName: string;
  slug: string;
  iosBundleId: string;
  androidPackage: string;
  easProjectId: string;
  splashBackgroundColor: string;
  theme: {
    appDisplayName: string;
    colors: BrandTheme;
    fonts: { sans: string };
  };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'partner'
  );
}

/** Shapes the same fields as a partner-brands/<slug>/manifest.json — filled in with
 *  placeholders (easProjectId, bundle IDs) that ops assigns for real once a lead is claimed
 *  and scaffolded into an actual app build. */
export function buildManifest(brandName: string, theme: BrandTheme): PartnerBrandManifest {
  const slug = slugify(brandName);
  return {
    appName: brandName,
    slug: `${slug}-customer`,
    iosBundleId: `com.${slug.replace(/-/g, '')}.customer`,
    androidPackage: `com.${slug.replace(/-/g, '')}.customer`,
    easProjectId: '',
    splashBackgroundColor: theme.background,
    theme: {
      appDisplayName: brandName,
      colors: theme,
      fonts: { sans: 'Inter, system-ui, sans-serif' },
    },
  };
}
