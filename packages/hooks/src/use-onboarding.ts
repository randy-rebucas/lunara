'use client';

import { useCallback, useState } from 'react';
import { fetchOnboardingStatus, getOnboardingPath, type OnboardingStatus } from './onboarding';

export function useOnboarding(api: { get: <T>(path: string) => Promise<{ data: T }> } | null) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!api) return null;
    setLoading(true);
    try {
      const next = await fetchOnboardingStatus(api);
      setStatus(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const redirectPath = status ? getOnboardingPath(status) : '/dashboard';

  return { status, loading, refresh, redirectPath, getOnboardingPath };
}

export { fetchOnboardingStatus, getOnboardingPath, type OnboardingStatus };
