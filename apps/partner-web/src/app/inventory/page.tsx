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

type SortKey = 'name' | 'quantity' | 'stock';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'quantity', label: 'Quantity (low → high)' },
  { value: 'stock', label: 'Stock level (worst first)' },
];

const STOCK_RANK: Record<'out' | 'low' | 'ok', number> = { out: 0, low: 1, ok: 2 };

function AddItemForm({
  branches,
  defaultBranchId,
  onCreate,
  onCancel,
}: {
  branches: [string, string][];
  defaultBranchId?: string;
  onCreate: (dto: {
    sku: string;
    name: string;
    category: string;
    unit: string;
    quantity: number;
    lowStockThreshold: number;
    branchId?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('supplies');
  const [unit, setUnit] = useState('units');
  const [quantity, setQuantity] = useState('0');
  const [threshold, setThreshold] = useState('10');
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.[0] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!sku.trim() || !name.trim() || !category.trim()) {
      setError('SKU, name, and category are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate({
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim() || 'units',
        quantity: Number.parseInt(quantity, 10) || 0,
        lowStockThreshold: Number.parseInt(threshold, 10) || 0,
        ...(branches.length > 1 ? { branchId } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-body mt-4 !py-5">
      <p className="text-sm font-semibold text-slate-900">Add inventory item</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.length > 1 && (
          <div>
            <label className="text-xs font-medium text-slate-600">Shop</label>
            <select
              className="input-field mt-1"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-slate-600">SKU</label>
          <input
            className="input-field mt-1"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g. DET-003"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            className="input-field mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Stain remover"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Category</label>
          <input
            className="input-field mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. detergent"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Unit</label>
          <input className="input-field mt-1" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Starting quantity</label>
          <input
            type="number"
            min={0}
            className="input-field mt-1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Low-stock alert</label>
          <input
            type="number"
            min={0}
            className="input-field mt-1"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={saving} className="btn-primary btn-sm disabled:opacity-50" onClick={submit}>
          {saving ? 'Adding…' : 'Add item'}
        </button>
        <button type="button" className="btn-outline btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { ready } = useRequirePartner();
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [draftThreshold, setDraftThreshold] = useState<Record<string, string>>({});
  const [draftUsagePerOrder, setDraftUsagePerOrder] = useState<Record<string, string>>({});
  const [draftUsagePerKg, setDraftUsagePerKg] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [showAddForm, setShowAddForm] = useState(false);

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

  const branches = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items ?? []) {
      if (i.branchId) map.set(i.branchId, i.branchName ?? i.branchId);
    }
    return [...map.entries()].sort(([, a], [, b]) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (categoryFilter !== 'all') list = list.filter((i) => i.category === categoryFilter);
    if (branchFilter !== 'all') list = list.filter((i) => i.branchId === branchFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    return list;
  }, [items, categoryFilter, branchFilter, searchQuery]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortKey === 'quantity') return a.quantity - b.quantity;
      if (sortKey === 'stock') return STOCK_RANK[stockLevel(a)] - STOCK_RANK[stockLevel(b)];
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [filtered, sortKey]);

  const branchCount = useMemo(
    () => new Set((items ?? []).map((i) => i.branchId).filter(Boolean)).size,
    [items],
  );
  const multiBranch = branchCount > 1;

  const grouped = useMemo(() => {
    const map = new Map<string, { branchName?: string; category: string; items: PartnerInventoryItem[] }>();
    for (const item of sorted) {
      const key = multiBranch ? `${item.branchId ?? ''}|${item.category}` : item.category;
      const entry = map.get(key) ?? { branchName: item.branchName, category: item.category, items: [] };
      entry.items.push(item);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => {
      const branchCmp = (a.branchName ?? '').localeCompare(b.branchName ?? '');
      return branchCmp !== 0 ? branchCmp : a.category.localeCompare(b.category);
    });
  }, [sorted, multiBranch]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const low = list.filter((i) => stockLevel(i) === 'low').length;
    const out = list.filter((i) => stockLevel(i) === 'out').length;
    return { total: list.length, low, out };
  }, [items]);

  async function createItem(dto: {
    sku: string;
    name: string;
    category: string;
    unit: string;
    quantity: number;
    lowStockThreshold: number;
    branchId?: string;
  }) {
    const created = await partnerFetch<PartnerInventoryItem>('/partner/inventory', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    setData((prev) => [...(prev ?? []), created]);
    setShowAddForm(false);
  }

  async function deleteItem(item: PartnerInventoryItem) {
    if (!window.confirm(`Delete "${item.name}" from inventory? This cannot be undone.`)) return;
    setSaving(item._id);
    setActionError('');
    try {
      await partnerFetch(`/partner/inventory/${item._id}`, { method: 'DELETE' });
      setData((prev) => (prev ?? []).filter((i) => i._id !== item._id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete item');
    } finally {
      setSaving(null);
    }
  }

  async function patchItem(
    id: string,
    patch: { quantity?: number; lowStockThreshold?: number; usagePerOrder?: number; usagePerKg?: number },
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
        setDraftUsagePerOrder((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
        setDraftUsagePerKg((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update');
      // adjustQty applies an optimistic update before this call — resync from the server so a
      // failed PATCH doesn't leave the on-screen quantity out of sync with what's actually saved.
      await reload();
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

  function applyDraftUsagePerOrder(item: PartnerInventoryItem) {
    const raw = draftUsagePerOrder[item._id] ?? String(item.usagePerOrder);
    const usagePerOrder = Number.parseFloat(raw);
    if (Number.isNaN(usagePerOrder) || usagePerOrder < 0) {
      setActionError('Enter a valid per-order auto-deduct amount (0 or higher).');
      return;
    }
    void patchItem(item._id, { usagePerOrder });
  }

  function applyDraftUsagePerKg(item: PartnerInventoryItem) {
    const raw = draftUsagePerKg[item._id] ?? String(item.usagePerKg);
    const usagePerKg = Number.parseFloat(raw);
    if (Number.isNaN(usagePerKg) || usagePerKg < 0) {
      setActionError('Enter a valid per-kg auto-deduct amount (0 or higher).');
      return;
    }
    void patchItem(item._id, { usagePerKg });
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
          <div className="flex gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
              Refresh
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? 'Close' : 'Add item'}
            </button>
          </div>
        }
      />

      {showAddForm && (
        <AddItemForm
          branches={branches}
          defaultBranchId={branchFilter !== 'all' ? branchFilter : undefined}
          onCreate={createItem}
          onCancel={() => setShowAddForm(false)}
        />
      )}

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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          className="input-field min-h-[2.5rem] flex-1 sm:max-w-xs"
          placeholder="Search by name or SKU…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="input-field min-h-[2.5rem] w-auto"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {branches.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={branchFilter === 'all' ? 'filter-chip-active' : 'filter-chip'}
            onClick={() => setBranchFilter('all')}
          >
            All shops
          </button>
          {branches.map(([id, name]) => (
            <button
              key={id}
              type="button"
              className={branchFilter === id ? 'filter-chip-active' : 'filter-chip'}
              onClick={() => setBranchFilter(id)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {categories.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
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
        {grouped.map((group) => (
          <section key={`${group.branchName ?? ''}|${group.category}`}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {multiBranch && group.branchName ? `${group.branchName} · ` : ''}
              {categoryLabel(group.category)}
            </h2>
            <div className="space-y-3">
              {group.items.map((item) => {
                const level = stockLevel(item);
                const busy = saving === item._id;
                const isEditing = editingId === item._id;

                return (
                  <div
                    key={item._id}
                    className={`list-row flex-wrap flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4 ${
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
                        {(item.usagePerOrder > 0 || item.usagePerKg > 0) && (
                          <>
                            {' '}
                            · auto-deducts{item.usagePerOrder > 0 ? ` ${item.usagePerOrder}/order` : ''}
                            {item.usagePerKg > 0 ? ` ${item.usagePerKg}/kg` : ''}
                          </>
                        )}
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
                          setDraftUsagePerOrder((d) => ({
                            ...d,
                            [item._id]: String(item.usagePerOrder),
                          }));
                          setDraftUsagePerKg((d) => ({ ...d, [item._id]: String(item.usagePerKg) }));
                        }}
                      >
                        {isEditing ? 'Close' : 'Adjust'}
                      </button>
                      <button
                        type="button"
                        className="btn-outline btn-sm text-red-600"
                        disabled={busy}
                        onClick={() => void deleteItem(item)}
                      >
                        Delete
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
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Auto-deduct per order
                            </label>
                            <div className="mt-1 flex gap-2">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="w-24 rounded-lg border px-3 py-2 text-sm"
                                value={draftUsagePerOrder[item._id] ?? String(item.usagePerOrder)}
                                onChange={(e) =>
                                  setDraftUsagePerOrder((d) => ({ ...d, [item._id]: e.target.value }))
                                }
                              />
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() => applyDraftUsagePerOrder(item)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Auto-deduct per kg
                            </label>
                            <div className="mt-1 flex gap-2">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="w-24 rounded-lg border px-3 py-2 text-sm"
                                value={draftUsagePerKg[item._id] ?? String(item.usagePerKg)}
                                onChange={(e) =>
                                  setDraftUsagePerKg((d) => ({ ...d, [item._id]: e.target.value }))
                                }
                              />
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() => applyDraftUsagePerKg(item)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          When set, this item is deducted automatically every time an order is confirmed
                          received at your shop — per-order amount, plus per-kg amount × the order&apos;s
                          verified weight.
                        </p>
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
