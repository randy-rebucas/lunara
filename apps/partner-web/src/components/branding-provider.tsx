'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePartnerBranding } from '../hooks/use-partner-branding';

const UNAUTHENTICATED_PATHS = new Set(['/login', '/offline']);

/** Applies the logged-in partner's brand colors (as CSS custom properties already consumed by
 * globals.css, matching customer-web's --lunara-* pattern) and display name once authenticated.
 * No-ops (default Lunara theme) for brandless partners, unauthenticated pages, or fetch errors. */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skip = UNAUTHENTICATED_PATHS.has(pathname);
  const { brandConfig, isDefault } = usePartnerBranding();

  useEffect(() => {
    const root = document.documentElement;
    if (skip || isDefault || !brandConfig) {
      root.style.removeProperty('--lunara-primary');
      root.style.removeProperty('--lunara-secondary');
      root.style.removeProperty('--lunara-accent');
      root.style.removeProperty('--lunara-border');
      document.title = 'Lunara Business Account';
      return;
    }
    root.style.setProperty('--lunara-primary', brandConfig.colors.primary);
    root.style.setProperty('--lunara-secondary', brandConfig.colors.secondary);
    root.style.setProperty('--lunara-accent', brandConfig.colors.accent);
    root.style.setProperty('--lunara-border', brandConfig.colors.border);
    document.title = `${brandConfig.appDisplayName} Business Account`;
  }, [skip, isDefault, brandConfig]);

  return <>{children}</>;
}
