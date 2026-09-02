import { createContext, useContext } from 'react';
import type { BrandTheme } from '@lunara/types';

const DEFAULT_THEME: BrandTheme = {
  primary: '#2563eb',
  secondary: '#1e40af',
  accent: '#3b82f6',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  border: '#e2e8f0',
  destructive: '#ef4444',
};

const ThemeContext = createContext<BrandTheme>(DEFAULT_THEME);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: BrandTheme | null;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={theme ?? DEFAULT_THEME}>{children}</ThemeContext.Provider>;
}

export function useTheme(): BrandTheme {
  return useContext(ThemeContext);
}
