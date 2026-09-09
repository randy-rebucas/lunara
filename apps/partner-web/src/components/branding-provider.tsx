'use client';

import { useEffect } from 'react';
import { usePartnerBranding } from '../hooks/use-partner-branding';

/** Applies the active partner's brand colors (as CSS custom properties already consumed by
 * globals.css, matching customer-web's --lunara-* pattern) and display name — resolved by the
 * /{partnerSlug} route segment pre-login, and by the authenticated tenant afterward.
 * No-ops (default Lunara theme) for brandless partners or fetch errors. */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { brandConfig, isDefault } = usePartnerBranding();

  useEffect(() => {
    const root = document.documentElement;
    if (isDefault || !brandConfig) {
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
  }, [isDefault, brandConfig]);

  return <>{children}</>;
}
