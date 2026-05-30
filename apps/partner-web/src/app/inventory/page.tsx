'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
import { isPartnerRole, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface InventoryItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
}

export default function InventoryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!isPartnerRole()) router.replace('/orders');
  }, [router]);

  const load = useCallback(async () => {
    if (!isPartnerRole()) return [] as InventoryItem[];
    return partnerFetch<InventoryItem[]>('/partner/inventory');
  }, []);

  const { data: items, loading, error, setData } = usePartnerQuery(load, []);

  if (!isPartnerRole()) return null;

  async function updateQty(id: string, quantity: number) {
    setSaving(id);
    setActionError('');
    try {
      const updated = await partnerFetch<InventoryItem>(`/partner/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      setData((prev) => (prev ?? []).map((i) => (i._id === id ? updated : i)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update quantity');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold">Manage inventory</h2>
      <p className="mt-1 text-sm text-slate-500">
        Detergent, bags, tags, and shop supplies. Low-stock items are highlighted on the dashboard.
      </p>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading inventory…" />
      </div>
      {actionError && <p className="mt-2 text-sm text-red-500">{actionError}</p>}

      <div className="mt-6 space-y-3">
        {(items ?? []).map((item) => {
          const low = item.quantity <= item.lowStockThreshold;
          return (
            <div
              key={item._id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 ${
                low ? 'border-amber-300 bg-amber-50' : ''
              }`}
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.sku} · {item.category} · alert at ≤ {item.lowStockThreshold} {item.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm"
                  disabled={saving === item._id}
                  onClick={() => updateQty(item._id, Math.max(0, item.quantity - 1))}
                >
                  −
                </button>
                <span className="min-w-[4rem] text-center font-semibold">
                  {item.quantity} {item.unit}
                </span>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm"
                  disabled={saving === item._id}
                  onClick={() => updateQty(item._id, item.quantity + 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
        {!loading && !error && (items ?? []).length === 0 && (
          <p className="text-slate-500">No inventory items found.</p>
        )}
      </div>
    </div>
  );
}
