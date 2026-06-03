'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lunara/ui';
import { getPortalUser } from '../lib/partner-api';
import { PortalNotificationsBell } from './portal-notifications-bell';

function HeaderIconLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-primary',
        active && 'bg-primary/10 text-primary',
      )}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
    >
      {children}
    </Link>
  );
}

function ProfileAvatar({ email }: { email?: string }) {
  const initial = (email?.trim()[0] ?? 'P').toUpperCase();
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initial}
    </span>
  );
}

export function PortalHeaderActions() {
  const pathname = usePathname();
  const user = getPortalUser();

  return (
    <div className="ml-auto flex items-center gap-1 sm:gap-2">
      <PortalNotificationsBell />

      <HeaderIconLink href="/profile" label="Profile" active={pathname.startsWith('/profile')}>
        <ProfileAvatar email={user?.email} />
      </HeaderIconLink>

      <HeaderIconLink href="/settings" label="Shop settings" active={pathname.startsWith('/settings')}>
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </HeaderIconLink>
    </div>
  );
}
