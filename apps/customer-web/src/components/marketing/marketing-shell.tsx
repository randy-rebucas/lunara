'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { BrandMark } from '@lunara/ui';
import { ButtonLink } from '../ui/button-link';

const NAV_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Features' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#service-areas', label: 'Service areas' },
  { href: '/faq', label: 'FAQ' },
  { href: '/partners', label: 'Partners' },
] as const;

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const close = () => setMobileNavOpen(false);

  return (
    <div className="laundry-bg flex min-h-screen flex-col">
      {/* Skip to main */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-border/40 bg-surface-muted/80 shadow-sm backdrop-blur-md">
        <div className="marketing-container py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5" onClick={close}>
              <BrandMark variant="customer" compact size="sm" />
              <span className="font-bold tracking-tight text-primary">{appConfig.name}</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-5 text-sm font-medium text-muted lg:flex" aria-label="Main navigation">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="transition-colors hover:text-primary">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link href="/login" className="link-primary hidden text-sm sm:inline">
                Sign in
              </Link>
              <ButtonLink href="/signup" size="sm" layout="inline" className="hidden sm:inline-flex">
                Book now
              </ButtonLink>

              {/* Hamburger — mobile only */}
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 lg:hidden"
                aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((v) => !v)}
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="border-t border-border/40 bg-surface-muted/95 backdrop-blur-md lg:hidden">
            <nav className="marketing-container flex flex-col gap-1 py-4" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-primary"
                  onClick={close}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-4">
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-slate-100 hover:text-primary"
                  onClick={close}
                >
                  Sign in
                </Link>
                <ButtonLink href="/signup" size="sm" layout="responsive" onClick={close}>
                  Book laundry pickup
                </ButtonLink>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1">{children}</main>

      <footer className="bg-primary text-white">
        <div className="marketing-container py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
            {/* Brand col */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1">
                  <BrandMark variant="customer" compact size="sm" />
                </span>
                <span className="font-bold tracking-tight">{appConfig.name}</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
                {appConfig.tagline}
              </p>
              <a
                href="https://play.google.com/store/apps/details?id=com.lunara.customer"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M3.18 23.76a2 2 0 0 0 2.85-.06l.06-.07 9.74-9.73-2.6-2.6L3.18 23.76zM20.47 10.7l-2.5-1.44-2.91 2.91 2.91 2.9 2.52-1.45a1.43 1.43 0 0 0 0-2.92zM2 2.45A1.42 1.42 0 0 0 1.5 3.5v17a1.42 1.42 0 0 0 .5 1.06l.07.06 9.56-9.56v-.22L2.07 2.38 2 2.45zm10.27 10.6L3.18.24A2 2 0 0 0 .33.18L13.23 13.05l-1-2z" />
                </svg>
                Get it on Google Play
              </a>
            </div>

            {/* Customer links */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/60">Customer</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  { href: '/#how-it-works', label: 'How it works' },
                  { href: '/#pricing', label: 'Pricing' },
                  { href: '/locations', label: 'Locations' },
                  { href: '/faq', label: 'FAQ' },
                  { href: '/login', label: 'Sign in' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/80 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Business links */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/60">Business</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  { href: '/partners', label: 'Become a partner' },
                  { href: '/partners/apply', label: 'Partner application' },
                  { href: '/riders', label: 'Become a rider' },
                  { href: '/riders/apply', label: 'Rider application' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/80 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA col */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/60">
                Get started
              </h3>
              <div className="mt-4 flex flex-col gap-2.5">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-blue-50"
                >
                  Book a pickup
                </Link>
                <Link
                  href="/partners"
                  className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10"
                >
                  Partner with us
                </Link>
              </div>
              <ul className="mt-5 space-y-2 text-xs text-white/70">
                <li>
                  <Link href="/privacy" className="transition-colors hover:text-white">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition-colors hover:text-white">
                    Terms of service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-white/15 pt-6 text-center text-xs text-white/70">
            © {new Date().getFullYear()} {appConfig.name}. Laundry pickup &amp; delivery, simplified.
          </div>
        </div>
      </footer>
    </div>
  );
}
