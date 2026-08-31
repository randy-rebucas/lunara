'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PartnerSubscriptionInfo } from '@lunara/types';
import { isPartnerRole, partnerFetch, staffLogout } from '../lib/partner-api';
import { usePartnerNotificationsSocket } from '../lib/use-partner-notifications-socket';
import { BrandMark } from './ui/brand-mark';
import { PortalHeaderActions } from './portal-header-actions';

const SUBSCRIPTION_PLAN_LABELS: Record<PartnerSubscriptionInfo['subscriptionPlan'], string> = {
  trial: 'Trial',
  basic: 'Basic',
  starter: 'Starter',
  professional: 'Professional',
};

function formatShortDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ── Icons ──────────────────────────────────────────────────────────────────
function Icon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  );
}

const Icons = {
  dashboard:    <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  incoming:     <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  progress:     <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  history:      <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  staff:        <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  inventory:    <Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  reports:      <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  revenue:      <Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  invoices:     <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  services:     <Icon d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />,
  promotions:   <Icon d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.169.659 1.591l9.581 9.581a1.5 1.5 0 002.122 0l6.281-6.281a1.5 1.5 0 000-2.122L11.66 3.66A2.25 2.25 0 009.568 3z" d2="M6.75 6.75h.008v.008H6.75V6.75z" />,
  customers:    <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  notifications:<Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  messages:     <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  queue:        <Icon d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
  intake:       <Icon d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  shelf:        <Icon d="M21 21V3M3 21V3M3 8h18M3 16h18" d2="M8 8v8M13 8v8" />,
  scan:         <Icon d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2m10-14V5a1 1 0 00-1-1h-2m3 14v2a1 1 0 01-1 1h-2M4 12h16" />,
  profile:      <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  settings:     <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  signout:      <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  pricing:      <Icon d="M7 8h10M7 12h6m-6 4h10M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />,
  pickup:       <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m-3-2v6m-3-3h6" />,
  branches:     <Icon d="M3 21h18M6 21V9l6-4 6 4v12M9 21v-6h6v6M9 9h.01M15 9h.01" />,
  accounting:   <Icon d="M9 7h6m-6 4h6m-6 4h4M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />,
  marketing:    <Icon d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  ai:           <Icon d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" d2="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />,
};

// ── Nav structure ──────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Not built yet — placeholder page reserved in the layout, tagged in the UI. */
  soon?: boolean;
  /** Rendered indented beneath the parent item, sharing its icon column. */
  children?: { href: string; label: string }[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const partnerNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: Icons.dashboard },
      {
        href: '/orders/incoming',
        label: 'Orders',
        icon: Icons.incoming,
        children: [
          { href: '/orders/incoming', label: 'Incoming' },
          { href: '/orders/progress', label: 'Monitor progress' },
          { href: '/orders/history', label: 'History' },
        ],
      },
      { href: '/customers', label: 'Customers', icon: Icons.customers },
      { href: '/services', label: 'Services', icon: Icons.services },
      { href: '/pricing', label: 'Pricing', icon: Icons.pricing },
      { href: '/pickup-delivery', label: 'Pickup & Delivery', icon: Icons.pickup, soon: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/staff', label: 'Staff', icon: Icons.staff },
      { href: '/branches', label: 'Branches', icon: Icons.branches, soon: true },
      {
        href: '/inventory',
        label: 'Inventory',
        icon: Icons.inventory,
        children: [
          { href: '/shelf-lookup', label: 'Find on shelf' },
          { href: '/scan', label: 'Scan tag' },
        ],
      },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { href: '/revenue', label: 'Revenue', icon: Icons.revenue },
      { href: '/invoices', label: 'Invoices', icon: Icons.invoices },
      { href: '/accounting/income', label: 'Income', icon: Icons.accounting, soon: true },
      { href: '/accounting/expenses', label: 'Expenses', icon: Icons.accounting, soon: true },
      { href: '/accounting/transactions', label: 'Transactions', icon: Icons.accounting, soon: true },
      { href: '/accounting/accounts', label: 'Accounts', icon: Icons.accounting, soon: true },
      { href: '/accounting/profit-loss', label: 'Profit & Loss', icon: Icons.accounting, soon: true },
      { href: '/reports', label: 'Reports', icon: Icons.reports },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/promotions', label: 'Promotions', icon: Icons.promotions },
      { href: '/marketing/loyalty', label: 'Loyalty', icon: Icons.marketing, soon: true },
      { href: '/marketing/campaigns', label: 'Campaigns', icon: Icons.marketing, soon: true },
    ],
  },
  {
    label: 'Comms',
    items: [
      { href: '/messages', label: 'Messages', icon: Icons.messages },
      { href: '/notifications', label: 'Notifications', icon: Icons.notifications },
    ],
  },
  {
    label: 'More',
    items: [
      { href: '/ai-assistant', label: 'AI Assistant', icon: Icons.ai, soon: true },
      { href: '/settings', label: 'Settings', icon: Icons.settings },
    ],
  },
];

