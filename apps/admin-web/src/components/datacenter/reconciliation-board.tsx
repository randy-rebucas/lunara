'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { DonutChart, type DonutSegment } from './dash-charts';
import { DetailRow, OpsPanel } from '../ui/ops-panel';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso, formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';
import { TILE_TONES } from './tile-tones';

interface ReconciliationData {
  pnl: {
    platformRevenue: number;
    riderCost: number;
    riderWageCost: number;
    refundCost: number;
    netMargin: number;
  };
  cashFlow: {
    cashIn: number;
    cashOut: number;
    net: number;
  };
  // Legacy Lunara-pays-partner records — historical only, no new settlements are created.
  settlements: {
    count: number;
    paidCount: number;
    pendingCount: number;
    totalRevenue: number;
    totalLunaraFee: number;
    totalPartnerPayout: number;
  };
  invoices: {
    count: number;
    paidCount: number;
    pendingCount: number;
    totalCollected: number;
    totalCommissionAndRiderCost: number;
    totalAmountDue: number;
    partnerReceivableBalance: number;
  };
  riderWithdrawals: {
    paidCount: number;
    totalPaid: number;
    pendingCount: number;
    pendingTotal: number;
    riderPayableBalance: number;
    riderRemittanceReceivable: number;
  };
  wallets: {
    count: number;
    ledgerLiability: number;
    actualBalance: number;
    drift: number;
  };
  spotChecks: {
    clearingDrift: number;
    commissionDrift: number;
    cashOutDrift: number;
    walletDrift: number;
  };
}

interface ReconTxn {
  id: string;
  date: string;
  type: 'payment' | 'payout' | 'fee' | 'refund';
  typeLabel: string;
  reference: string;
  source: string;
  amount: number;
  matched: boolean;
  matchedWith: string | null;
  difference: number;
}

interface TransactionsData {
  items: ReconTxn[];
  summary: {
    total: number;
    totalAmount: number;
    matchedCount: number;
    matchedAmount: number;
    unmatchedCount: number;
    unmatchedAmount: number;
    difference: number;
  };
  breakdown: { payment: number; payout: number; refund: number };
}

type MainTab = 'overview' | 'unmatched' | 'matched' | 'summary';

