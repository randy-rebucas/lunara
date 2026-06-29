'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { PartnerInventoryItem, PartnerSettingsData } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

const CATEGORY_LABELS: Record<string, string> = {
  detergent: 'Detergent & chemicals',
  supplies: 'Supplies',
  maintenance: 'Maintenance',
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}

function stockLevel(item: PartnerInventoryItem): 'ok' | 'low' | 'out' {
  if (item.quantity === 0) return 'out';
  if (item.isLowStock ?? item.quantity <= item.lowStockThreshold) return 'low';
  return 'ok';
}

export default function InventoryPage() {
  const { ready } = useRequirePartner();
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [draftThreshold, setDraftThreshold] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    return partnerFetch<PartnerSettingsData>('/partner/settings');
  }, []);
  const { data: settingsData } = usePartnerQuery(loadSettings, []);
  const inventoryEnabled = settingsData?.settings.inventoryEnabled ?? true;

  const load = useCallback(async () => {
    return partnerFetch<PartnerInventoryItem[]>('/partner/inventory');
  }, []);

  const { data: items, loading, error, reload, setData } = usePartnerQuery(load, []);

  const categories = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.category));
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const list = items ?? [];
    if (categoryFilter === 'all') return list;
    return list.filter((i) => i.category === categoryFilter);
  }, [items, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PartnerInventoryItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const low = list.filter((i) => stockLevel(i) === 'low').length;
    const out = list.filter((i) => stockLevel(i) === 'out').length;
    return { total: list.length, low, out };
  }, [items]);

  async function patchItem(
    id: string,
    patch: { quantity?: number; lowStockThreshold?: number },
    closeEdit = false,
  ) {
    setSaving(id);
    setActionError('');
    try {
      const updated = await partnerFetch<PartnerInventoryItem>(`/partner/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setData((prev) => (prev ?? []).map((i) => (i._id === id ? updated : i)));
      if (closeEdit) {
        setEditingId(null);
        setDraftQty((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
        setDraftThreshold((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  const adjustTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingQty = useRef<Record<string, number>>({});

  function adjustQty(item: PartnerInventoryItem, delta: number) {
    const next = Math.max(0, (pendingQty.current[item._id] ?? item.quantity) + delta);
    pendingQty.current[item._id] = next;
    // Optimistic UI update
    setData((prev) => (prev ?? []).map((i) => (i._id === item._id ? { ...i, quantity: next } : i)));
    // Debounce the API call — only fires 400ms after the last click
    clearTimeout(adjustTimers.current[item._id]);
    adjustTimers.current[item._id] = setTimeout(() => {
      void patchItem(item._id, { quantity: next });
      delete pendingQty.current[item._id];
    }, 400);
  }

  function applyDraftQty(item: PartnerInventoryItem) {
    const raw = draftQty[item._id] ?? String(item.quantity);
    const qty = Number.parseInt(raw, 10);
    if (Number.isNaN(qty) || qty < 0) {
      setActionError('Enter a valid quantity (0 or higher).');
      return;
    }
    void patchItem(item._id, { quantity: qty }, true);
  }

  function applyDraftThreshold(item: PartnerInventoryItem) {
    const raw = draftThreshold[item._id] ?? String(item.lowStockThreshold);
    const threshold = Number.parseInt(raw, 10);
    if (Number.isNaN(threshold) || threshold < 0) {
      setActionError('Enter a valid alert threshold (0 or higher).');
      return;
    }
    void patchItem(item._id, { lowStockThreshold: threshold }, true);
  }

  if (!ready) return <AuthLoading message="Loading inventory…" />;

  if (!inventoryEnabled) {
    return (
      <div>
        <PageHeader
          title="Shop inventory"
          description="Inventory tracking is currently disabled for your shop."
        />
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">Inventory tracking is off</p>
          <p className="mt-2 text-sm text-muted">
            Your shop has inventory tracking disabled. If you stock and manage supplies like detergent
            or bags, you can turn it on under{' '}
            <a href="/settings" className="text-primary underline hover:opacity-80">
              Settings → Preferences → Operations
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Shop inventory"
        description="Track detergent, bags, tags, and maintenance supplies. Low-stock items appear on your dashboard."
        actions={
          <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
            Refresh
          </button>
        }
      />

      <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs text-muted">SKU count</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="stat-card-warning">
          <p className="text-xs text-muted">Low stock</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.low}</p>
        </div>
        <div className={`stat-card ${stats.out > 0 ? '!border-red-200 !bg-red-50/50' : ''}`}>
          <p className="text-xs text-muted">Out of stock</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.out}</p>
        </div>
      </div>

      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className={categoryFilter === 'all' ? 'filter-chip-active' : 'filter-chip'}
            onClick={() => setCategoryFilter('all')}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={categoryFilter === cat ? 'filter-chip-active' : 'filter-chip'}
              onClick={() => setCategoryFilter(cat)}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading inventory…" />
      </div>
      {actionError && <div className="alert-error mt-2">{actionError}</div>}

      <div className="mt-6 space-y-8">
        {grouped.map(([category, categoryItems]) => (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {categoryLabel(category)}
            </h2>
            <div className="space-y-3">
              {categoryItems.map((item) => {
                const level = stockLevel(item);
                const busy = saving === item._id;
                const isEditing = editingId === item._id;

                return (
                  <div
                    key={item._id}
                    className={`list-row flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4 ${
                      level === 'out'
                        ? 'ring-red-200/80 bg-red-50/50'
                        : level === 'low'
                          ? 'ring-amber-300/60 bg-amber-50/40'
                          : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {level === 'out' && <span className="badge-danger">Out of stock</span>}
                        {level === 'low' && <span className="badge-warning">Low stock</span>}
                        {level === 'ok' && <span className="badge-neutral">In stock</span>}
                      </div>
                      <p className="text-xs text-muted">
                        {item.sku} · alert when ≤ {item.lowStockThreshold} {item.unit}
                      </p>
                      <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full transition-all ${
                            level === 'out'
                              ? 'bg-red-400'
                              : level === 'low'
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${item.lowStockThreshold > 0 ? Math.min(100, (item.quantity / (item.lowStockThreshold * 2)) * 100) : item.quantity > 0 ? 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <button
                        type="button"
                        className="btn-outline btn-sm min-w-[2.5rem]"
                        disabled={busy || item.quantity === 0}
                        onClick={() => adjustQty(item, -1)}
                        aria-label={`Decrease ${item.name}`}
                      >
                        −
                      </button>
                      <span className="min-w-[5rem] text-center font-semibold text-slate-900">
                        {item.quantity} {item.unit}
                      </span>
                      <button
                        type="button"
                        className="btn-outline btn-sm min-w-[2.5rem]"
                        disabled={busy}
                        onClick={() => adjustQty(item, 1)}
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        disabled={busy}
                        onClick={() => adjustQty(item, 10)}
                        aria-label={`Add 10 to ${item.name}`}
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        className="btn-outline btn-sm text-primary"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(isEditing ? null : item._id);
                          setDraftQty((d) => ({ ...d, [item._id]: String(item.quantity) }));
                          setDraftThreshold((d) => ({
                            ...d,
                            [item._id]: String(item.lowStockThreshold),
                          }));
                        }}
                      >
                        {isEditing ? 'Close' : 'Adjust'}
                      </button>
                    </div>

                    {isEditing && (
                      <div className="w-full border-t border-border/60 pt-4">
                        <div className="grid gap-4 sm:flex sm:flex-wrap sm:items-end">
                          <div>
                            <label className="text-xs font-medium text-slate-600">Set quantity</label>
                            <div className="mt-1 flex gap-2">
                              <input
                                type="number"
                                min={0}
                                className="w-24 rounded-lg border px-3 py-2 text-sm"
                                value={draftQty[item._id] ?? String(item.quantity)}
                                onChange={(e) =>
                                  setDraftQty((d) => ({ ...d, [item._id]: e.target.value }))
                                }
                              />
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                disabled={busy}
                                onClick={() => applyDraftQty(item)}
                              >
                                Save qty
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Low-stock alert</label>
                            <div className="mt-1 flex gap-2">
                              <input
                                type="number"
                                min={0}
                                className="w-24 rounded-lg border px-3 py-2 text-sm"
                                value={draftThreshold[item._id] ?? String(item.lowStockThreshold)}
                                onChange={(e) =>
                                  setDraftThreshold((d) => ({ ...d, [item._id]: e.target.value }))
                                }
                              />
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() => applyDraftThreshold(item)}
                              >
                                Save alert
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!loading && !error && (items ?? []).length === 0 && (
          <p className="text-sm text-muted">No inventory items yet. They are created automatically on first load.</p>
        )}
        {!loading && !error && (items ?? []).length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted">No items in this category.</p>
        )}
      </div>
    </div>
  );
}
