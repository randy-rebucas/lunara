'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { fetchOnboardingStatus } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';

/** Redirects unauthenticated users to login and incomplete onboarding to the right step. */
export function useRequireOnboardingComplete() {
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    fetchOnboardingStatus(api).then((status) => {
      if (!status.isComplete) {
        router.replace(status.needsProfile ? '/onboarding/profile' : '/onboarding/address');
      }
    });
  }, [isLoading, isAuthenticated, api, router]);

  return { isAuthenticated, isLoading, ready: !isLoading && isAuthenticated };
}
