import Constants from 'expo-constants';
import React, { createContext, useContext, useMemo } from 'react';

import { colors as defaultColors, resolveColors } from '../theme';

interface BrandContextValue {
  colors: typeof defaultColors;
  logoUrl: string | null;
  displayName: string;
}

const BrandContext = createContext<BrandContextValue>({
  colors: defaultColors,
  logoUrl: null,
  displayName: 'Lunara',
});

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<BrandContextValue>(() => {
    const extra = Constants.expoConfig?.extra ?? {};
    return {
      colors: resolveColors(extra.brandColors ?? undefined),
      logoUrl: extra.brandLogoUrl ?? null,
      displayName: extra.brandDisplayName ?? 'Lunara',
    };
  }, []);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
