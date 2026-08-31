'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminLogout, getAdminUser } from '../lib/admin-api';
import { useAdminMessageBadge } from '../hooks/use-admin-message-badge';
import { AdminHeaderActions } from './admin-header-actions';
import { DailyRoutine } from './daily-routine';
import { AdminReminders } from './admin-reminders';
import brandIcon from '@lunara/brand/icon';
import Image from 'next/image';

// ── Icons ──────────────────────────────────────────────────────────────────
function Icon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  );
}

const Icons: Record<string, React.ReactNode> = {
  // Operations
  overview:       <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  controlTower:   <Icon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />,
  liveTracking:   <Icon d="M12 8a4 4 0 100 8 4 4 0 000-8z" d2="M12 2v3m0 14v3M2 12h3m14 0h3" />,
  orders:         <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  dispatch:       <Icon d="M13 10V3L4 14h7v7l9-11h-7z" />,
  qualityAlerts:  <Icon d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0z" d2="M11.25 15h1.5v1.5h-1.5V15z" />,
  // People
  users:          <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  riders:         <Icon d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
  applications:   <Icon d="M9 12h6m-6 4h4m1-16H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8z" d2="M13 2v6h6" />,
  // Network
  branches:       <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" d2="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />,
  shops:          <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  categories:     <Icon d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
  services:       <Icon d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />,
  addons:         <Icon d="M12 6v6m0 0v6m0-6h6m-6 0H6" />,
  laundryTags:    <Icon d="M9 4H6a2 2 0 00-2 2v3l7.586 7.586a2 2 0 002.828 0l4.586-4.586a2 2 0 000-2.828L11.414 4H9z" d2="M7 8h.01" />,
  serviceAreas:   <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" d2="M9.879 9.879a3 3 0 104.242 4.242" />,
  // Partners
  branding:       <Icon d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />,
  invoices:       <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  plans:          <Icon d="M3 10h18M7 15h1m4 0h1M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />,
  promoCodes:     <Icon d="M7 7h.01M7 3h5.586a2 2 0 011.414.586l6.414 6.414a2 2 0 010 2.828l-6.586 6.586a2 2 0 01-2.828 0L4.586 12.828A2 2 0 014 11.414V7a4 4 0 014-4z" />,
  // Finance
  revenue:        <Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  reconciliation: <Icon d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2h-2M9 3h6v4H9V3z" />,
  accounting:     <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  billingMetrics: <Icon d="M3 17l6-6 4 4 8-8M21 7v6h-6" />,
  refunds:        <Icon d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />,
  withdrawals:    <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  // Growth
  promotions:     <Icon d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  banners:        <Icon d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" d2="M8 21h8M12 17v4" />,
  blog:           <Icon d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5v15z" d2="M8 7h8M8 11h5" />,
  notifications:  <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  reports:        <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  // System
  messages:       <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  support:        <Icon d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />,
  setup:          <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  maintenance:    <Icon d="M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m1.404 3.563l5.83 5.83a2.652 2.652 0 003.75-3.75l-5.876-5.877m-3.704 3.797l2.496-3.03c.317-.384.74-.626 1.208-.766m0 0c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95" />,
  auditLog:       <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  automation:     <Icon d="M13 10V3L4 14h7v7l9-11h-7z" />,
  errorLogs:      <Icon d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.25 3.75h.008v.008h-.008v-.008z" />,
  signout:        <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};

// ── Nav structure ──────────────────────────────────────────────────────────
type NavItem =
  | { section: string }
  | { href: string; label: string; icon: React.ReactNode };

