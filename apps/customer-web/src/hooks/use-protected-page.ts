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

    // A transient failure here (network blip, 5xx) previously fell straight through to
    // "treat as complete" — letting a customer who hasn't finished onboarding (no address yet)
    // straight into pages that assume one exists, purely because one request hiccupped. Retry
    // once before falling back to fail-open, so a real outage still doesn't brick the app but a
    // one-off blip doesn't misclassify onboarding state either.
    const check = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await fetchOnboardingStatus(api);
        } catch (err) {
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          throw err;
        }
      }
      return undefined;
    };

    check()
      .then((status) => {
        if (cancelled || !status) return;
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
