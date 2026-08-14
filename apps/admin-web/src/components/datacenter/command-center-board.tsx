'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';
import { CapacityBar, StatTile } from '../ui/stat-tile';

interface CommandCenterData {
  today: {
    orders: number;
    completed: number;
    inProgress: number;
    revenue: number;
    activeCustomers: number;
    activeRiders: number;
    activeBranches: number;
  };
  operations: {
    pickupSlaRate: number | null;
    deliverySlaRate: number | null;
    cancellationRate: number;
    customerRating: number | null;
  };
  capacity: {
    branchId: string;
    branchName: string;
    activeOrders: number;
    maxActiveOrders: number;
    utilizationPct: number;
  }[];
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="dc-panel-header">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    </div>
  );
}

export function CommandCenterBoard({ partnerId }: { partnerId: string }) {
  const load = useCallback(
    () => adminFetch<CommandCenterData>(`/admin/shops/${partnerId}/command-center`),
    [partnerId],
  );
  const { data, loading, error, reload } = useAdminQuery(load, [partnerId]);

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Territory partner</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Command Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Today's operations for this partner's territory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href={`/partners/branding/${partnerId}`} className="btn-outline btn-sm">
              Partner profile
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading command center…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <section className="dc-panel">
            <PanelHeader title="Today" />
            <div className="dc-panel-body">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
                <StatTile label="Orders" value={data.today.orders.toLocaleString()} tone="primary" />
                <StatTile label="Completed" value={data.today.completed.toLocaleString()} tone="accent" />
                <StatTile label="In Progress" value={data.today.inProgress.toLocaleString()} tone="violet" />
                <StatTile label="Revenue" value={formatPesoWhole(data.today.revenue)} tone="secondary" />
                <StatTile
                  label="Active Customers"
                  value={data.today.activeCustomers.toLocaleString()}
                  tone="amber"
                />
                <StatTile label="Active Riders" value={data.today.activeRiders.toLocaleString()} tone="rose" />
                <StatTile
                  label="Active Branches"
                  value={data.today.activeBranches.toLocaleString()}
                  tone="primary"
                />
              </div>
            </div>
          </section>

          <section className="dc-panel">
            <PanelHeader title="Operations" />
            <div className="dc-panel-body">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile
                  label="Pickup SLA"
                  value={data.operations.pickupSlaRate == null ? '—' : `${data.operations.pickupSlaRate}%`}
                  tone="primary"
                />
                <StatTile
                  label="Delivery SLA"
                  value={data.operations.deliverySlaRate == null ? '—' : `${data.operations.deliverySlaRate}%`}
                  tone="accent"
                />
                <StatTile
                  label="Cancellation Rate"
                  value={`${data.operations.cancellationRate}%`}
                  tone="rose"
                />
                <StatTile
                  label="Customer Rating"
                  value={data.operations.customerRating == null ? '—' : `${data.operations.customerRating}★`}
                  tone="amber"
                />
              </div>
            </div>
          </section>

          <section className="dc-panel">
            <PanelHeader title="Capacity" />
            <div className="dc-panel-body">
              {data.capacity.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No branches configured for this partner.</p>
              ) : (
                <div className="space-y-4">
                  {data.capacity.map((b) => (
                    <CapacityBar
                      key={b.branchId}
                      label={b.branchName}
                      pct={b.utilizationPct}
                      sub={`${b.activeOrders}/${b.maxActiveOrders} · ${b.utilizationPct}%`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
