'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPortalUser, isPartnerRole, staffLogout } from '../lib/partner-api';

const partnerNav = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders/incoming', label: 'Incoming orders' },
  { href: '/orders/progress', label: 'Monitor progress' },
  { href: '/staff', label: 'Assign staff' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/reports', label: 'Reports' },
  { href: '/revenue', label: 'Revenue' },
];

const staffNav = [
  { href: '/orders', label: 'Processing queue' },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [partner, setPartner] = useState(false);

  useEffect(() => {
    setPartner(isPartnerRole());
  }, [pathname]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  async function logout() {
    await staffLogout();
    router.replace('/login');
  }

  const nav = partner ? partnerNav : staffNav;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-56 flex-col border-r bg-white p-4">
        <h1 className="font-bold text-primary">
          {partner ? 'Partner Portal' : 'Lunara Staff'}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {partner ? 'Shop operations' : 'Laundry processing'}
        </p>
        <p className="mt-2 truncate text-xs text-slate-400">{getPortalUser()?.email}</p>
        <nav className="mt-6 flex-1 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm ${
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? 'bg-indigo-50 font-medium text-primary'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-4 text-left text-sm text-slate-500 hover:text-primary"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
