'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminLogout, getAdminUser } from '../lib/admin-api';
import { AdminHeaderActions } from './admin-header-actions';
import { BrandMark } from './ui/brand-mark';

const nav = [
  { href: '/', label: 'Overview' },
  { href: '/control-tower', label: 'Control tower' },
  { href: '/orders', label: 'Orders' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/riders', label: 'Riders' },
  { href: '/branches', label: 'Branches' },
  { href: '/shops', label: 'Shops' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/support', label: 'Support' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/reports', label: 'Reports' },
  { href: '/promotions', label: 'Promotions' },
  { href: '/services', label: 'Services' },
  { href: '/addons', label: 'Add-ons' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={isActive(pathname, item.href) ? 'nav-link-active' : 'nav-link'}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getAdminUser();

  if (pathname === '/login') return <>{children}</>;

  async function logout() {
    await adminLogout();
    router.replace('/login');
  }

  return (
    <div className="admin-bg min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed/sticky on the left */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[var(--width-sidebar)] flex-col bg-sidebar shadow-[var(--shadow-sidebar)] transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 px-1">
            <BrandMark />
          </div>

          {user?.email && (
            <p className="mb-4 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">{user.email}</p>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SidebarNav onNavigate={() => setSidebarOpen(false)} />
          </div>

          <button type="button" onClick={logout} className="btn-ghost mt-4 w-full justify-start text-left">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column — offset for fixed sidebar */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[var(--width-sidebar)]">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-surface/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-muted hover:bg-slate-100 lg:hidden"
            aria-expanded={sidebarOpen}
            aria-label="Toggle menu"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <span className="text-sm font-semibold text-slate-900 lg:hidden">Lunara Admin</span>

          <AdminHeaderActions />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
