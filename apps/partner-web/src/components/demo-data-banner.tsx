'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { clearDemoData } from '../lib/partner-api';

export function DemoDataBanner({
  canClear,
  onCleared,
}: {
  canClear: boolean;
  onCleared: () => void;
}) {
  const [clearing, setClearing] = useState(false);

  async function handleReady() {
    if (
      !window.confirm(
        'This will permanently delete the demo orders, promotion, and placeholder accounts. Continue?',
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await clearDemoData();
      toast.success('Demo data cleared — you’re all set to work with real orders.');
      onCleared();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear demo data');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span>
        You&apos;re using demo data. Explore the portal, then clear it when you&apos;re ready to work with real orders.
      </span>
      {canClear && (
        <button
          type="button"
          onClick={() => void handleReady()}
          disabled={clearing}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {clearing ? 'Clearing…' : 'Ready — clear demo data'}
        </button>
      )}
    </div>
  );
}
