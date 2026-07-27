'use client';

import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface LaundryServiceRow {
  _id: string;
  type: string;
  label: string;
  description: string;
  category?: string;
  pricePerKg: number;
  minWeightKg: number;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  core_laundry: 'Core Laundry',
  garment_care: 'Garment Care',
  home_textiles: 'Home Textiles',
  footwear_leather: 'Footwear & Leather',
  wellness_sanitation: 'Wellness & Sanitation',
  specialty: 'Specialty',
};

function categoryLabel(category?: string) {
  if (!category) return 'Uncategorized';
  return CATEGORY_LABELS[category] ?? category;
}

type ServiceState = 'nominal' | 'attention';

const serviceCopy: Record<ServiceState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'Services live',
    detail: 'At least one laundry service is active for customer booking.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'No active services',
    detail: 'Activate a service — customers choose from active catalog items when booking.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

function deriveServiceState(items: LaundryServiceRow[]): ServiceState {
  if (items.some((s) => s.isActive)) return 'nominal';
  return 'attention';
}

// ── Stat tiles ─────────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  onClick?: () => void;
  active?: boolean;
}) {
  const cls = `rounded-xl p-4 text-left ring-1 transition-all ${TILE_TONES[tone]} ${
    active ? 'ring-2 ring-primary/40' : ''
  }`;
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function ServicesBoard() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editing, setEditing] = useState<LaundryServiceRow | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [minWeightKg, setMinWeightKg] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    const data = await adminFetch<LaundryServiceRow[]>('/admin/services');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data: items, loading, error, reload } = useAdminQuery(load, []);

  const services = useMemo(() => items ?? [], [items]);
  const activeCount = services.filter((s) => s.isActive).length;
  const inactiveCount = services.length - activeCount;

  const categories = useMemo(
    () => Array.from(new Set(services.map((s) => s.category ?? 'uncategorized'))).sort(),
    [services],
  );

  const filteredServices = useMemo(() => {
    let list = services;
    if (statusFilter === 'active') list = list.filter((s) => s.isActive);
    if (statusFilter === 'inactive') list = list.filter((s) => !s.isActive);
    if (categoryFilter !== 'all') {
      list = list.filter((s) => (s.category ?? 'uncategorized') === categoryFilter);
    }
    const searched = filterBySearch(list, search, [
      (s) => s.type,
      (s) => s.label,
      (s) => s.description,
      (s) => categoryLabel(s.category),
    ]);
    return searched.slice(0, limit);
  }, [services, statusFilter, categoryFilter, search, limit]);

  const serviceState = deriveServiceState(services);
  const copy = serviceCopy[serviceState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  function openEdit(service: LaundryServiceRow) {
    setEditing(service);
    setLabel(service.label);
    setDescription(service.description);
    setCategory(service.category ?? '');
    setPricePerKg(String(service.pricePerKg));
    setMinWeightKg(String(service.minWeightKg));
    setSortOrder(String(service.sortOrder));
    setActionError('');
    document.getElementById('service-edit')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setActionError('');
    try {
      await adminFetch(`/admin/services/${editing._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim(),
          category: category || undefined,
          pricePerKg: Number(pricePerKg),
          minWeightKg: Number(minWeightKg),
          sortOrder: Number(sortOrder),
        }),
      });
      setEditing(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: LaundryServiceRow) {
    setActionError('');
    try {
      await adminFetch(`/admin/services/${service._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !service.isActive }),
      });
      if (editing?._id === service._id) setEditing(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update service');
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Catalog</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Laundry services
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Pricing and availability for booking types. Active services appear in customer checkout;
              run <code className="text-code">npm run seed:services</code> to restore defaults.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {actionError ? (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      ) : null}

      {loading && !items ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading services…
        </div>
      ) : null}

      {items ? (
        <div className="space-y-3">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {activeCount > 0 ? (
              <span className="badge-accent px-3 py-1 text-xs font-semibold">{activeCount} active</span>
            ) : null}
            {inactiveCount > 0 ? (
              <span className="badge-neutral px-3 py-1 text-xs font-semibold">
                {inactiveCount} inactive
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label="Catalog size"
              value={services.length.toLocaleString()}
              sub="booking types"
              tone="primary"
              onClick={() => setStatusFilter('all')}
              active={statusFilter === 'all'}
            />
            <StatTile
              label="Active services"
              value={activeCount.toLocaleString()}
              tone={activeCount > 0 ? 'accent' : 'amber'}
              onClick={() => setStatusFilter('active')}
              active={statusFilter === 'active'}
            />
            <StatTile
              label="Inactive"
              value={inactiveCount.toLocaleString()}
              tone="secondary"
              onClick={() => setStatusFilter('inactive')}
              active={statusFilter === 'inactive'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-muted" htmlFor="svc-category-filter">
              Category
            </label>
            <select
              id="svc-category-filter"
              className="input-field w-auto"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c === 'uncategorized' ? undefined : c)}
                </option>
              ))}
            </select>
          </div>

          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Type, label, description…"
            limit={limit}
            onLimitChange={setLimit}
            total={services.length}
            filtered={filteredServices.length}
          />

          <section className="dc-panel">
            <div className="dc-panel-header">
              <h2 className="text-sm font-semibold text-slate-900">Service catalog</h2>
              <p className="text-xs text-muted">
                Showing {filteredServices.length} of {services.length} services
              </p>
            </div>

            {filteredServices.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">
                  {search || statusFilter !== 'all' ? 'No services match' : 'No services yet'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {search || statusFilter !== 'all'
                    ? 'Try another filter or search term.'
                    : 'Run npm run seed:services --workspace=@lunara/api to load defaults.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[960px]">
                  <caption className="sr-only">Laundry services catalog</caption>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Label</th>
                      <th scope="col">Category</th>
                      <th scope="col">Price / kg</th>
                      <th scope="col">Min kg</th>
                      <th scope="col">Order</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((s) => (
                      <tr key={s._id} className={!s.isActive ? 'opacity-75' : ''}>
                        <td className="text-code text-xs text-muted">{s.type}</td>
                        <td className="max-w-[16rem]">
                          <p className="font-medium text-slate-900">{s.label}</p>
                          <p className="truncate text-xs text-muted" title={s.description}>
                            {s.description}
                          </p>
                        </td>
                        <td>
                          <span className="badge-neutral text-xs">{categoryLabel(s.category)}</span>
                        </td>
                        <td className="tabular-nums">{formatPeso(s.pricePerKg)}</td>
                        <td className="tabular-nums text-muted">{s.minWeightKg} kg</td>
                        <td className="tabular-nums text-muted">{s.sortOrder}</td>
                        <td>
                          <span className={s.isActive ? 'badge-accent' : 'badge-neutral'}>
                            {s.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="space-x-3 whitespace-nowrap">
                          <button
                            type="button"
                            className="link-primary text-xs font-medium"
                            onClick={() => openEdit(s)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="link-primary text-xs font-medium"
                            onClick={() => void toggleActive(s)}
                          >
                            {s.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {editing ? (
            <section className="dc-panel" id="service-edit">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Edit service</h2>
                  <p className="text-xs text-muted">
                    {editing.type} — type is fixed; adjust pricing and display fields
                  </p>
                </div>
                <button
                  type="button"
                  className="link-primary text-xs font-medium"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={saveEdit} className="dc-panel-body">
                <div className="dc-form-grid">
                  <div>
                    <label htmlFor="svc-label" className="form-label">
                      Label
                    </label>
                    <input
                      id="svc-label"
                      className="input-field"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="svc-category" className="form-label">
                      Category
                    </label>
                    <select
                      id="svc-category"
                      className="input-field"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">Uncategorized</option>
                      {Object.entries(CATEGORY_LABELS).map(([value, categoryName]) => (
                        <option key={value} value={value}>
                          {categoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="svc-price" className="form-label">
                      Price per kg (₱)
                    </label>
                    <input
                      id="svc-price"
                      className="input-field"
                      type="number"
                      min={0}
                      step={1}
                      value={pricePerKg}
                      onChange={(e) => setPricePerKg(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="svc-min" className="form-label">
                      Min weight (kg)
                    </label>
                    <input
                      id="svc-min"
                      className="input-field"
                      type="number"
                      min={1}
                      step={0.5}
                      value={minWeightKg}
                      onChange={(e) => setMinWeightKg(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="svc-order" className="form-label">
                      Sort order
                    </label>
                    <input
                      id="svc-order"
                      className="input-field"
                      type="number"
                      min={0}
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="svc-desc" className="form-label">
                      Description
                    </label>
                    <input
                      id="svc-desc"
                      className="input-field"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="dc-form-actions mt-4">
                  <button type="submit" disabled={saving} className="btn-primary btn-sm">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
