'use client';

import { useEffect, useState } from 'react';
import type { PartnerBrandConfig } from '@lunara/types';
import { getMyBranding, getPartnerToken } from '../lib/partner-api';

interface PartnerBrandingState {
  brandConfig: PartnerBrandConfig | null;
  isDefault: boolean;
  loading: boolean;
}

export function usePartnerBranding(): PartnerBrandingState {
  const [state, setState] = useState<PartnerBrandingState>({
    brandConfig: null,
    isDefault: true,
    loading: true,
  });

  useEffect(() => {
    if (!getPartnerToken()) {
      setState({ brandConfig: null, isDefault: true, loading: false });
      return;
    }
    let cancelled = false;
    getMyBranding()
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
  }, []);

  return state;
}
