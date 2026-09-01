'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { fetchOnboardingStatus } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { useProtectedPage } from '../hooks/use-protected-page';
import { AuthLoading } from './auth-loading';
import { IntroSlider } from './intro-slider';
import { hasSeenIntro } from '../lib/intro-slider-storage';

/** Layout gate for `(authenticated)` routes — redirects guests to login. */
export function AuthenticatedGate({ children }: { children: React.ReactNode }) {
  const { isLoading, ready } = useProtectedPage({ loginPath: '/login' });
  const { api } = useAuthContext();
  const pathname = usePathname();
  const [showIntro, setShowIntro] = useState(false);

  // Independent of each page's own `useProtectedPage({ requireOnboarding: true })` call — those are
  // separate hook instances with their own state, so this gate checks onboarding completion itself.
  // Skipped on /onboarding/* routes (nested under this same gate) to avoid showing the slider before
  // profile/address setup is actually done.
  useEffect(() => {
    if (!ready || pathname?.startsWith('/onboarding') || hasSeenIntro()) return;

    let cancelled = false;
    fetchOnboardingStatus(api)
      .then((status) => {
        if (!cancelled && status.isComplete) setShowIntro(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [ready, pathname, api]);

  if (isLoading || !ready) {
    return <AuthLoading />;
  }

  return (
    <>
      {children}
      {showIntro ? <IntroSlider onDone={() => setShowIntro(false)} /> : null}
    </>
  );
}
