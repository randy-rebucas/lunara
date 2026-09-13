'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  ShoppingBag,
  Receipt,
  Wallet,
  Gift,
  LifeBuoy,
  Undo2,
  MoreHorizontal,
  Plus,
  X,
} from 'lucide-react';
import { appConfig } from '@lunara/config';
import { BrandMark } from '@lunara/ui';
import { ButtonLink } from './ui/button-link';
import { CustomerHeaderMenu } from './customer-header-menu';
import { NotificationBell } from './notification-bell';

const tabLinks = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/book', label: 'Book', icon: ShoppingBag },
  { href: '/orders', label: 'Orders', icon: Receipt },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
];

// Desktop header nav — the booking action lives in its own "Book pickup" button, so it's omitted here.
const desktopLinks = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: Receipt },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/support', label: 'Help', icon: LifeBuoy },
];

const moreLinks = [
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/refunds', label: 'Refunds', icon: Undo2 },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomerNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreLinks.some((link) => isActive(pathname, link.href));

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <div className="page-container flex items-center justify-between gap-4 py-3 lg:max-w-6xl">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <BrandMark variant="customer" compact size="sm" />
            <span className="hidden sm:block">
              <span className="block font-bold leading-tight tracking-tight text-primary">
                {appConfig.name}
              </span>
              <span className="hidden text-xs leading-tight text-muted lg:block">{appConfig.tagline}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {desktopLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-primary text-white' : 'text-muted hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <ButtonLink href="/book" size="sm" className="hidden rounded-full px-4 sm:inline-flex">
              <Plus className="h-4 w-4" aria-hidden />
              Book pickup
            </ButtonLink>
            <NotificationBell />
            <CustomerHeaderMenu />
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar — primary nav within thumb reach */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-surface/95 backdrop-blur-sm md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-5 gap-1 px-1.5 py-1">
          {tabLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-medium transition-colors active:bg-slate-100"
              >
                <span
                  className={`flex h-8 w-11 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-primary/10' : ''
                  }`}
                >
                  <Icon
                    className={active ? 'h-5 w-5 text-primary' : 'h-5 w-5 text-muted'}
                    strokeWidth={active ? 2.25 : 1.75}
                    aria-hidden
                  />
                </span>
                <span className={active ? 'text-primary' : 'text-muted'}>{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className="flex flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-medium transition-colors active:bg-slate-100"
            aria-expanded={moreOpen}
            aria-label="More"
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span
              className={`flex h-8 w-11 items-center justify-center rounded-full transition-colors ${
                moreOpen || moreActive ? 'bg-primary/10' : ''
              }`}
            >
              {moreOpen ? (
                <X className="h-5 w-5 text-primary" strokeWidth={2.25} aria-hidden />
              ) : (
                <MoreHorizontal
                  className={moreActive ? 'h-5 w-5 text-primary' : 'h-5 w-5 text-muted'}
                  strokeWidth={moreActive ? 2.25 : 1.75}
                  aria-hidden
                />
              )}
            </span>
            <span className={moreOpen || moreActive ? 'text-primary' : 'text-muted'}>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[1px] md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <nav
            className="fixed inset-x-0 bottom-16 z-40 rounded-t-2xl border border-b-0 border-border/60 bg-surface pb-2 pt-1.5 shadow-[var(--shadow-elevated-lg)] md:hidden"
            aria-label="More"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200" aria-hidden />
            <div className="flex flex-col gap-1 px-2">
              {moreLinks.map((link) => {
                const active = isActive(pathname, link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                      active ? 'bg-primary/10 text-primary' : 'text-slate-800 active:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
