'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lunara-app-builder:admin-token';

/** MVP auth shortcut for the internal builder tool — paste an admin bearer token (from
 *  /api/v1/auth/login) once, kept in localStorage. Replace with real admin-web SSO in Phase 3. */
export function useAdminToken() {
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  function updateToken(next: string) {
    setToken(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return { token, setToken: updateToken };
}
