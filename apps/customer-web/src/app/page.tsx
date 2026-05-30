'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@lunara/ui';
import { appConfig } from '@lunara/config';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';

export default function HomePage() {
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    fetchOnboardingStatus(api).then((status) => {
      router.replace(getOnboardingPath(status));
    });
  }, [isLoading, isAuthenticated, api, router]);

  if (isLoading) return null;
  if (isAuthenticated) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary">{appConfig.name}</h1>
        <p className="mt-2 text-lg text-slate-600">{appConfig.tagline}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/signup">
          <Button>Sign Up</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline">Sign In</Button>
        </Link>
      </div>
      <p className="text-center text-sm text-slate-500">
        New here? Sign up with your mobile number — we&apos;ll guide you through setup.
      </p>
    </main>
  );
}