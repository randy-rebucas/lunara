'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchOnboardingStatus } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';

export interface ProtectedPageOptions {
  /** Redirect incomplete onboarding to profile/address steps. */
  requireOnboarding?: boolean;
  /** Where to send unauthenticated users (default `/login`). */
  loginPath?: '/login' | '/signup';
}

/**
 * Client-side route guard. Returns `ready` when the user may view the page.
 * Shows loading state via `isLoading` until auth (and optional onboarding) checks finish.
 */
export function useProtectedPage(options: ProtectedPageOptions = {}) {
  const { requireOnboarding = false, loginPath = '/login' } = options;
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(!requireOnboarding);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(loginPath);
    }
  }, [isLoading, isAuthenticated, loginPath, router]);

  useEffect(() => {
    if (!requireOnboarding || isLoading || !isAuthenticated) return;

    let cancelled = false;
    setOnboardingChecked(false);
    fetchOnboardingStatus(api)
      .then((status) => {
        if (cancelled) return;
        if (!status.isComplete) {
          router.replace(status.needsProfile ? '/onboarding/profile' : '/onboarding/address');
        } else {
          setOnboardingChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setOnboardingChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [requireOnboarding, isLoading, isAuthenticated, api, router]);

  const ready = !isLoading && isAuthenticated && onboardingChecked;

  return { isAuthenticated, isLoading, ready };
}
