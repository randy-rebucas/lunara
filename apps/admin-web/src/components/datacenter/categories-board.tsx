'use client';

import { useCallback, useMemo, useState } from 'react';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
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

interface CategoryGroup {
  type: string;
  services: LaundryServiceRow[];
  activeCount: number;
}

export function CategoriesBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<LaundryServiceRow[]>('/admin/services');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data: items, loading, error, reload } = useAdminQuery(load, []);

  const categories = useMemo<CategoryGroup[]>(() => {
    if (!items) return [];
    const map = new Map<string, LaundryServiceRow[]>();
    for (const s of items) {
      const list = map.get(s.type) ?? [];
      list.push(s);
      map.set(s.type, list);
    }
    return Array.from(map.entries())
      .map(([type, services]) => ({
        type,
        services,
        activeCount: services.filter((s) => s.isActive).length,
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [items]);

  const totalActive = categories.reduce((n, c) => n + c.activeCount, 0);
  const totalServices = items?.length ?? 0;

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Network</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Service categories
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Laundry service types grouped by category. Each category represents a distinct
              service type offered to customers during booking.
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

      {loading && !items ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading categories…
        </div>
      ) : null}

      {items ? (
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCell
              label="Categories"
              value={categories.length}
              sub="service types"
            />
            <MetricCell
              label="Active services"
              value={totalActive}
              highlight={totalActive > 0 ? 'accent' : 'warning'}
            />
            <MetricCell label="Total services" value={totalServices} sub="across all types" />
          </div>

          {categories.length === 0 ? (
            <section className="dc-panel">
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No service categories yet</p>
                <p className="mt-1 text-sm text-muted">
                  Run{' '}
                  <code className="text-code">
                    npm run seed:services --workspace=@lunara/api
                  </code>{' '}
                  to load defaults.
                </p>
              </div>
            </section>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <section key={cat.type} className="dc-panel">
                  <div className="dc-panel-header">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">{cat.type}</h2>
                      <span
                        className={cat.activeCount > 0 ? 'badge-accent' : 'badge-neutral'}
                      >
                        {cat.activeCount > 0 ? `${cat.activeCount} active` : 'inactive'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {cat.services.length} service{cat.services.length !== 1 ? 's' : ''} in
                      this category
                    </p>
                  </div>
                  <ul className="dc-panel-body divide-y divide-border/30 p-0">
                    {cat.services.map((s) => (
                      <li
                        key={s._id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-medium ${s.isActive ? 'text-slate-900' : 'text-muted'}`}
                          >
                            {s.label}
                          </p>
                          <p className="truncate text-xs text-muted">
                            ₱{s.pricePerKg}/kg · min {s.minWeightKg} kg
                          </p>
                        </div>
                        <span className={s.isActive ? 'badge-accent' : 'badge-neutral'}>
                          {s.isActive ? 'Active' : 'Off'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border/30 bg-slate-50 px-4 py-3">
            <p className="text-xs text-muted">
              Categories are derived from service types in the catalog. To manage individual
              service pricing and availability, go to{' '}
              <a href="/services" className="link-primary font-medium">
                Services
              </a>
              .
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