const nav: NavItem[] = [
  // Daily order pipeline, in workflow order: see everything → manage → assign → track → exceptions
  { section: 'Operations' },
  { href: '/',              label: 'Overview',      icon: Icons.overview },
  { href: '/orders',        label: 'Orders',        icon: Icons.orders },
  { href: '/dispatch',      label: 'Dispatch',      icon: Icons.dispatch },
  { href: '/live-tracking', label: 'Live tracking', icon: Icons.liveTracking },
  { href: '/control-tower', label: 'Control tower', icon: Icons.controlTower },
  { href: '/quality-alerts', label: 'Quality alerts', icon: Icons.qualityAlerts },

  // Accounts: everyone → the fleet → inbound applicants
  { section: 'People' },
  { href: '/users',        label: 'Users',        icon: Icons.users },
  { href: '/applications', label: 'Applications', icon: Icons.applications },

  // Physical network → the catalog it sells → shop-floor tooling
  { section: 'Network' },
  { href: '/branches',     label: 'Branches',     icon: Icons.branches },
  { href: '/categories',   label: 'Categories',   icon: Icons.categories },
  { href: '/services',     label: 'Services',     icon: Icons.services },
  { href: '/addons',       label: 'Add-ons',      icon: Icons.addons },
  { href: '/laundry-tags', label: 'Laundry tags', icon: Icons.laundryTags },
  { href: '/service-areas', label: 'Service areas', icon: Icons.serviceAreas },

  { section: 'Partners' },
  { href: '/partners',             label: 'Partners',    icon: Icons.shops },
  { href: '/partners/branding',    label: 'Branding',    icon: Icons.branding },
  { href: '/partners/invoices', label: 'Invoices', icon: Icons.invoices },
  { href: '/partners/subscriptions', label: 'Subscriptions', icon: Icons.plans },
  { href: '/partners/plans',    label: 'Plans',    icon: Icons.plans },
  { href: '/partners/promo-codes', label: 'Promo codes', icon: Icons.promoCodes },

  // Money in (analytics) → books → money out (approval queues)
  { section: 'Finance' },
  { href: '/revenue',            label: 'Revenue',           icon: Icons.revenue },
  { href: '/reports',            label: 'Reports',           icon: Icons.reports },
  { href: '/accounting',         label: 'Accounting',        icon: Icons.accounting },
  { href: '/billing-metrics',    label: 'Billing metrics',   icon: Icons.billingMetrics },
  { href: '/reconciliation',     label: 'Reconciliation',    icon: Icons.reconciliation },
  { href: '/refunds',            label: 'Refunds',           icon: Icons.refunds },

  { section: 'Marketing' },
  { href: '/promotions',    label: 'Promotions',    icon: Icons.promotions },
  { href: '/banners',       label: 'Banners',       icon: Icons.banners },
  { href: '/blog',          label: 'Blog',          icon: Icons.blog },
  { href: '/notifications', label: 'Announcements', icon: Icons.notifications },

  // Daily comms first, admin tooling after, dev tools last
  { section: 'System' },
  { href: '/messages',    label: 'Messages',        icon: Icons.messages },
  { href: '/support',     label: 'Support',         icon: Icons.support },
  { href: '/settings',    label: 'System settings', icon: Icons.setup },
  { href: '/automation-settings', label: 'Automation', icon: Icons.automation },
  { href: '/audit-log',   label: 'Audit log',       icon: Icons.auditLog },
  { href: '/error-logs',  label: 'Error logs',      icon: Icons.errorLogs },
  { href: '/maintenance', label: 'Maintenance',     icon: Icons.maintenance },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function matchesRoute(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

/** Longest matching nav href wins so nested routes (e.g. /partners/invoices)
 * highlight their own entry instead of every prefix ancestor too. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of nav) {
    if ('section' in item) continue;
    if (matchesRoute(pathname, item.href) && (best === null || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

const sectionIndexByLabel = new Map<string, number>(
  nav.filter((item): item is { section: string } => 'section' in item).map((item, i) => [item.section, i + 1]),
);

function SidebarNav({ onNavigate, messageBadge }: { onNavigate?: () => void; messageBadge?: number }) {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <nav className="space-y-0.5">
      {nav.map((item) => {
        if ('section' in item) {
          const sectionIndex = sectionIndexByLabel.get(item.section) ?? 0;
          return (
            <p key={item.section} className="console-section-label">
              <span>{String(sectionIndex).padStart(2, '0')} · {item.section}</span>
            </p>
          );
        }
        const showBadge = item.href === '/messages' && messageBadge && messageBadge > 0;
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={isActive ? 'console-nav-link-active' : 'console-nav-link'}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-signal)] px-1 text-[10px] font-bold text-[color:var(--color-console)]">
                {messageBadge > 99 ? '99+' : messageBadge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function ConsoleClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="console-readout hidden sm:inline-flex items-center gap-1.5">
      <span className="console-signal-dot" aria-hidden />
      {now
        ? now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '--:--:--'}
    </span>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getAdminUser();
  const { unreadTotal } = useAdminMessageBadge();

  if (pathname === '/login') return <>{children}</>;

  async function logout() {
    await adminLogout();
    router.replace('/login');
  }

  return (
    <div className="admin-bg min-h-screen">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — console */}
      <aside
        className={`console fixed inset-y-0 left-0 z-50 flex w-[var(--width-sidebar)] flex-col border-r console-line transition-transform print:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-5 flex items-center gap-2.5 border-b console-line px-1 pb-4">
            <Image
              src={brandIcon}
              alt=""
              width={34}
              height={34}
              className="shrink-0 rounded-md ring-1 ring-white/10"
              aria-hidden
              priority
            />
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-bold tracking-tight text-[color:var(--color-console-fg)]">
                Lunara Admin
              </p>
              <p className="console-eyebrow truncate">Control Center</p>
            </div>
          </div>

          {user?.email && (
            <p className="mb-4 truncate rounded-md bg-white/[0.04] px-3 py-2 font-mono text-[0.6875rem] text-[color:var(--color-console-muted)] ring-1 ring-white/[0.06]">
              {user.email}
            </p>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SidebarNav onNavigate={() => setSidebarOpen(false)} messageBadge={unreadTotal} />
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-4 flex w-full items-center gap-2.5 justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-[color:var(--color-console-muted)] transition-colors hover:bg-white/[0.05] hover:text-[color:var(--color-console-fg)]"
          >
            {Icons.signout}
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[var(--width-sidebar)] print:pl-0">
        <header className="console sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b console-line px-4 sm:px-6 lg:px-8 print:hidden">
          <button
            type="button"
            className="inline-flex rounded-md p-2 text-[color:var(--color-console-muted)] hover:bg-white/[0.06] lg:hidden"
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

          <ConsoleClock />
          <span className="console-eyebrow hidden md:inline">Sys nominal</span>

          <div className="ml-auto flex items-center rounded-md bg-surface py-1 pl-1 pr-1.5 ring-1 ring-white/[0.06]">
            <AdminHeaderActions />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <DailyRoutine />
      <AdminReminders />
    </div>
  );
}