const staffNavGroups: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { href: '/orders', label: 'Processing queue', icon: Icons.queue },
      { href: '/orders/incoming', label: 'Shop intake', icon: Icons.intake },
      { href: '/shelf-lookup', label: 'Find on shelf', icon: Icons.shelf },
      { href: '/scan', label: 'Scan tag', icon: Icons.scan },
      { href: '/promotions', label: 'Promotions', icon: Icons.promotions },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function SidebarNav({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 ${isActive(pathname, item.href) ? 'nav-link-active' : 'nav-link'}`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.soon && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Soon
                    </span>
                  )}
                </Link>
                {item.children && (
                  <div className="ml-[30px] space-y-0.5 border-l border-border/60 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        className={`block rounded-lg px-2 py-1.5 text-sm ${
                          isActive(pathname, child.href)
                            ? 'font-medium text-primary'
                            : 'text-muted hover:text-slate-700'
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [partner, setPartner] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState<PartnerSubscriptionInfo | null>(null);

  useEffect(() => {
    setPartner(isPartnerRole());
  }, [pathname]);

  useEffect(() => {
    if (!partner) {
      setSubscription(null);
      return;
    }
    let cancelled = false;
    partnerFetch<PartnerSubscriptionInfo>('/partner/subscription')
      .then((data) => {
        if (!cancelled) setSubscription(data);
      })
      .catch(() => {
        if (!cancelled) setSubscription(null);
      });
    return () => {
      cancelled = true;
    };
  }, [partner]);

  const { connected } = usePartnerNotificationsSocket({ enabled: pathname !== '/login' && pathname !== '/offline' });

  if (pathname === '/login' || pathname === '/offline') return <>{children}</>;

  async function logout() {
    await staffLogout();
    router.replace('/login');
  }

  const groups = partner ? partnerNavGroups : staffNavGroups;
  const title = partner ? 'Lunara Business Account' : 'Lunara Staff';

  return (
    <div className="portal-bg min-h-screen">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[var(--width-sidebar)] flex-col bg-sidebar shadow-[var(--shadow-sidebar)] transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col p-5">
          <div className="mb-7 px-1">
            <BrandMark partner={partner} />
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SidebarNav groups={groups} onNavigate={() => setSidebarOpen(false)} />
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            {subscription && (
              <Link
                href="/settings?tab=plan"
                className="mb-3 flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700">
                  {SUBSCRIPTION_PLAN_LABELS[subscription.subscriptionPlan]} plan
                </span>
                <span className="text-muted">
                  {subscription.subscriptionPlan === 'trial'
                    ? `Trial ends ${formatShortDate(subscription.trialEndsAt)}`
                    : `Renews ${formatShortDate(subscription.planRenewsAt)}`}
                </span>
              </Link>
            )}
            <button type="button" onClick={logout} className="nav-link flex w-full items-center gap-3 text-left">
              {Icons.signout}
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[var(--width-sidebar)]">
        {!connected && pathname !== '/login' && (
          <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-700">
            Connection lost — reconnecting…
          </div>
        )}

        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-surface/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
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

          <span className="text-sm font-semibold text-slate-900 lg:hidden">{title}</span>

          <PortalHeaderActions />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
