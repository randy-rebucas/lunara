'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatPesoWhole } from '../../lib/format-peso';
import { formatSlugLabel } from '../../lib/format-label';
import { useAdminQuery } from '../../lib/use-admin-query';

interface RiderSummary {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  vehicleType?: string;
  isOnline?: boolean;
  verificationStatus?: string;
}

interface LedgerRow {
  accountType: string;
  accountSubject: string;
  balance: number;
}

const ACCOUNT_LABELS: Record<string, string> = {
  order_revenue_clearing:      'Order revenue clearing',
  platform_revenue:            'Platform revenue',
  partner_payable:             'Partner payable',
  rider_payable:               'Rider payable',
  rider_remittance_receivable: 'Rider remittance receivable',
  cash_out:                    'Cash paid out',
  platform_cash:               'Platform cash received',
  rider_payout_expense:        'Rider payout expense',
  customer_wallet_liability:   'Customer wallet liability',
  refund_expense:              'Refund / compensation expense',
};

const ACCOUNT_HELP: Record<string, string> = {
  order_revenue_clearing:
    'Revenue recognized from orders not yet settled. Should trend toward zero.',
  platform_revenue:
    'Lunara commission earned across all settled orders.',
  platform_cash:
    'Total cash received — PayMongo payments, wallet topups, and verified rider remittances.',
  cash_out:
    'Cash disbursed to partners (settlements) and riders (withdrawals).',
  partner_payable:
    'What Lunara owes each partner from unsettled orders.',
  rider_payable:
    'What Lunara owes each rider for earned but unwithdrawn balance.',
  rider_remittance_receivable:
    'Cash riders are holding pending admin verification.',
  customer_wallet_liability:
    'Total wallet balances owed back to customers.',
  rider_payout_expense:
    'Rider task fees expensed (pickup + delivery per completed task).',
  refund_expense:
    'Goodwill payouts and order refund costs.',
};

// Accounts that are platform-level (no subject breakdown) — shown as metric cards
const PLATFORM_ACCOUNTS = new Set([
  'platform_revenue',
  'platform_cash',
  'cash_out',
  'rider_payout_expense',
  'refund_expense',
  'order_revenue_clearing',
]);

// Accounts with many per-entity rows — shown full-width
const WIDE_ACCOUNTS = new Set([
  'rider_payable',
  'customer_wallet_liability',
  'rider_remittance_receivable',
]);

const ACCOUNT_ORDER = [
  'platform_revenue',
  'platform_cash',
  'cash_out',
  'order_revenue_clearing',
  'rider_payout_expense',
  'refund_expense',
  'rider_payable',
  'partner_payable',
  'rider_remittance_receivable',
  'customer_wallet_liability',
];

