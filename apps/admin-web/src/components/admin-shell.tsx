'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminLogout, getAdminUser } from '../lib/admin-api';

const nav = [
  { href: '/', label: 'Overview' },
  { href: '/control-tower', label: 'Control tower' },
  { href: '/orders', label: 'Orders' },
  { href: '/dispatch', label: 'Dispatch dashboard' },
  { href: '/riders', label: 'Riders' },
  { href: '/branches', label: 'Branch network' },
  { href: '/shops', label: 'Shops' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/support', label: 'Support tickets' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/reports', label: 'Reports' },
  { href: '/promotions', label: 'Promotions' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return <>{children}</>;

  async function logout() {
    await adminLogout();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-64 shrink-0 bg-slate-900 p-4 text-white">
        <h1 className="text-xl font-bold text-indigo-400">Lunara Admin</h1>
        <p className="mt-1 text-xs text-slate-400">Platform management</p>
        <p className="mt-2 truncate text-xs text-slate-500">{getAdminUser()?.email}</p>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 text-sm ${
                  active ? 'bg-slate-800 font-medium text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-8 text-left text-sm text-slate-400 hover:text-white"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
