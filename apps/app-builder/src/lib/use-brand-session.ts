'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lunara-app-builder:brand-session';

interface BrandSession {
  token: string;
  email: string;
}

/** Session for a self-service brand-owner account, created via the public "claim" flow.
 *  Kept separate from the admin bearer-token flow in use-admin-token.ts. */
export function useBrandSession() {
  const [session, setSession] = useState<BrandSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        // ignore corrupt storage
      }
    }
    setLoaded(true);
  }, []);

  function setBrandSession(next: BrandSession) {
    setSession(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function clearBrandSession() {
    setSession(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return { session, loaded, setBrandSession, clearBrandSession };
}