function fp(amount: number) {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${formatPesoWhole(Math.abs(amount))}`;
}

function balanceColor(accountType: string, balance: number) {
  if (accountType === 'platform_revenue' || accountType === 'platform_cash') return 'text-emerald-700';
  if (accountType === 'cash_out' || accountType === 'rider_payout_expense' || accountType === 'refund_expense') return 'text-rose-600';
  if (balance < 0) return 'text-rose-600';
  if (balance > 0 && (accountType === 'rider_remittance_receivable')) return 'text-amber-600';
  return 'text-slate-900';
}

interface AccountGroup {
  accountType: string;
  items: LedgerRow[];
  total: number;
}

const RIDER_SUBJECT_ACCOUNTS = new Set(['rider_payable', 'rider_remittance_receivable', 'rider_payout_expense']);
const USER_SUBJECT_ACCOUNTS  = new Set(['customer_wallet_liability']);

function RiderCell({ userId, riderMap }: { userId: string; riderMap: Map<string, RiderSummary> }) {
  const r = riderMap.get(userId);
  if (!r) return <span className="text-code text-muted">{userId.slice(-8).toUpperCase()}</span>;
  const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || r.email || userId.slice(-8).toUpperCase();
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <Link href={`/riders/${userId}`} className="block truncate text-sm font-medium text-slate-900 hover:text-primary hover:underline">
          {name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {r.phone && <span>{r.phone}</span>}
          {r.vehicleType && <span className="capitalize">{formatSlugLabel(r.vehicleType)}</span>}
          {r.isOnline !== undefined && (
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${r.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {r.isOnline ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountPanel({ group, maxRows = 10, riderMap }: { group: AccountGroup; maxRows?: number; riderMap: Map<string, RiderSummary> }) {
  const visible = group.items.slice(0, maxRows);
  const hidden = group.items.length - visible.length;
  const isRiderAccount = RIDER_SUBJECT_ACCOUNTS.has(group.accountType);
  const isUserAccount  = USER_SUBJECT_ACCOUNTS.has(group.accountType);

  return (
    <section className="dc-panel">
      <div className="dc-panel-header flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            {ACCOUNT_LABELS[group.accountType] ?? group.accountType}
          </h2>
          {ACCOUNT_HELP[group.accountType] && (
            <p className="mt-0.5 text-xs text-muted">{ACCOUNT_HELP[group.accountType]}</p>
          )}
        </div>
        <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${balanceColor(group.accountType, group.total)}`}>
          {fp(group.total)}
        </span>
      </div>

      {group.items.length === 0 ? (
        <p className="dc-panel-body text-sm text-muted">No entries.</p>
      ) : group.items.length === 1 && !group.items[0].accountSubject ? (
        <div className="dc-panel-body">
          <p className={`text-2xl font-bold tabular-nums ${balanceColor(group.accountType, group.total)}`}>
            {fp(group.total)}
          </p>
          <p className="mt-0.5 text-xs text-muted">Platform-level — no subject breakdown</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{isRiderAccount ? 'Rider' : isUserAccount ? 'User' : 'Subject'}</th>
                {isRiderAccount && <th scope="col">KYC</th>}
                <th scope="col" className="text-right">Balance</th>
                {isRiderAccount && <th scope="col"><span className="sr-only">Profile</span></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.accountType}:${row.accountSubject}`}>
                  <td>
                    {isRiderAccount
                      ? <RiderCell userId={row.accountSubject} riderMap={riderMap} />
                      : <span className="text-code text-muted">{row.accountSubject || '—'}</span>
                    }
                  </td>
                  {isRiderAccount && (
                    <td>
                      {(() => {
                        const r = riderMap.get(row.accountSubject);
                        if (!r?.verificationStatus) return <span className="text-muted">—</span>;
                        const cls = r.verificationStatus === 'verified' ? 'badge-accent' : r.verificationStatus === 'pending_review' ? 'badge-primary' : 'badge-neutral';
                        return <span className={cls}>{formatSlugLabel(r.verificationStatus)}</span>;
                      })()}
                    </td>
                  )}
                  <td className={`text-right tabular-nums ${balanceColor(row.accountType, row.balance)}`}>
                    {fp(row.balance)}
                  </td>
                  {isRiderAccount && (
                    <td>
                      <Link href={`/riders/${row.accountSubject}`} className="link-primary text-xs font-medium">
                        Profile →
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {group.items.length > 1 && (
              <tfoot>
                <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
                  <td className="text-slate-700" colSpan={isRiderAccount ? 2 : 1}>Total</td>
                  <td className={`text-right tabular-nums ${balanceColor(group.accountType, group.total)}`}>
                    {fp(group.total)}
                  </td>
                  {isRiderAccount && <td />}
                </tr>
              </tfoot>
            )}
          </table>
          {hidden > 0 && (
            <p className="px-3 py-2 text-xs text-muted">{hidden} more row{hidden !== 1 ? 's' : ''} not shown.</p>
          )}
        </div>
      )}
    </section>
  );
}

export function AccountingBoard() {
  const load = useCallback(() => adminFetch<LedgerRow[]>('/admin/ledger/trial-balance'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  const loadRiders = useCallback(() => adminFetch<RiderSummary[]>('/admin/riders'), []);
  const { data: riders } = useAdminQuery(loadRiders, []);

  const riderMap = useMemo(() => {
    const map = new Map<string, RiderSummary>();
    for (const r of riders ?? []) map.set(r.userId, r);
    return map;
  }, [riders]);

  const grouped = useMemo<AccountGroup[]>(() => {
    const rows = data ?? [];
    const map = new Map<string, LedgerRow[]>();
    for (const row of rows) {
      const list = map.get(row.accountType) ?? [];
      list.push(row);
      map.set(row.accountType, list);
    }
    const result: AccountGroup[] = [];
    // Render in defined order first, then any unknown accounts
    const seen = new Set<string>();
    for (const type of ACCOUNT_ORDER) {
      const items = map.get(type);
      if (items) {
        result.push({ accountType: type, items: items.sort((a, b) => b.balance - a.balance), total: items.reduce((s, r) => s + r.balance, 0) });
        seen.add(type);
      }
    }
    for (const [accountType, items] of map.entries()) {
      if (!seen.has(accountType)) {
        result.push({ accountType, items: items.sort((a, b) => b.balance - a.balance), total: items.reduce((s, r) => s + r.balance, 0) });
      }
    }
    return result;
  }, [data]);

  const get = (type: string) => grouped.find((g) => g.accountType === type)?.total ?? 0;
  const clearingDrift = get('order_revenue_clearing');
  const platformGroups = grouped.filter((g) => PLATFORM_ACCOUNTS.has(g.accountType));
  const wideGroups = grouped.filter((g) => WIDE_ACCOUNTS.has(g.accountType));
  const narrowGroups = grouped.filter((g) => !PLATFORM_ACCOUNTS.has(g.accountType) && !WIDE_ACCOUNTS.has(g.accountType));

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Trial Balance
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Net balance per account from every settlement, payment, remittance, withdrawal, and refund
              posted to the double-entry ledger.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/reconciliation" className="btn-outline btn-sm">Reconciliation</Link>
            <Link href="/revenue" className="btn-outline btn-sm">Revenue</Link>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}

      {loading && !data && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Loading ledger…
        </div>
      )}

      {data && (
        <div className="space-y-4">

          {/* ── Clearing banner ──────────────────────────────────── */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${Math.abs(clearingDrift) < 1 ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-amber-500/35 bg-amber-950/5'}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${Math.abs(clearingDrift) < 1 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Order revenue clearing: {fp(clearingDrift)}
              </p>
              <p className="text-xs text-muted">
                {Math.abs(clearingDrift) < 1
                  ? 'Clearing account balanced — all recognized revenue is fully settled or refunded.'
                  : 'Unsettled balance — orders paid but not yet settled, or refunds outpacing settlement.'}
              </p>
            </div>
            <Link href="/reconciliation" className="link-primary text-xs font-medium">Full reconciliation →</Link>
          </div>

          {/* ── Platform-level metric cards ──────────────────────── */}
          {platformGroups.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {platformGroups.map((g) => (
                <MetricCell
                  key={g.accountType}
                  label={ACCOUNT_LABELS[g.accountType] ?? g.accountType}
                  value={fp(g.total)}
                  highlight={
                    g.accountType === 'platform_revenue' || g.accountType === 'platform_cash'
                      ? 'accent'
                      : g.accountType === 'order_revenue_clearing' && Math.abs(g.total) >= 1
                      ? 'warning'
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {grouped.length === 0 ? (
            <div className="dc-panel-empty">
              <p className="font-medium text-slate-900">No ledger entries yet</p>
              <p className="mt-1 text-sm text-muted">
                Entries are posted automatically as payments, settlements, remittances, withdrawals, and refunds happen.
              </p>
            </div>
          ) : (
            <>
              {/* Narrow panels — 2-col grid */}
              {narrowGroups.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {narrowGroups.map((g) => (
                    <AccountPanel key={g.accountType} group={g} riderMap={riderMap} />
                  ))}
                </div>
              )}

              {/* Wide panels — full width */}
              {wideGroups.map((g) => (
                <AccountPanel key={g.accountType} group={g} maxRows={25} riderMap={riderMap} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
