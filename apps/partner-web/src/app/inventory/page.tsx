'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
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
      <PageHeader
        title="Inventory"
        description="Detergent, bags, tags, and shop supplies. Low-stock items are highlighted on the dashboard."
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading inventory…" />
      </div>
      {actionError && <div className="alert-error mt-2">{actionError}</div>}

      <div className="mt-6 space-y-3">
        {(items ?? []).map((item) => {
          const low = item.quantity <= item.lowStockThreshold;
          return (
            <div
              key={item._id}
              className={`list-row flex-wrap ${low ? 'ring-amber-300/60 bg-amber-50/40' : ''}`}
            >
              <div>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.sku} · {item.category} · alert at ≤ {item.lowStockThreshold} {item.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-outline btn-sm min-w-[2.5rem]"
                  disabled={saving === item._id}
                  onClick={() => updateQty(item._id, Math.max(0, item.quantity - 1))}
                >
                  −
                </button>
                <span className="min-w-[4rem] text-center font-semibold text-slate-900">
                  {item.quantity} {item.unit}
                </span>
                <button
                  type="button"
                  className="btn-outline btn-sm min-w-[2.5rem]"
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
          <p className="text-sm text-muted">No inventory items found.</p>
        )}
      </div>
    </div>
  );
}
