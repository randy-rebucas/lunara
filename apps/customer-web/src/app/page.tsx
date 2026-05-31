'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { appConfig } from '@lunara/config';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
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
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-[var(--shadow-card)]"
            aria-hidden
          >
            L
          </span>
          <span className="font-bold tracking-tight text-primary">{appConfig.name}</span>
        </div>
        <Link href="/login" className="link-primary text-sm">
          Sign in
        </Link>
      </header>

      <main className="page-container flex flex-1 flex-col items-center justify-center pb-16 pt-8">
        <div className="card-elevated page-content-narrow text-center">
          <div className="card-body space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10">
              <svg
                className="h-8 w-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
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
