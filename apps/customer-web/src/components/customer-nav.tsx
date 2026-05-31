'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { appConfig } from '@lunara/config';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { BrandMark } from '@lunara/ui';

const links = [
  { href: '/dashboard', label: 'Home' },
  { href: '/book', label: 'Book' },
  { href: '/orders', label: 'Orders' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/profile', label: 'Profile' },
  { href: '/support', label: 'Support' },
  { href: '/refunds', label: 'Refunds' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomerNav() {
  const pathname = usePathname();
  const { logout, user } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="page-container flex items-center justify-between gap-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <BrandMark variant="customer" compact size="sm" />
          <span className="hidden font-bold tracking-tight text-primary sm:inline">{appConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, link.href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {user?.phone && (
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.phone}</span>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="hidden rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-slate-100 hover:text-primary sm:inline-flex"
          >
            Sign out
          </button>
          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-muted hover:bg-slate-100 md:hidden"
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="bg-surface page-container py-3 shadow-[var(--shadow-card)] md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive(pathname, link.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm text-muted hover:bg-slate-100 hover:text-primary"
            >
              Sign out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
