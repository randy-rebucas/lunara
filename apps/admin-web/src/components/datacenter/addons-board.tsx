'use client';

import { useCallback, useMemo, useState } from 'react';
import { resolveMediaUrl } from '@lunara/utils';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface LaundryAddonRow {
  _id: string;
  slug: string;
  label: string;
  description: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

type AddonState = 'nominal' | 'attention';

const addonCopy: Record<AddonState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'Add-ons live',
    detail: 'At least one add-on is active for customer booking.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'No active add-ons',
    detail: 'Activate add-ons — customers can select them during booking.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

function deriveAddonState(items: LaundryAddonRow[]): AddonState {
  if (items.some((a) => a.isActive)) return 'nominal';
  return 'attention';
}

function resolveAddonImage(url?: string) {
  return resolveMediaUrl(url, process.env.NEXT_PUBLIC_API_URL);
}

export function AddonsBoard() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editing, setEditing] = useState<LaundryAddonRow | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    const data = await adminFetch<LaundryAddonRow[]>('/admin/addons');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data: items, loading, error, reload } = useAdminQuery(load, []);

  const addons = useMemo(() => items ?? [], [items]);
  const activeCount = addons.filter((a) => a.isActive).length;
  const inactiveCount = addons.length - activeCount;

  const filteredAddons = useMemo(() => {
    let list = addons;
    if (statusFilter === 'active') list = list.filter((a) => a.isActive);
    if (statusFilter === 'inactive') list = list.filter((a) => !a.isActive);
    const searched = filterBySearch(list, search, [
      (a) => a.slug,
      (a) => a.label,
      (a) => a.description,
    ]);
    return searched.slice(0, limit);
  }, [addons, statusFilter, search, limit]);

  const addonState = deriveAddonState(addons);
  const copy = addonCopy[addonState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  function openEdit(addon: LaundryAddonRow) {
    setEditing(addon);
    setLabel(addon.label);
    setDescription(addon.description);
    setPrice(String(addon.price));
    setImageUrl(addon.imageUrl ?? '');
    setSortOrder(String(addon.sortOrder));
    setActionError('');
    document.getElementById('addon-edit')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setActionError('');
    try {
      await adminFetch(`/admin/addons/${editing._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim(),
          price: Number(price),
          imageUrl: imageUrl.trim(),
          sortOrder: Number(sortOrder),
        }),
      });
      setEditing(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update add-on');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(addon: LaundryAddonRow) {
    setActionError('');
    try {
      await adminFetch(`/admin/addons/${addon._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !addon.isActive }),
      });
      if (editing?._id === addon._id) setEditing(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update add-on');
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Catalog</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Booking add-ons
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Optional extras shown during booking — pricing, images, and availability. Run{' '}
              <code className="text-code">npm run seed:addons</code> to restore defaults.
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
          Loading add-ons…
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

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCell
              label="Active add-ons"
              value={activeCount}
              highlight={activeCount > 0 ? 'accent' : 'warning'}
            />
            <MetricCell label="Inactive" value={inactiveCount} />
            <MetricCell label="Catalog size" value={addons.length} sub="booking extras" />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="addon-status-filter" className="form-label">
                Status
              </label>
              <select
                id="addon-status-filter"
                className="input-field"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <ListControls
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Slug, label, description…"
              limit={limit}
              onLimitChange={setLimit}
              total={addons.length}
              filtered={filteredAddons.length}
            />
          </div>

          <section className="dc-panel">
            <div className="dc-panel-header">
              <h2 className="text-sm font-semibold text-slate-900">Add-on catalog</h2>
              <p className="text-xs text-muted">
                Showing {filteredAddons.length} of {addons.length} add-ons
              </p>
            </div>

            {filteredAddons.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No add-ons match</p>
                <p className="mt-1 text-sm text-muted">
                  Run npm run seed:addons --workspace=@lunara/api to load defaults.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1040px]">
                  <caption className="sr-only">Booking add-ons catalog</caption>
                  <thead>
                    <tr>
                      <th scope="col">Image</th>
                      <th scope="col">Slug</th>
                      <th scope="col">Label</th>
                      <th scope="col">Price</th>
                      <th scope="col">Order</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAddons.map((a) => {
                      const img = resolveAddonImage(a.imageUrl);
                      return (
                        <tr key={a._id} className={!a.isActive ? 'opacity-75' : ''}>
                          <td>
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                className="h-12 w-12 rounded-lg bg-slate-50 object-cover ring-1 ring-border/40"
                              />
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                          <td className="text-code text-xs text-muted">{a.slug}</td>
                          <td className="max-w-[16rem]">
                            <p className="font-medium text-slate-900">{a.label}</p>
                            <p className="truncate text-xs text-muted" title={a.description}>
                              {a.description}
                            </p>
                          </td>
                          <td className="tabular-nums">{formatPeso(a.price)}</td>
                          <td className="tabular-nums text-muted">{a.sortOrder}</td>
                          <td>
                            <span className={a.isActive ? 'badge-accent' : 'badge-neutral'}>
                              {a.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="space-x-3 whitespace-nowrap">
                            <button
                              type="button"
                              className="link-primary text-xs font-medium"
                              onClick={() => openEdit(a)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="link-primary text-xs font-medium"
                              onClick={() => void toggleActive(a)}
                            >
                              {a.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {editing ? (
            <section className="dc-panel" id="addon-edit">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Edit add-on</h2>
                  <p className="text-xs text-muted">
                    {editing.slug} — slug is fixed; update display, price, and image URL
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
                <div className="mb-4 flex items-center gap-4">
                  {resolveAddonImage(imageUrl) ? (
                    <img
                      src={resolveAddonImage(imageUrl)}
                      alt=""
                      className="h-16 w-16 rounded-lg bg-slate-50 object-cover ring-1 ring-border/40"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xs text-muted">
                      No image
                    </div>
                  )}
                  <p className="text-xs text-muted">
                    Public path or full URL. Seed images live under{' '}
                    <code className="text-code">/api/v1/uploads/catalog-addons/</code>
                  </p>
                </div>
                <div className="dc-form-grid">
                  <div>
                    <label htmlFor="addon-label" className="form-label">
                      Label
                    </label>
                    <input
                      id="addon-label"
                      className="input-field"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="addon-price" className="form-label">
                      Price (₱)
                    </label>
                    <input
                      id="addon-price"
                      className="input-field"
                      type="number"
                      min={0}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="addon-order" className="form-label">
                      Sort order
                    </label>
                    <input
                      id="addon-order"
                      className="input-field"
                      type="number"
                      min={0}
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="addon-image" className="form-label">
                      Image URL
                    </label>
                    <input
                      id="addon-image"
                      className="input-field"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="/api/v1/uploads/catalog-addons/fabric_softener.svg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="addon-desc" className="form-label">
                      Description
                    </label>
                    <input
                      id="addon-desc"
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