function peso(n: number) {
  const sign = n < 0 ? '−' : '';
  return `${sign}₱${Math.abs(Math.round(n)).toLocaleString()}`;
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

// ── Stat tiles ─────────────────────────────────────────────────────────────

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
  const cls = `rounded-lg p-4 text-left ring-1 transition-all ${TILE_TONES[tone]} ${
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

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

const TYPE_TONE: Record<ReconTxn['type'], string> = {
  payment: 'bg-emerald-500/10 text-emerald-700',
  payout: 'bg-amber-500/10 text-amber-700',
  fee: 'bg-primary/10 text-primary',
  refund: 'bg-rose-500/10 text-rose-700',
};

export function ReconciliationBoard() {
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(200);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => adminFetch<ReconciliationData>('/admin/ledger/reconciliation'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  const loadTxns = useCallback(
    () => adminFetch<TransactionsData>('/admin/ledger/reconciliation/transactions?limit=300'),
    [],
  );
  const { data: txnData, loading: txnLoading, error: txnError, reload: reloadTxns } = useAdminQuery(
    loadTxns,
    [],
  );

  const allChecksPassed = data ? Object.values(data.spotChecks).every((v) => Math.abs(v) < 2) : null;
  const items = useMemo(() => txnData?.items ?? [], [txnData?.items]);

  const tabFiltered = useMemo(() => {
    if (mainTab === 'unmatched') return items.filter((i) => !i.matched);
    if (mainTab === 'matched') return items.filter((i) => i.matched);
    return items;
  }, [items, mainTab]);

  const filteredItems = useMemo(
    () =>
      filterBySearch(tabFiltered, search, [
        (i) => i.reference,
        (i) => i.typeLabel,
        (i) => i.source,
        (i) => (i.matchedWith ?? ''),
      ]).slice(0, limit),
    [tabFiltered, search, limit],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ReconTxn[]>();
    for (const item of filteredItems) {
      const key = dayKey(item.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filteredItems]);

  const selected = useMemo(
    () => (selectedId ? (items.find((i) => i.id === selectedId) ?? null) : null),
    [items, selectedId],
  );

  const matchRate =
    txnData && txnData.summary.total > 0
      ? Math.round((txnData.summary.matchedCount / txnData.summary.total) * 1000) / 10
      : null;

  const donutSegments: DonutSegment[] = txnData
    ? [
        { key: 'payment', label: 'Payments', count: Math.round(txnData.breakdown.payment), color: '#10b981' },
        { key: 'payout', label: 'Payouts', count: Math.round(txnData.breakdown.payout), color: '#f59e0b' },
        { key: 'refund', label: 'Refunds', count: Math.round(txnData.breakdown.refund), color: '#f43f5e' },
      ]
    : [];
  const donutTotal = donutSegments.reduce((s, seg) => s + seg.count, 0);

  function refresh() {
    void reload();
    void reloadTxns();
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Reconciliation
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Reconcile payments, payouts, and refunds against the ledger to keep records accurate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={refresh}
              disabled={loading || txnLoading}
            >
              {loading || txnLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link href="/accounting" className="btn-outline btn-sm">Trial balance</Link>
            <Link href="/revenue" className="btn-outline btn-sm">Revenue</Link>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}
      {txnError && <div className="alert-error mb-4" role="alert">{txnError}</div>}

      {loading && !data && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Running reconciliation…
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* ── Health banner ────────────────────────────────────── */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${allChecksPassed ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-red-400/40 bg-red-950/5'}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${allChecksPassed ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${allChecksPassed ? 'text-slate-900' : 'text-red-700'}`}>
                {allChecksPassed ? 'All checks passed — ledger is balanced' : 'Reconciliation issues detected — review spot checks below'}
              </p>
              <p className="text-xs text-muted">Ledger vs database cross-check across invoices, cash flow, and wallets</p>
            </div>
            {!allChecksPassed && <span className="badge-danger px-3 py-1 text-xs font-semibold">Drift detected</span>}
          </div>

          {/* ── Transaction stat tiles ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Total transactions"
              value={(txnData?.summary.total ?? 0).toLocaleString()}
              sub="most recent 300"
              tone="primary"
              onClick={() => setMainTab('overview')}
              active={mainTab === 'overview'}
            />
            <StatTile
              label="Total amount"
              value={formatPesoWhole(txnData?.summary.totalAmount ?? 0)}
              tone="secondary"
            />
            <StatTile
              label="Matched"
              value={(txnData?.summary.matchedCount ?? 0).toLocaleString()}
              sub={matchRate != null ? `${matchRate}%` : undefined}
              tone="accent"
              onClick={() => setMainTab('matched')}
              active={mainTab === 'matched'}
            />
            <StatTile
              label="Unmatched"
              value={(txnData?.summary.unmatchedCount ?? 0).toLocaleString()}
              sub={
                txnData && txnData.summary.total > 0
                  ? `${Math.round((txnData.summary.unmatchedCount / txnData.summary.total) * 1000) / 10}%`
                  : undefined
              }
              tone={txnData && txnData.summary.unmatchedCount > 0 ? 'amber' : 'secondary'}
              onClick={() => setMainTab('unmatched')}
              active={mainTab === 'unmatched'}
            />
            <StatTile
              label="Difference"
              value={formatPesoWhole(txnData?.summary.difference ?? 0)}
              sub="unmatched value"
              tone={txnData && txnData.summary.difference > 0 ? 'rose' : 'secondary'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Transaction ledger ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Reconciliation view"
              >
                <div className="flex min-w-max gap-1">
                  {(
                    [
                      { id: 'overview', label: 'Overview', count: items.length },
                      { id: 'unmatched', label: 'Unmatched items', count: items.filter((i) => !i.matched).length },
                      { id: 'matched', label: 'Matched items', count: items.filter((i) => i.matched).length },
                      { id: 'summary', label: 'Summary', count: null },
                    ] as { id: MainTab; label: string; count: number | null }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={mainTab === t.id}
                      onClick={() => {
                        setMainTab(t.id);
                        setSelectedId(null);
                      }}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        mainTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      {t.count != null ? (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                          {t.count.toLocaleString()}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              {mainTab === 'summary' ? (
                <div className="dc-panel-body space-y-4">
                  <OpsPanel title="Platform P&L" description="Commission earned minus rider and refund costs (all time)">
                    <dl>
                      <DetailRow label="Commission earned" value={<span className="text-emerald-700">{peso(data.pnl.platformRevenue)}</span>} />
                      <DetailRow label="Rider task costs" value={<span className="text-rose-600">−{peso(data.pnl.riderCost)}</span>} />
                      <DetailRow label="Rider wage costs" value={<span className="text-rose-600">−{peso(data.pnl.riderWageCost)}</span>} />
                      <DetailRow label="Refund & compensation" value={<span className="text-rose-600">−{peso(data.pnl.refundCost)}</span>} />
                    </dl>
                    <div className="mt-2 flex items-baseline justify-between border-t-2 border-slate-200 pt-2.5">
                      <p className="text-sm font-bold text-slate-900">Net platform margin</p>
                      <span className={`text-lg font-bold tabular-nums ${data.pnl.netMargin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {peso(data.pnl.netMargin)}
                      </span>
                    </div>
                  </OpsPanel>

                  <OpsPanel
                    title="Partner invoices"
                    description="All-time invoice records from DB — partners collect payment directly, Lunara bills them for commission + rider costs"
                    headerAction={<Link href="/partners/invoices" className="link-primary text-xs font-medium">View all →</Link>}
                  >
                    <dl>
                      <DetailRow
                        label="Total invoices"
                        value={`${data.invoices.count.toLocaleString()} (${data.invoices.paidCount} paid, ${data.invoices.pendingCount} pending)`}
                      />
                      <DetailRow label="Gross revenue collected by partners (info only)" value={peso(data.invoices.totalCollected)} />
                      <DetailRow
                        label="Commission + rider cost billed"
                        value={<span className="text-emerald-700">{peso(data.invoices.totalCommissionAndRiderCost)}</span>}
                      />
                      <DetailRow label="Total amount due (net of credits)" value={peso(data.invoices.totalAmountDue)} />
                      <DetailRow
                        label="Outstanding receivable"
                        value={
                          data.invoices.partnerReceivableBalance > 0
                            ? <span className="text-amber-600">{peso(data.invoices.partnerReceivableBalance)}</span>
                            : peso(data.invoices.partnerReceivableBalance)
                        }
                      />
                    </dl>
                  </OpsPanel>

                  <OpsPanel
                    title="Partner settlements (legacy)"
                    description="Historical Lunara-pays-partner payout records — no new settlements are created"
                  >
                    <dl>
                      <DetailRow
                        label="Total settlements"
                        value={`${data.settlements.count.toLocaleString()} (${data.settlements.paidCount} paid, ${data.settlements.pendingCount} pending)`}
                      />
                      <DetailRow label="Gross revenue settled" value={peso(data.settlements.totalRevenue)} />
                      <DetailRow
                        label="Lunara commission"
                        value={<span className="text-emerald-700">{peso(data.settlements.totalLunaraFee)}</span>}
                      />
                      <DetailRow label="Total paid to partners" value={peso(data.settlements.totalPartnerPayout)} />
                    </dl>
                  </OpsPanel>

                  <OpsPanel
                    title="Rider payouts"
                    description="Earnings, withdrawals, and cash remittances"
                  >
                    <dl>
                      <DetailRow
                        label="Withdrawals paid"
                        value={`${data.riderWithdrawals.paidCount.toLocaleString()} · ${peso(data.riderWithdrawals.totalPaid)}`}
                      />
                      <DetailRow
                        label="Withdrawals pending"
                        value={
                          data.riderWithdrawals.pendingCount > 0
                            ? <span className="text-amber-600">{data.riderWithdrawals.pendingCount} · {peso(data.riderWithdrawals.pendingTotal)}</span>
                            : 'None'
                        }
                      />
                      <DetailRow label="Rider payable (ledger)" value={peso(data.riderWithdrawals.riderPayableBalance)} />
                      <DetailRow
                        label="Cash remittance receivable"
                        value={
                          data.riderWithdrawals.riderRemittanceReceivable > 0
                            ? <span className="text-amber-600">{peso(data.riderWithdrawals.riderRemittanceReceivable)}</span>
                            : peso(data.riderWithdrawals.riderRemittanceReceivable)
                        }
                      />
                    </dl>
                  </OpsPanel>

                  <OpsPanel
                    title="Customer wallets"
                    description="Ledger customer_wallet_liability vs sum of actual Wallet.balance records — should always match."
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <StatTile label="Wallets on platform" value={data.wallets.count.toLocaleString()} tone="secondary" />
                      <StatTile
                        label="Ledger liability"
                        value={formatPesoWhole(data.wallets.ledgerLiability)}
                        sub="customer_wallet_liability net credit"
                        tone="primary"
                      />
                      <StatTile
                        label="Actual wallet sum"
                        value={formatPesoWhole(data.wallets.actualBalance)}
                        sub={Math.abs(data.wallets.drift) < 2 ? 'Matches ledger ✓' : `Drift: ${peso(data.wallets.drift)}`}
                        tone={Math.abs(data.wallets.drift) >= 2 ? 'rose' : 'accent'}
                      />
                    </div>
                    {Math.abs(data.wallets.drift) >= 2 && (
                      <div className="alert-error mt-3 text-sm">
                        <strong>Wallet drift: {peso(data.wallets.drift)}</strong> — ledger liability does not match actual balances.
                      </div>
                    )}
                  </OpsPanel>

                  <OpsPanel
                    title="Spot checks"
                    description="Drift = ledger account balance minus source-of-truth DB records. Should be ₱0."
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { value: data.spotChecks.clearingDrift, label: 'Order revenue clearing', sub: 'Uncleared orders still in transit' },
                        { value: data.spotChecks.commissionDrift, label: 'Commission', sub: 'Ledger platform_revenue vs settlement lunaraFee + invoice amountDue' },
                        { value: data.spotChecks.cashOutDrift, label: 'Cash out', sub: 'Ledger vs partner payouts + rider withdrawals paid' },
                        { value: data.spotChecks.walletDrift, label: 'Customer wallets', sub: 'Ledger liability vs actual Wallet.balance records' },
                      ].map((c) => {
                        const clean = Math.abs(c.value) < 2;
                        return (
                          <div
                            key={c.label}
                            className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${clean ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-red-400/40 bg-red-950/5'}`}
                          >
                            <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${clean ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold ${clean ? 'text-slate-900' : 'text-red-700'}`}>{c.label}</p>
                              <p className="text-xs text-muted">{c.sub}</p>
                              <p className={`mt-0.5 text-xs ${clean ? 'text-emerald-700' : 'text-red-600'}`}>
                                {clean ? 'Balanced' : `Drift: ${peso(c.value)} — investigate`}
                              </p>
                            </div>
                            <span className={`ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums ${clean ? 'text-emerald-700' : 'text-red-700'}`}>
                              {peso(c.value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </OpsPanel>
                </div>
              ) : (
                <>
                  <div className="px-4 pb-1 pt-3">
                    <ListControls
                      search={search}
                      onSearchChange={setSearch}
                      searchPlaceholder="Reference, type, source…"
                      limit={limit}
                      onLimitChange={setLimit}
                      total={tabFiltered.length}
                      filtered={filteredItems.length}
                    />
                  </div>

                  {txnLoading && !txnData ? (
                    <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
                      Loading transactions…
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="dc-panel-empty">
                      <p className="font-medium text-slate-900">
                        {search ? 'No transactions match' : mainTab === 'unmatched' ? 'No unmatched items' : 'No transactions yet'}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {search
                          ? 'Try another search term.'
                          : mainTab === 'unmatched'
                            ? 'Every recent transaction has a matching ledger entry.'
                            : 'Payments, payouts, and refunds will show up here once posted.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table min-w-[820px]">
                        <caption className="sr-only">Reconciliation transactions</caption>
                        <thead>
                          <tr>
                            <th scope="col">Reference</th>
                            <th scope="col">Type</th>
                            <th scope="col">Source</th>
                            <th scope="col" className="text-right">Amount</th>
                            <th scope="col">Status</th>
                            <th scope="col" className="text-right">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grouped.map(([day, dayItems]) => (
                            <FragmentGroup key={day} dayItems={dayItems}>
                              {dayItems.map((item) => {
                                const isSelected = selectedId === item.id;
                                return (
                                  <tr
                                    key={item.id}
                                    onClick={() => setSelectedId((prev) => (prev === item.id ? null : item.id))}
                                    aria-selected={isSelected}
                                    className={`cursor-pointer ${
                                      isSelected ? 'bg-primary/5 hover:bg-primary/5' : !item.matched ? 'bg-amber-50/40' : ''
                                    }`}
                                  >
                                    <td>
                                      <span className="text-code font-medium text-slate-900">{item.reference}</span>
                                    </td>
                                    <td>
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_TONE[item.type]}`}>
                                        {item.typeLabel}
                                      </span>
                                    </td>
                                    <td className="capitalize text-muted">{item.source}</td>
                                    <td
                                      className={`text-right font-medium tabular-nums ${item.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}
                                    >
                                      {item.amount < 0 ? '−' : ''}
                                      {formatPeso(Math.abs(item.amount))}
                                    </td>
                                    <td>
                                      {item.matched ? (
                                        <span className="badge-accent">Matched ✓</span>
                                      ) : (
                                        <span className="badge-warning">Unmatched</span>
                                      )}
                                    </td>
                                    <td
                                      className={`text-right tabular-nums ${item.difference !== 0 ? 'text-rose-600' : 'text-muted'}`}
                                    >
                                      {item.difference !== 0 ? `−${formatPeso(Math.abs(item.difference))}` : formatPeso(0)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </FragmentGroup>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── Right rail: detail / summary / breakdown ── */}
            <div className="space-y-4 xl:col-span-4">
              {selected ? (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {selected.matched ? (
                        <span className="badge-accent">Matched</span>
                      ) : (
                        <span className="badge-warning">Unmatched</span>
                      )}
                      <p className="mt-1.5 text-code text-sm font-semibold text-slate-900">{selected.reference}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm shrink-0"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <RailSection title="Details">
                    <RailRow label="Type" value={selected.typeLabel} />
                    <RailRow label="Source" value={<span className="capitalize">{selected.source}</span>} />
                    <RailRow label="Date" value={formatTime(selected.date)} />
                    <RailRow
                      label="Amount"
                      value={
                        <span className={selected.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                          {selected.amount < 0 ? '−' : ''}
                          {formatPeso(Math.abs(selected.amount))}
                        </span>
                      }
                    />
                  </RailSection>

                  <RailSection title="Ledger match">
                    <RailRow label="Matched with" value={selected.matchedWith ? <span className="text-code text-xs">{selected.matchedWith}</span> : '—'} />
                    <RailRow
                      label="Difference"
                      value={
                        selected.difference !== 0
                          ? <span className="text-rose-600">−{formatPeso(Math.abs(selected.difference))}</span>
                          : formatPeso(0)
                      }
                    />
                  </RailSection>

                  {!selected.matched ? (
                    <div className="border-t border-border/60 px-5 py-4">
                      <p className="text-xs leading-relaxed text-muted">
                        No ledger transaction found for this record. The source-of-truth update
                        likely succeeded without its paired ledger post — check server logs for
                        transaction ref failures around this time.
                      </p>
                    </div>
                  ) : null}
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Reconciliation summary</h2>
                    {txnData ? (
                      <span className={txnData.summary.unmatchedCount === 0 ? 'badge-accent' : 'badge-warning'}>
                        {txnData.summary.unmatchedCount === 0 ? 'All matched' : `${txnData.summary.unmatchedCount} unmatched`}
                      </span>
                    ) : null}
                  </div>
                  {txnData ? (
                    <>
                      <RailSection title="Totals">
                        <RailRow label="Transactions" value={txnData.summary.total.toLocaleString()} />
                        <RailRow label="Total amount" value={formatPesoWhole(txnData.summary.totalAmount)} />
                        <RailRow label="Matched amount" value={formatPesoWhole(txnData.summary.matchedAmount)} />
                        <RailRow
                          label="Unmatched amount"
                          value={
                            txnData.summary.unmatchedAmount > 0
                              ? <span className="text-rose-600">{formatPesoWhole(txnData.summary.unmatchedAmount)}</span>
                              : formatPesoWhole(0)
                          }
                        />
                        <RailRow
                          label="Difference"
                          value={
                            txnData.summary.difference > 0
                              ? <span className="text-rose-600">{formatPesoWhole(txnData.summary.difference)}</span>
                              : formatPesoWhole(0)
                          }
                        />
                      </RailSection>
                      <div className="border-t border-border/60 px-5 py-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Match rate</p>
                        <div className="mb-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${matchRate ?? 0}%` }}
                          />
                        </div>
                        <p className="text-right text-xs font-semibold tabular-nums text-slate-700">
                          {matchRate != null ? `${matchRate}%` : '—'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="px-5 py-8 text-center text-sm text-muted">Loading summary…</p>
                  )}
                </section>
              )}

              {!selected && txnData && donutTotal > 0 ? (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Breakdown by type</h2>
                    <p className="text-xs text-muted">Amount share across recent transactions</p>
                  </div>
                  <div className="dc-panel-body">
                    <DonutChart
                      segments={donutSegments}
                      centerLabel="Total"
                      centerValue={formatPesoWhole(donutTotal)}
                    />
                    <div className="mt-4 space-y-2">
                      {donutSegments
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <div key={s.key} className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-2 text-slate-700">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.label}
                            </span>
                            <span className="font-medium tabular-nums text-slate-900">
                              {formatPesoWhole(s.count)} ({Math.round((s.count / donutTotal) * 100)}%)
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders a day-group header row followed by its transaction rows, inside the same <tbody>. */
function FragmentGroup({
  dayItems,
  children,
}: {
  dayItems: ReconTxn[];
  children: React.ReactNode;
}) {
  const dayTotal = dayItems.reduce((s, i) => s + Math.abs(i.amount), 0);
  return (
    <>
      <tr className="bg-slate-50/80">
        <td colSpan={6} className="py-2 text-xs font-semibold text-muted">
          {formatDay(dayItems[0].date)} · {dayItems.length} transaction{dayItems.length === 1 ? '' : 's'}
          <span className="ml-2 font-normal">{formatPesoWhole(dayTotal)}</span>
        </td>
      </tr>
      {children}
    </>
  );
}
