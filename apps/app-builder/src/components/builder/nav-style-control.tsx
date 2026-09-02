'use client';

import { LayoutGrid, PanelLeft } from 'lucide-react';
import type { AppNavStyle } from '@lunara/types';
import { cn } from '@lunara/ui';
import { FormLabel } from '../ui/input';

const OPTIONS: { value: AppNavStyle; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'tabs', label: 'Tab bar', icon: LayoutGrid },
  { value: 'drawer', label: 'Drawer', icon: PanelLeft },
];

export function NavStyleControl({
  value,
  onChange,
  showLabel = true,
}: {
  value: AppNavStyle;
  onChange: (value: AppNavStyle) => void;
  showLabel?: boolean;
}) {
  return (
    <div>
      {showLabel && <FormLabel>App navigation</FormLabel>}
      <div className="inline-flex w-full rounded-lg bg-surface-muted p-1 ring-1 ring-border/60">
        {OPTIONS.map(({ value: v, label, icon: Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
              value === v ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-slate-700',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
