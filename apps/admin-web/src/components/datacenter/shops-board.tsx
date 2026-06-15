'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface Shop {
  _id: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  staffCount: number;
  totalOrders: number;
  revenue: number;
}

interface Branch {
  _id: string;
  code: string;
  name: string;
  city: string;
  line1: string;
  maxActiveOrders: number;
  activeOrders: number;
  capacityAvailable: boolean;
}

type ShopNetworkState = 'nominal' | 'attention' | 'critical';

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/branches', label: 'Branch network' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/orders', label: 'Orders' },
] as const;

const shopNetworkCopy: Record<
  ShopNetworkState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Shop network nominal',
    detail: 'Branches have order capacity available for dispatch.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Capacity pressure',
    detail: 'One or more branches are at active-order capacity.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Dispatch constrained',
    detail: 'Most or all branches cannot accept new orders.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function deriveShopNetworkState(atCapacity: number, branchCount: number): ShopNetworkState {
  if (branchCount > 0 && atCapacity >= branchCount) return 'critical';
  if (atCapacity > 0) return 'attention';
  return 'nominal';
}

export function ShopsBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [branchSearch, setBranchSearch] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [branchLimit, setBranchLimit] = useState(50);
  const [partnerLimit, setPartnerLimit] = useState(50);

  const load = useCallback(async () => {
    const [shopsRes, branches] = await Promise.all([
      adminFetch<{ shops: Shop[] }>('/admin/shops'),
      adminFetch<Branch[]>('/admin/branches'),
    ]);
    setLastUpdated(new Date());
    return { shops: shopsRes.shops, branches };
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  const shops = data?.shops ?? [];
  const branches = data?.branches ?? [];

  const atCapacityBranches = useMemo(
    () => branches.filter((b) => !b.capacityAvailable),
    [branches],
  );
  const atCapacityCount = atCapacityBranches.length;
  const activePartners = shops.filter((s) => s.isActive).length;
  const totalPartnerRevenue = useMemo(
    () => shops.reduce((sum, s) => sum + s.revenue, 0),
    [shops],
  );
  const networkState = deriveShopNetworkState(atCapacityCount, branches.length);
  const copy = shopNetworkCopy[networkState];

  const filteredBranches = useMemo(() => {
    const searched = filterBySearch(branches, branchSearch, [
      (b) => b.code,
      (b) => b.name,
      (b) => b.city,
      (b) => b.line1,
    ]);
    return searched.slice(0, branchLimit);
  }, [branches, branchSearch, branchLimit]);

  const filteredShops = useMemo(() => {
    const searched = filterBySearch(shops, partnerSearch, [
      (s) => s.email,
      (s) => s.phone,
      (s) => s._id,
    ]);
    return searched.slice(0, partnerLimit);
  }, [shops, partnerSearch, partnerLimit]);

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div>
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Partner network</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Shops
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Partner accounts and branch load — for hierarchy, managers, and quotas see{' '}
              <Link href="/branches" className="link-primary">
                Branch network
              </Link>
              .
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
            <Link href="/branches" className="btn-outline btn-sm">
              Branch network
            </Link>
            <Link href="/partners/new" className="btn-primary btn-sm">
              Create partner
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
          Loading shops…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {atCapacityCount > 0 ? (
              <Link href="/dispatch" className="badge-warning px-3 py-1 text-xs font-semibold">
                {atCapacityCount} at capacity
              </Link>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell label="Branches" value={branches.length} href="/branches" />
            <MetricCell
              label="At capacity"
              value={atCapacityCount}
              href="/dispatch"
              highlight={atCapacityCount > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Partner accounts"
              value={shops.length}
              sub={`${activePartners} active`}
              highlight={activePartners > 0 ? 'accent' : undefined}
            />
            <MetricCell
              label="Partner revenue"
              value={formatPesoWhole(totalPartnerRevenue)}
              sub="lifetime total"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-md border border-border/80 bg-surface px-3 py-1.5 dc-chip transition-colors hover:border-primary/40 hover:text-primary"
              >
                {a.label}
              </Link>
            ))}
          </div>

          {atCapacityCount > 0 ? (
            <section className="dc-panel" id="capacity-attention">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Capacity attention</h2>
                  <p className="text-xs text-muted">
                    {atCapacityCount} branch{atCapacityCount === 1 ? '' : 'es'} cannot accept new
                    orders
                  </p>
                </div>
                <Link href="/dispatch" className="link-primary text-xs font-medium">
                  Dispatch board →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[640px]">
                  <caption className="sr-only">Branches at order capacity</caption>
                  <thead>
                    <tr>
                      <th scope="col">Branch</th>
                      <th scope="col">Location</th>
                      <th scope="col">Load</th>
                      <th scope="col">
                        <span className="sr-only">Network</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {atCapacityBranches.slice(0, 12).map((b) => (
                      <tr key={b._id} className="bg-amber-50/50">
                        <td>
                          <span className="font-medium text-slate-900">{b.name}</span>
                          <p className="text-code text-muted">{b.code}</p>
                        </td>
                        <td className="max-w-[14rem] truncate text-muted" title={`${b.line1}, ${b.city}`}>
                          {b.line1}, {b.city}
                        </td>
                        <td className="tabular-nums">
                          {b.activeOrders}/{b.maxActiveOrders}
                        </td>
                        <td>
                          <Link href="/branches" className="link-primary text-xs font-medium">
                            Network →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <ListControls
            search={partnerSearch}
            onSearchChange={setPartnerSearch}
            searchPlaceholder="Partner email, phone, ID…"
            limit={partnerLimit}
            onLimitChange={setPartnerLimit}
            total={shops.length}
            filtered={filteredShops.length}
          />

          <section className="dc-panel" id="partner-roster">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Partner accounts</h2>
                <p className="text-xs text-muted">
                  Showing {filteredShops.length} of {shops.length} partner logins
                </p>
              </div>
              <Link href="/partners/new" className="link-primary text-xs font-medium">
                Create partner →
              </Link>
            </div>

            {filteredShops.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">
                  {partnerSearch ? 'No partners match search' : 'No partner accounts found'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {partnerSearch ? 'Try a different search.' : 'Invite a partner below to get started.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[720px]">
                  <caption className="sr-only">Partner shop accounts</caption>
                  <thead>
                    <tr>
                      <th scope="col">Partner</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">
                        Orders
                      </th>
                      <th scope="col" className="text-right">
                        Revenue
                      </th>
                      <th scope="col" className="text-right">
                        Staff
                      </th>
                      <th scope="col">
                        <span className="sr-only">Branch</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShops.map((s) => (
                      <tr key={s._id}>
                        <td className="max-w-[12rem] truncate font-medium" title={s.email ?? s._id}>
                          {s.email ?? s._id}
                        </td>
                        <td className="text-muted">{s.phone ?? '—'}</td>
                        <td>
                          <span className={s.isActive ? 'badge-accent' : 'badge-neutral'}>
                            {s.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right tabular-nums">{s.totalOrders}</td>
                        <td className="text-right tabular-nums">{formatPesoWhole(s.revenue)}</td>
                        <td className="text-right tabular-nums">{s.staffCount}</td>
                        <td>
                          <Link
                            href={`/branches?partner=${s._id}`}
                            className="link-primary text-xs font-medium"
                          >
                            Add branch →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <ListControls
            search={branchSearch}
            onSearchChange={setBranchSearch}
            searchPlaceholder="Branch code, name, city…"
            limit={branchLimit}
            onLimitChange={setBranchLimit}
            total={branches.length}
            filtered={filteredBranches.length}
          />

          <section className="dc-panel" id="branch-capacity">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Laundry branches</h2>
                <p className="text-xs text-muted">
                  Showing {filteredBranches.length} of {branches.length} branches · active order
                  load
                </p>
              </div>
              <Link href="/branches" className="link-primary text-xs font-medium">
                Full network →
              </Link>
            </div>

            {filteredBranches.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">
                  {branchSearch ? 'No branches match search' : 'No branches yet'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {branchSearch
                    ? 'Try a different search.'
                    : 'Create a branch in Branch network after inviting a partner.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[720px]">
                  <caption className="sr-only">Laundry branch capacity</caption>
                  <thead>
                    <tr>
                      <th scope="col">Branch</th>
                      <th scope="col">Location</th>
                      <th scope="col">Load</th>
                      <th scope="col">Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.map((b) => (
                      <tr key={b._id} className={!b.capacityAvailable ? 'bg-amber-50/50' : ''}>
                        <td>
                          <Link href="/branches" className="link-primary font-medium">
                            {b.name}
                          </Link>
                          <p className="text-code text-muted">{b.code}</p>
                        </td>
                        <td className="max-w-[14rem] truncate text-muted" title={`${b.line1}, ${b.city}`}>
                          {b.line1}, {b.city}
                        </td>
                        <td className="tabular-nums">
                          {b.activeOrders}/{b.maxActiveOrders}
                        </td>
                        <td>
                          {b.capacityAvailable ? (
                            <span className="badge-accent">Available</span>
                          ) : (
                            <span className="badge-warning">At capacity</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dc-panel" id="partner-create">
            <div className="dc-panel-body flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Add a new partner</p>
                <p className="mt-0.5 text-xs text-muted">Creates a portal login account and branch in one step.</p>
              </div>
              <Link href="/partners/new" className="btn-primary btn-sm shrink-0">
                Create partner →
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
