'use client';

import { Plus, X } from 'lucide-react';
import type { AppScreen } from '@lunara/types';
import { cn } from '@lunara/ui';

export function ScreenTabs({
  screens,
  activeScreenId,
  onSelect,
  onRemove,
  onAddScreen,
}: {
  screens: AppScreen[];
  activeScreenId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddScreen: () => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface px-3">
      {screens.map((screen) => {
        const active = screen.id === activeScreenId;
        return (
          <div
            key={screen.id}
            className={cn(
              'group flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
              active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-slate-100 hover:text-slate-700',
            )}
          >
            <button type="button" onClick={() => onSelect(screen.id)}>
              {screen.title}
            </button>
            {screens.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(screen.id)}
                aria-label={`Remove ${screen.title} screen`}
                className="rounded p-0.5 text-current opacity-0 transition hover:bg-black/10 group-hover:opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAddScreen}
        className="ml-1 flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
      >
        <Plus className="h-3.5 w-3.5" /> Add screen
      </button>
    </div>
  );
}
