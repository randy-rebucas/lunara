'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPortalUser, isPartnerRole, staffLogout } from '../lib/partner-api';
import { BrandMark } from './ui/brand-mark';

const partnerNav = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders/incoming', label: 'Incoming orders' },
  { href: '/orders/progress', label: 'Monitor progress' },
  { href: '/staff', label: 'Assign staff' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/reports', label: 'Reports' },
  { href: '/revenue', label: 'Revenue' },
];

const staffNav = [{ href: '/orders', label: 'Processing queue' }];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function SidebarNav({
  items,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((item) => (
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

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [partner, setPartner] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getPortalUser();

  useEffect(() => {
    setPartner(isPartnerRole());
  }, [pathname]);

  if (pathname === '/login') return <>{children}</>;

  async function logout() {
    await staffLogout();
    router.replace('/login');
  }

  const nav = partner ? partnerNav : staffNav;
  const title = partner ? 'Partner Portal' : 'Lunara Staff';

  return (
    <div className="portal-bg flex min-h-screen">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[var(--width-sidebar)] flex-col bg-sidebar shadow-[var(--shadow-sidebar)] transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 px-1">
            <BrandMark partner={partner} />
          </div>

          {user?.email && (
            <p className="mb-4 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">{user.email}</p>
          )}

          <div className="flex-1 overflow-y-auto">
            <SidebarNav items={nav} onNavigate={() => setSidebarOpen(false)} />
          </div>

          <button type="button" onClick={logout} className="btn-ghost mt-4 w-full justify-start text-left">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-surface/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-muted hover:bg-slate-100"
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
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
