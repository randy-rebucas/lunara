'use client';

import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface LaundryServiceRow {
  _id: string;
  type: string;
  label: string;
  description: string;
  pricePerKg: number;
  minWeightKg: number;
  isActive: boolean;
  sortOrder: number;
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

export function ServicesBoard() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editing, setEditing] = useState<LaundryServiceRow | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
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

  const filteredServices = useMemo(() => {
    let list = services;
    if (statusFilter === 'active') list = list.filter((s) => s.isActive);
    if (statusFilter === 'inactive') list = list.filter((s) => !s.isActive);
    const searched = filterBySearch(list, search, [
      (s) => s.type,
      (s) => s.label,
      (s) => s.description,
    ]);
    return searched.slice(0, limit);
  }, [services, statusFilter, search, limit]);

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
      <header className="mb-8">
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
            <span className="badge-neutral">Polling</span>
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
        <div className="space-y-4">
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCell
              label="Active services"
              value={activeCount}
              highlight={activeCount > 0 ? 'accent' : 'warning'}
            />
            <MetricCell label="Inactive" value={inactiveCount} />
            <MetricCell label="Catalog size" value={services.length} sub="booking types" />
          </div>

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Status filter</h2>
                <p className="text-xs text-muted">{services.length} services total</p>
              </div>
              {statusFilter !== 'all' ? (
                <button
                  type="button"
                  className="link-primary text-xs font-medium"
                  onClick={() => setStatusFilter('all')}
                >
                  Clear filter
                </button>
              ) : null}
            </div>
            <div className="dc-panel-body pt-1">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={statusFilter === 'all' ? 'filter-chip-active' : 'filter-chip'}
                  aria-pressed={statusFilter === 'all'}
                >
                  All ({services.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={statusFilter === 'active' ? 'filter-chip-active' : 'filter-chip'}
                  aria-pressed={statusFilter === 'active'}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inactive')}
                  className={statusFilter === 'inactive' ? 'filter-chip-active' : 'filter-chip'}
                  aria-pressed={statusFilter === 'inactive'}
                >
                  Inactive ({inactiveCount})
                </button>
              </div>
            </div>
          </section>

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
