'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PartnerBrandConfig } from '@lunara/types';
import { getMyBranding, getPartnerToken, getPublicBranding } from '../lib/partner-api';

interface PartnerBrandingState {
  brandConfig: PartnerBrandConfig | null;
  isDefault: boolean;
  loading: boolean;
}

/** Resolves the active partner's branding: the authenticated tenant's own brand once logged in,
 * or a lookup by the /{partnerSlug} route segment beforehand (so login/signup can be branded). */
export function usePartnerBranding(): PartnerBrandingState {
  const { partnerSlug } = useParams<{ partnerSlug: string }>();
  const [state, setState] = useState<PartnerBrandingState>({
    brandConfig: null,
    isDefault: true,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const hasToken = getPartnerToken();
    if (!hasToken && !partnerSlug) {
      // Bare "/" root, unauthenticated — nothing to brand yet.
      setState({ brandConfig: null, isDefault: true, loading: false });
      return;
    }
    const fetchBranding = hasToken ? getMyBranding() : getPublicBranding(partnerSlug);
    fetchBranding
      .then((data) => {
        if (cancelled) return;
        setState({ brandConfig: data.brandConfig, isDefault: data.isDefault, loading: false });
      })
      .catch(() => {
        // Fall back to default branding on any error — never block the portal on this.
        if (!cancelled) setState({ brandConfig: null, isDefault: true, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [partnerSlug]);

  return state;
}
