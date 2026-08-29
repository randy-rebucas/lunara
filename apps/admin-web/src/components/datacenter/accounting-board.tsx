'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso, formatPesoWhole } from '../../lib/format-peso';
import { formatSlugLabel } from '../../lib/format-label';
import { useAdminQuery } from '../../lib/use-admin-query';
import { CompareLineChart, DonutChart, type DonutSegment } from './dash-charts';

interface ReconciliationPnl {
  pnl: {
    platformRevenue: number;
    riderCost: number;
    riderWageCost: number;
    refundCost: number;
    netMargin: number;
  };
  cashFlow: { cashIn: number; cashOut: number; net: number };
}

interface MonthlyPoint {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}

interface JournalEntry {
  id: string;
  date: string;
  transactionRef: string;
  sourceType: string;
  accountType: string;
  description: string;
  direction: 'debit' | 'credit';
  amount: number;
}

interface AccountingOverview {
  trend: MonthlyPoint[];
  cashFlow: { cashIn: number; cashOut: number; net: number };
  recentEntries: JournalEntry[];
}

const SOURCE_LABELS: Record<string, string> = {
  settlement: 'Payout',
  settlement_clawback: 'Adjustment',
  remittance: 'Remittance',
  withdrawal: 'Payout',
  rider_earning: 'Expense',
  payment: 'Payment',
  refund: 'Refund',
  wallet_topup: 'Payment',
};

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Stat tiles ─────────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
}) {
  return (
    <div className={`rounded-lg p-4 ring-1 ${TILE_TONES[tone]}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </div>
  );
}

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

function TrialBalancePanel({
  data,
  loading,
  error,
  reload,
  riders,
}: {
  data: LedgerRow[] | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  riders: RiderSummary[] | null;
}) {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Net balance per account from every settlement, payment, remittance, withdrawal, and refund
          posted to the double-entry ledger.
        </p>
        <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
          {loading ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {error && <div className="alert-error" role="alert">{error}</div>}

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

          {/* ── Platform-level stat tiles ──────────────────────── */}
          {platformGroups.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {platformGroups.map((g) => (
                <StatTile
                  key={g.accountType}
                  label={ACCOUNT_LABELS[g.accountType] ?? g.accountType}
                  value={fp(g.total)}
                  tone={
                    g.accountType === 'platform_revenue' || g.accountType === 'platform_cash'
                      ? 'accent'
                      : g.accountType === 'order_revenue_clearing' && Math.abs(g.total) >= 1
                        ? 'amber'
                        : 'secondary'
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

type AccountingTab = 'overview' | 'trial_balance';

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function AccountingBoard() {
  const [tab, setTab] = useState<AccountingTab>('overview');

  const loadRecon = useCallback(() => adminFetch<ReconciliationPnl>('/admin/ledger/reconciliation'), []);
  const { data: recon, loading: reconLoading, error: reconError, reload: reloadRecon } = useAdminQuery(
    loadRecon,
    [],
  );

  const loadOverview = useCallback(
    () => adminFetch<AccountingOverview>('/admin/ledger/accounting-overview'),
    [],
  );
  const { data: overview, loading: overviewLoading, error: overviewError, reload: reloadOverview } =
    useAdminQuery(loadOverview, []);

  const loadTrialBalance = useCallback(() => adminFetch<LedgerRow[]>('/admin/ledger/trial-balance'), []);
  const {
    data: trialBalance,
    loading: trialBalanceLoading,
    error: trialBalanceError,
    reload: reloadTrialBalance,
  } = useAdminQuery(loadTrialBalance, []);

  const loadRiders = useCallback(() => adminFetch<RiderSummary[]>('/admin/riders'), []);
  const { data: riders } = useAdminQuery(loadRiders, []);

  const topAccounts = useMemo(() => {
    return [...(trialBalance ?? [])]
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 8);
  }, [trialBalance]);

  const chartSeries = useMemo(() => {
    const trend = overview?.trend ?? [];
    return {
      labels: trend.map((t) => monthLabel(t.month)),
      series: [
        { label: 'Revenue', color: '#10b981', values: trend.map((t) => t.revenue) },
        { label: 'Expenses', color: '#ef4444', values: trend.map((t) => t.expenses) },
        { label: 'Net Profit', color: '#6366f1', values: trend.map((t) => t.netProfit) },
      ],
    };
  }, [overview]);

  const cashFlowChartSeries = useMemo(() => {
    const trend = overview?.trend ?? [];
    return {
      labels: trend.map((t) => monthLabel(t.month)),
      series: [
        { label: 'Cash in', color: '#10b981', values: trend.map((t) => t.cashIn) },
        { label: 'Cash out', color: '#ef4444', values: trend.map((t) => t.cashOut) },
        { label: 'Net cash flow', color: '#6366f1', values: trend.map((t) => t.netCashFlow) },
      ],
    };
  }, [overview]);

  const cashFlow = overview?.cashFlow;
  const donutSegments: DonutSegment[] = cashFlow
    ? [
        { key: 'in', label: 'Cash in', count: Math.round(cashFlow.cashIn), color: '#10b981' },
        { key: 'out', label: 'Cash out', count: Math.round(cashFlow.cashOut), color: '#f43f5e' },
      ]
    : [];

  function refresh() {
    void reloadRecon();
    void reloadOverview();
    void reloadTrialBalance();
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Accounting
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Revenue, expenses, and cash flow derived from the double-entry ledger — every payment,
              settlement, withdrawal, and refund posted on the platform.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={refresh}
              disabled={reconLoading || overviewLoading}
            >
              {reconLoading || overviewLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link href="/reconciliation" className="btn-outline btn-sm">Reconciliation</Link>
            <Link href="/revenue" className="btn-outline btn-sm">Revenue</Link>
          </div>
        </div>
      </header>

      {reconError && <div className="alert-error mb-4" role="alert">{reconError}</div>}
      {overviewError && <div className="alert-error mb-4" role="alert">{overviewError}</div>}

      {/* ── Stat tiles ───────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total revenue" value={formatPesoWhole(recon?.pnl.platformRevenue ?? 0)} sub="all time" tone="accent" />
        <StatTile
          label="Total expenses"
          value={formatPesoWhole(
            (recon?.pnl.riderCost ?? 0) + (recon?.pnl.riderWageCost ?? 0) + (recon?.pnl.refundCost ?? 0),
          )}
          sub="rider + refund costs"
          tone="rose"
        />
        <StatTile
          label="Net profit"
          value={formatPesoWhole(recon?.pnl.netMargin ?? 0)}
          sub="all time"
          tone={recon && recon.pnl.netMargin >= 0 ? 'accent' : 'rose'}
        />
        <StatTile label="Cash in" value={formatPesoWhole(cashFlow?.cashIn ?? 0)} sub="this month" tone="primary" />
        <StatTile label="Cash out" value={formatPesoWhole(cashFlow?.cashOut ?? 0)} sub="this month" tone="amber" />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="dc-panel mb-4">
        <div className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3" role="tablist" aria-label="Accounting view">
          <div className="flex min-w-max gap-1">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'trial_balance', label: 'Trial Balance' },
              ] as { id: AccountingTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dc-panel-body">
          {tab === 'trial_balance' ? (
            <TrialBalancePanel
              data={trialBalance}
              loading={trialBalanceLoading}
              error={trialBalanceError}
              reload={reloadTrialBalance}
              riders={riders}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <section className="dc-panel lg:col-span-2">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">P&amp;L summary</h2>
                    <p className="text-xs text-muted">Revenue, expenses, and net profit — last {overview?.trend.length ?? 6} months</p>
                  </div>
                  <div className="dc-panel-body">
                    {overviewLoading && !overview ? (
                      <p className="py-8 text-center text-sm text-muted">Loading trend…</p>
                    ) : (
                      <>
                        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {chartSeries.series.map((s) => (
                            <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-muted">
                              <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                              {s.label}
                            </span>
                          ))}
                        </div>
                        <CompareLineChart
                          labels={chartSeries.labels}
                          series={chartSeries.series}
                          formatValue={(n) => formatPeso(n, true)}
                          labelEvery={1}
                          ariaLabel="Revenue, expenses, and net profit by month"
                        />
                      </>
                    )}
                  </div>
                </section>

                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Cash flow summary</h2>
                    <p className="text-xs text-muted">This month</p>
                  </div>
                  <div className="dc-panel-body">
                    {donutSegments.some((s) => s.count > 0) ? (
                      <>
                        <DonutChart
                          segments={donutSegments}
                          centerLabel="Net cash flow"
                          centerValue={formatPeso(cashFlow?.net ?? 0, true)}
                        />
                        <div className="mt-4 space-y-2">
                          {donutSegments.map((s) => (
                            <div key={s.key} className="flex items-center justify-between gap-2 text-sm">
                              <span className="flex items-center gap-2 text-slate-700">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.label}
                              </span>
                              <span className="font-medium tabular-nums text-slate-900">{formatPesoWhole(s.count)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted">No cash movement this month.</p>
                    )}
                    {recon?.cashFlow && (
                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted">
                        <span>All time</span>
                        <span className="font-medium tabular-nums text-slate-700">
                          {formatPesoWhole(recon.cashFlow.cashIn)} in · {formatPesoWhole(recon.cashFlow.cashOut)} out · net {fp(recon.cashFlow.net)}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="dc-panel">
                <div className="dc-panel-header">
                  <h2 className="text-sm font-semibold text-slate-900">Cash flow trend</h2>
                  <p className="text-xs text-muted">Cash in, cash out, and net cash flow — last {overview?.trend.length ?? 6} months</p>
                </div>
                <div className="dc-panel-body">
                  {overviewLoading && !overview ? (
                    <p className="py-8 text-center text-sm text-muted">Loading trend…</p>
                  ) : (
                    <>
                      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        {cashFlowChartSeries.series.map((s) => (
                          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-muted">
                            <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                            {s.label}
                          </span>
                        ))}
                      </div>
                      <CompareLineChart
                        labels={cashFlowChartSeries.labels}
                        series={cashFlowChartSeries.series}
                        formatValue={(n) => formatPeso(n, true)}
                        labelEvery={1}
                        ariaLabel="Cash in, cash out, and net cash flow by month"
                      />
                    </>
                  )}
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
                <section className="dc-panel min-w-0 xl:col-span-8">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Recent journal entries</h2>
                      <p className="text-xs text-muted">Most recent posted ledger entries</p>
                    </div>
                    <button type="button" className="link-primary text-xs font-medium" onClick={() => setTab('trial_balance')}>
                      View all →
                    </button>
                  </div>
                  {overviewLoading && !overview ? (
                    <p className="px-5 py-8 text-center text-sm text-muted">Loading entries…</p>
                  ) : !overview || overview.recentEntries.length === 0 ? (
                    <div className="dc-panel-empty">
                      <p className="font-medium text-slate-900">No journal entries yet</p>
                      <p className="mt-1 text-sm text-muted">
                        Entries post automatically as payments, settlements, withdrawals, and refunds happen.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table min-w-[680px]">
                        <caption className="sr-only">Recent journal entries</caption>
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Type</th>
                            <th scope="col">Reference</th>
                            <th scope="col">Description</th>
                            <th scope="col">Account</th>
                            <th scope="col" className="text-right">Debit (₱)</th>
                            <th scope="col" className="text-right">Credit (₱)</th>
                            <th scope="col">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.recentEntries.map((e) => (
                            <tr key={e.id}>
                              <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(e.date)}</td>
                              <td>
                                <span className="badge-secondary">{SOURCE_LABELS[e.sourceType] ?? e.sourceType}</span>
                              </td>
                              <td className="text-code text-xs text-muted">{e.transactionRef}</td>
                              <td className="max-w-[14rem] truncate text-slate-700" title={e.description}>
                                {e.description}
                              </td>
                              <td className="text-muted">{ACCOUNT_LABELS[e.accountType] ?? e.accountType}</td>
                              <td className="text-right tabular-nums">
                                {e.direction === 'debit' ? formatPeso(e.amount) : '—'}
                              </td>
                              <td className="text-right tabular-nums">
                                {e.direction === 'credit' ? formatPeso(e.amount) : '—'}
                              </td>
                              <td><span className="badge-accent">Posted</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <div className="space-y-4 xl:col-span-4">
                  <section className="dc-panel">
                    <div className="dc-panel-header flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">Account balances</h2>
                      <button type="button" className="link-primary text-xs font-medium" onClick={() => setTab('trial_balance')}>
                        View all →
                      </button>
                    </div>
                    <div className="dc-panel-body space-y-2">
                      {topAccounts.length === 0 ? (
                        <p className="text-sm text-muted">No accounts posted yet.</p>
                      ) : (
                        topAccounts.map((a) => (
                          <RailRow
                            key={`${a.accountType}:${a.accountSubject}`}
                            label={ACCOUNT_LABELS[a.accountType] ?? a.accountType}
                            value={fp(a.balance)}
                          />
                        ))
                      )}
                    </div>
                    <div className="border-t border-border/60 px-5 py-4">
                      <button type="button" className="btn-outline btn-sm block w-full text-center" onClick={() => setTab('trial_balance')}>
                        View chart of accounts
                      </button>
                    </div>
                  </section>

                  <section className="dc-panel">
                    <div className="dc-panel-header">
                      <h2 className="text-sm font-semibold text-slate-900">Reports</h2>
                    </div>
                    <div className="dc-panel-body space-y-1">
                      <Link href="/reconciliation" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                        <span>
                          <span className="block font-medium text-slate-900">Reconciliation</span>
                          <span className="block text-xs text-muted">Ledger vs source records</span>
                        </span>
                        <span className="text-muted">›</span>
                      </Link>
                      <Link href="/reports" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                        <span>
                          <span className="block font-medium text-slate-900">Financial reports</span>
                          <span className="block text-xs text-muted">Revenue, payouts, refunds</span>
                        </span>
                        <span className="text-muted">›</span>
                      </Link>
                      <Link href="/revenue" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                        <span>
                          <span className="block font-medium text-slate-900">Revenue</span>
                          <span className="block text-xs text-muted">Order revenue breakdown</span>
                        </span>
                        <span className="text-muted">›</span>
                      </Link>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
