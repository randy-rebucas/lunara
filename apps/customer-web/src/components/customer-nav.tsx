'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { appConfig } from '@lunara/config';
import { useAuthContext } from '@lunara/hooks/auth-provider';

const links = [
  { href: '/dashboard', label: 'Home' },
  { href: '/book', label: 'Book' },
  { href: '/orders', label: 'My Orders' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/support', label: 'Support' },
  { href: '/refunds', label: 'Refunds' },
];

export function CustomerNav() {
  const pathname = usePathname();
  const { logout, user } = useAuthContext();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/dashboard" className="font-bold text-primary">
          {appConfig.name}
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? 'bg-indigo-50 text-primary'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user?.phone && <span className="hidden text-slate-500 sm:inline">{user.phone}</span>}
          <button type="button" onClick={() => logout()} className="text-slate-500 hover:text-primary">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
