'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { PartnerOwnProfile } from '@lunara/types';
import { getOwnProfile, getPortalUser, staffLogout } from '../lib/partner-api';
import { PortalNotificationsBell } from './portal-notifications-bell';

function ProfileAvatar({ avatarUrl, name, email }: { avatarUrl?: string; name?: string; email?: string }) {
  if (avatarUrl) {
    return (
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
        <img src={avatarUrl} alt={name ?? email ?? 'Profile'} className="h-full w-full object-cover" />
      </span>
    );
  }
  const initial = (name?.trim()[0] ?? email?.trim()[0] ?? 'P').toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initial}
    </span>
  );
}

function ChevronDown() {
  return (
    <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export function PortalHeaderActions() {
  const router = useRouter();
  const user = getPortalUser();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<PartnerOwnProfile | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function loadProfile() {
      getOwnProfile()
        .then(setProfile)
        .catch(() => {
          /* header falls back to email/initial when profile fetch fails */
        });
    }
    loadProfile();
    window.addEventListener('lunara:profile-updated', loadProfile);
    return () => window.removeEventListener('lunara:profile-updated', loadProfile);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await staffLogout();
    router.replace('/login');
  }

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      <PortalNotificationsBell />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-slate-100 sm:pr-3"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ProfileAvatar avatarUrl={profile?.avatarUrl} name={profile?.displayName} email={user?.email} />
          <span className="hidden max-w-[9rem] truncate text-sm font-medium text-slate-900 sm:inline">
            {profile?.displayName || user?.email || 'Lunara Business Account'}
          </span>
          <ChevronDown />
        </button>

        {open ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl bg-surface py-1.5 shadow-[var(--shadow-elevated)] ring-1 ring-border/60">
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
            <Link
              href="/settings"
              className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Shop settings
            </Link>
            <div className="my-1 border-t border-border/60" />
            <button
              type="button"
              onClick={logout}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
