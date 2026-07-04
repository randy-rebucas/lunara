'use client';

import QRCode from 'react-qr-code';
import { useCallback, useMemo, useState } from 'react';
import { buildTagQrPayload } from '@lunara/utils';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

type LaundryTagStatus = 'available' | 'assigned' | 'retired';

interface LaundryTag {
  _id: string;
  code: string;
  status: LaundryTagStatus;
  batchId: string;
  currentOrderId?: string;
  createdAt: string;
}

const STATUS_FILTER_OPTIONS = [
  { value: '',          label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'assigned',  label: 'Assigned' },
  { value: 'retired',   label: 'Retired' },
];

export function LaundryTagsBoard() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [limit, setLimit]               = useState(50);

  const [quantity, setQuantity]       = useState('20');
  const [codePrefix, setCodePrefix]   = useState('TAG');
  const [saving, setSaving]           = useState(false);
  const [actionError, setActionError] = useState('');
  const [lastBatch, setLastBatch]     = useState<LaundryTag[] | null>(null);

  const load = useCallback(async () => {
    const pageSize = 200;
    const all: LaundryTag[] = [];
    for (let page = 1; ; page++) {
      const data = await adminFetch<{ items: LaundryTag[]; total: number }>(
        `/laundry-tags?limit=${pageSize}&page=${page}`,
      );
      all.push(...data.items);
      if (all.length >= data.total || data.items.length === 0) break;
    }
    return all;
  }, []);

  const { data: items, loading, error, reload } = useAdminQuery(load, []);

  const tags = useMemo(() => items ?? [], [items]);
  const { availableCount, assignedCount, retiredCount } = useMemo(
    () => ({
      availableCount: tags.filter((t) => t.status === 'available').length,
      assignedCount: tags.filter((t) => t.status === 'assigned').length,
      retiredCount: tags.filter((t) => t.status === 'retired').length,
    }),
    [tags],
  );

  const filteredTags = useMemo(() => {
    let list = tags;
    if (statusFilter) list = list.filter((t) => t.status === statusFilter);
    return filterBySearch(list, search, [(t) => t.code, (t) => t.batchId]).slice(0, limit);
  }, [tags, statusFilter, search, limit]);

  async function generateBatch(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setActionError('');
    setLastBatch(null);
    try {
      const data = await adminFetch<{ batchId: string; tags: LaundryTag[] }>('/laundry-tags/batches', {
        method: 'POST',
        body: JSON.stringify({
          quantity: Number(quantity),
          codePrefix: codePrefix.trim() || undefined,
        }),
      });
      setLastBatch(data.tags);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate tag batch');
    } finally {
      setSaving(false);
    }
  }

  async function retire(tag: LaundryTag) {
    const reason = window.prompt(`Reason for retiring ${tag.code}?`, 'lost');
    if (reason == null) return;
    setActionError('');
    try {
      await adminFetch(`/laundry-tags/${tag._id}/retire`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to retire tag');
    }
  }

  async function reactivate(tag: LaundryTag) {
    setActionError('');
    try {
      await adminFetch(`/laundry-tags/${tag._id}/reactivate`, { method: 'POST' });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reactivate tag');
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Laundry tags
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Reusable QR tags riders scan onto a bag at pickup. Tags auto-release back to the
              available pool once an order is delivered or picked up.
            </p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      {error       && <div className="alert-error mb-4" role="alert">{error}</div>}
      {actionError && <div className="alert-error mb-4" role="alert">{actionError}</div>}

      {loading && !items && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Loading tags…
        </div>
      )}

      {items && (
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <MetricCell label="Available" value={availableCount} highlight={availableCount > 0 ? 'accent' : 'warning'} />
            <MetricCell label="Assigned"  value={assignedCount} />
            <MetricCell label="Retired"   value={retiredCount} />
          </div>

          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tag code, batch id…"
            limit={limit}
            onLimitChange={setLimit}
            total={tags.length}
            filtered={filteredTags.length}
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterOptions={STATUS_FILTER_OPTIONS}
            filterLabel="Status"
          />

          <section className="dc-panel" id="tag-catalog">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Tag pool</h2>
                <p className="text-xs text-muted">
                  Showing {filteredTags.length} of {tags.length} tags
                </p>
              </div>
              <a href="#tag-generate" className="link-primary text-xs font-medium">Generate batch →</a>
            </div>

            {filteredTags.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">
                  {search || statusFilter ? 'No tags match' : 'No tags yet'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {search || statusFilter ? 'Try another filter or search term.' : 'Generate a batch below to print physical tags.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[720px]">
                  <caption className="sr-only">Laundry tag pool</caption>
                  <thead>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col">Status</th>
                      <th scope="col">Batch</th>
                      <th scope="col">Created</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTags.map((t) => (
                      <tr key={t._id} className={t.status === 'retired' ? 'opacity-75' : ''}>
                        <td className="text-code font-bold text-primary">{t.code}</td>
                        <td>
                          <span
                            className={
                              t.status === 'available'
                                ? 'badge-accent'
                                : t.status === 'assigned'
                                  ? 'badge-neutral'
                                  : 'badge-neutral'
                            }
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="text-code text-xs text-muted">{t.batchId.slice(0, 8)}</td>
                        <td className="text-sm text-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td>
                          {t.status === 'retired' ? (
                            <button type="button" className="link-primary text-xs font-medium" onClick={() => void reactivate(t)}>
                              Reactivate
                            </button>
                          ) : (
                            <button type="button" className="link-primary text-xs font-medium" onClick={() => void retire(t)}>
                              Retire
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dc-panel" id="tag-generate">
            <div className="dc-panel-header">
              <h2 className="text-sm font-semibold text-slate-900">Generate tag batch</h2>
              <p className="text-xs text-muted">Creates new codes and prints them below for physical tags.</p>
            </div>
            <form onSubmit={generateBatch} className="dc-panel-body">
              <div className="dc-form-grid">
                <div>
                  <label htmlFor="tag-quantity" className="form-label">Quantity</label>
                  <input id="tag-quantity" className="input-field" type="number" min={1} max={500}
                    value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="tag-prefix" className="form-label">Code prefix</label>
                  <input id="tag-prefix" className="input-field uppercase" placeholder="TAG"
                    value={codePrefix} onChange={(e) => setCodePrefix(e.target.value)} />
                </div>
              </div>
              <div className="dc-form-actions mt-4">
                <button type="submit" disabled={saving} className="btn-primary btn-sm">
                  {saving ? 'Generating…' : 'Generate batch'}
                </button>
              </div>
            </form>

            {lastBatch && (
              <div className="dc-panel-body border-t border-border/60 print:border-none">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {lastBatch.length} tags generated — print this page to produce physical stickers
                  </p>
                  <button type="button" className="btn-outline btn-sm print:hidden" onClick={() => window.print()}>
                    Print
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3">
                  {lastBatch.map((t) => (
                    <div key={t._id} className="flex flex-col items-center gap-1 rounded-lg border border-border/60 p-4 print:break-inside-avoid">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">Lunara</p>
                      <div className="mt-1 rounded-lg bg-white p-2 ring-1 ring-border/60">
                        <QRCode value={buildTagQrPayload(t.code)} size={128} />
                      </div>
                      <p className="text-code mt-1 text-sm font-bold">{t.code}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
