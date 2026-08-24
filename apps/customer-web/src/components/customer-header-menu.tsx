'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LogOut, Settings, User } from 'lucide-react';
import { resolveMediaUrl } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';

function accountLabel(email?: string, phone?: string) {
  if (email) return email;
  if (phone) return phone;
  return 'Account';
}

function accountInitial(email?: string, phone?: string) {
  const source = email?.trim() || phone?.trim() || 'C';
  return source[0]?.toUpperCase() ?? 'C';
}

export function CustomerHeaderMenu() {
  const pathname = usePathname();
  const { logout, user, api } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    api
      .get<{ avatarUrl?: string }>('/customers/me')
      .then((res) => setAvatarUrl(res.data.avatarUrl ?? null))
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  const label = accountLabel(user?.email, user?.phone);
  const resolvedAvatarUrl = resolveMediaUrl(avatarUrl, process.env.NEXT_PUBLIC_API_URL);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface p-1 shadow-sm transition-colors hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`Account menu for ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {resolvedAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolvedAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            accountInitial(user?.email, user?.phone)
          )}
        </span>
        <svg
          className={`mr-1 h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-border/80 bg-surface py-1 shadow-[var(--shadow-elevated)]"
        >
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signed in</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{label}</p>
          </div>

          <Link
            href="/profile"
            role="menuitem"
            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
              pathname.startsWith('/profile') ? 'bg-primary/5 font-medium text-primary' : 'text-slate-800'
            }`}
            onClick={close}
          >
            <User className="h-4 w-4 shrink-0" aria-hidden />
            Profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
              pathname.startsWith('/settings') ? 'bg-primary/5 font-medium text-primary' : 'text-slate-800'
            }`}
            onClick={close}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            Settings
          </Link>

          <div className="my-1 border-t border-border/60" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-slate-50 hover:text-primary"
            onClick={() => {
              close();
              logout();
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
