'use client';

import { useState } from 'react';
import {
  HelpCircle,
  Home,
  KeyRound,
  LayoutGrid,
  Menu,
  Package,
  Percent,
  UserCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AppScreen, AppNavStyle } from '@lunara/types';
import { cn } from '@lunara/ui';

const ICONS_BY_KEY: Record<string, LucideIcon> = {
  home: Home,
  orders: Package,
  offers: Percent,
  profile: UserCircle,
  support: HelpCircle,
  'sign-in': KeyRound,
};

function iconFor(screen: AppScreen): LucideIcon {
  return ICONS_BY_KEY[screen.key] ?? LayoutGrid;
}

function TabBarNav({
  screens,
  activeScreenId,
  onSelect,
}: {
  screens: AppScreen[];
  activeScreenId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="flex shrink-0 items-stretch border-t border-border bg-surface">
      {screens.map((screen) => {
        const Icon = iconFor(screen);
        const active = screen.id === activeScreenId;
        return (
          <button
            key={screen.id}
            type="button"
            onClick={() => onSelect(screen.id)}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.5 : 2} />
            <span className={cn('truncate text-[7px] leading-none', active ? 'font-semibold' : 'font-medium')}>
              {screen.title}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function DrawerNav({
  screens,
  activeScreenId,
  onSelect,
}: {
  screens: AppScreen[];
  activeScreenId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-surface/90 text-slate-700 shadow-sm ring-1 ring-border/60 backdrop-blur"
      >
        <Menu className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute inset-0 z-20 flex">
          <div
            className="w-[72%] shrink-0 space-y-1 bg-surface p-3 pt-9 shadow-xl"
            style={{ animation: 'phone-drawer-in 180ms ease-out' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {screens.map((screen) => {
              const Icon = iconFor(screen);
              const active = screen.id === activeScreenId;
              return (
                <button
                  key={screen.id}
                  type="button"
                  onClick={() => {
                    onSelect(screen.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[9px] font-medium transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{screen.title}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex-1 bg-slate-900/30"
          />
        </div>
      )}

      <style jsx>{`
        @keyframes phone-drawer-in {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}

export function PhoneNav({
  navStyle,
  screens,
  activeScreenId,
  onSelect,
}: {
  navStyle: AppNavStyle;
  screens: AppScreen[];
  activeScreenId: string | null;
  onSelect: (id: string) => void;
}) {
  if (screens.length < 2) return null;

  return navStyle === 'drawer' ? (
    <DrawerNav screens={screens} activeScreenId={activeScreenId} onSelect={onSelect} />
  ) : (
    <TabBarNav screens={screens} activeScreenId={activeScreenId} onSelect={onSelect} />
  );
}
