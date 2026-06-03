'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  const { logout, user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-surface px-2 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {accountInitial(user?.email, user?.phone)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-left text-xs text-muted-foreground sm:inline">
          {label}
        </span>
        <svg
          className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
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
            className={`block px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
              pathname.startsWith('/profile') ? 'bg-primary/5 font-medium text-primary' : 'text-slate-800'
            }`}
            onClick={close}
          >
            Profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            className={`block px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
              pathname.startsWith('/settings') ? 'bg-primary/5 font-medium text-primary' : 'text-slate-800'
            }`}
            onClick={close}
          >
            Settings
          </Link>

          <div className="my-1 border-t border-border/60" />

          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-slate-50 hover:text-primary"
            onClick={() => {
              close();
              logout();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
