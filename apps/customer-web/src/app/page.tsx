'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { appConfig } from '@lunara/config';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { BrandMark } from '@lunara/ui';
import { ButtonLink } from '../components/ui/button-link';
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
    <div className="laundry-bg flex min-h-screen flex-col">
      <header className="page-container flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <BrandMark variant="customer" compact size="sm" />
          <span className="font-bold tracking-tight text-primary">{appConfig.name}</span>
        </div>
        <Link href="/login" className="link-primary text-sm">
          Sign in
        </Link>
      </header>

      <main className="page-container flex flex-1 flex-col items-center justify-center pb-16 pt-8">
        <div className="card-elevated page-content-narrow text-center">
          <div className="card-body space-y-6">
            <div className="mx-auto">
              <BrandMark variant="customer" compact size="lg" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {appConfig.name}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{appConfig.tagline}</p>
            </div>
            <div className="btn-row sm:justify-center">
              <ButtonLink href="/signup" size="lg" className="w-full sm:min-w-[180px]">
                Get started
              </ButtonLink>
              <ButtonLink
                href="/login"
                variant="outline"
                size="lg"
                className="w-full sm:min-w-[180px]"
              >
                Sign in
              </ButtonLink>
            </div>
            <p className="text-sm text-muted-foreground">
              New here? Sign up with your mobile number — we&apos;ll guide you through setup.
            </p>
          </div>
        </div>

        <div className="page-content-narrow mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Book pickup', desc: 'Schedule in minutes', color: 'text-primary' },
            { label: 'Track orders', desc: 'Live status updates', color: 'text-secondary' },
            { label: 'Pay securely', desc: 'Wallet & checkout', color: 'text-accent' },
          ].map((item) => (
            <div key={item.label} className="card text-center">
              <div className="card-body py-4">
                <p className={`text-sm font-semibold ${item.color}`}>{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
