'use client';

import { useEffect, useState } from 'react';
import type { AppNavStyle, AppScreen, BrandTheme } from '@lunara/types';
import { getPublicPreset } from './app-config-api';

const PUBLIC_PRESET_SLUG = 'base';

const STORAGE_KEY = 'lunara-app-builder:anon-draft';

export interface AnonymousDraft {
  brandName: string;
  theme: BrandTheme;
  screens: AppScreen[];
  navStyle: AppNavStyle;
  /** Whether the visitor has completed the brand + screen-picker onboarding steps. Gates
   *  whether the wizard or the editor renders on load. */
  wizardCompleted: boolean;
}

export const DEFAULT_THEME: BrandTheme = {
  primary: '#4f46e5',
  secondary: '#06b6d4',
  accent: '#22c55e',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  border: '#e2e8f0',
  destructive: '#ef4444',
};

function defaultDraft(): AnonymousDraft {
  return {
    brandName: '',
    theme: DEFAULT_THEME,
    screens: [],
    navStyle: 'tabs',
    wizardCompleted: false,
  };
}

/** Keeps the anonymous builder's in-progress design in localStorage so a refresh doesn't lose
 *  work — no server round trip until the user claims their design. */
export function useAnonymousDraft() {
  const [draft, setDraft] = useState<AnonymousDraft>(defaultDraft);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setDraft(JSON.parse(stored));
      } catch {
        // ignore corrupt storage, keep default
      }
      setLoaded(true);
      return;
    }

    // First-ever visit: seed the starter theme colors from the public preset so the brand step
    // has a pleasant default palette. Screens are chosen by the visitor in the wizard, not preset.
    getPublicPreset(PUBLIC_PRESET_SLUG)
      .then((preset) => {
        setDraft((d) => ({ ...d, theme: preset.theme }));
      })
      .catch(() => {
        // preset unavailable — fall back to the default theme
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, loaded]);

  function clearDraft() {
    window.localStorage.removeItem(STORAGE_KEY);
    setDraft(defaultDraft());
  }

  return { draft, setDraft, loaded, clearDraft };
}
