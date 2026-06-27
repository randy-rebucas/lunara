'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface ReconciliationData {
  pnl: {
    platformRevenue: number;
    riderCost: number;
    refundCost: number;
    netMargin: number;
  };
  cashFlow: {
    cashIn: number;
    cashOut: number;
    net: number;
  };
  settlements: {
    count: number;
    paidCount: number;
    pendingCount: number;
    totalRevenue: number;
    totalLunaraFee: number;
    totalPartnerPayout: number;
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

function peso(n: number) {
  const sign = n < 0 ? '−' : '';
  return `${sign}₱${Math.abs(Math.round(n)).toLocaleString()}`;
}

function DriftBadge({ value, label }: { value: number; label: string }) {
  const clean = Math.abs(value) < 2;
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
        clean ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-red-400/40 bg-red-950/5'
      }`}
    >
      <span
        className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
          clean
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
            : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
        }`}
      />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${clean ? 'text-slate-900' : 'text-red-700'}`}>
          {label}
        </p>
        <p className={`text-xs ${clean ? 'text-muted' : 'text-red-600'}`}>
          {clean ? 'Balanced — no drift detected' : `Drift: ${peso(value)} — investigate`}
        </p>
      </div>
      <span
        className={`ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums ${
          clean ? 'text-emerald-700' : 'text-red-700'
        }`}
      >
        {peso(value)}
      </span>
    </div>
  );
}

function StatRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'amber' }) {
  const color =
    highlight === 'green'
      ? 'text-emerald-700'
      : highlight === 'red'
      ? 'text-red-600'
      : highlight === 'amber'
      ? 'text-amber-600'
      : 'text-slate-900';
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-slate-700">{label}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      <span className={`shrink-0 font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export function ReconciliationBoard() {
  const load = useCallback(async () => {
    return adminFetch<ReconciliationData>('/admin/ledger/reconciliation');
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  const allChecksPassed = data
    ? Object.values(data.spotChecks).every((v) => Math.abs(v) < 2)
    : null;

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Revenue Reconciliation
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Cross-checks the double-entry ledger against database records for settlements,
              rider withdrawals, and customer wallets. Use this to detect unposted entries,
              settlement gaps, or wallet drift.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link href="/accounting" className="btn-outline btn-sm">
              Trial balance
            </Link>
            <Link href="/revenue" className="btn-outline btn-sm">
              Revenue
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Running reconciliation…
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Health banner */}
          <div
            className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${
              allChecksPassed
                ? 'border-emerald-500/30 bg-emerald-950/5'
                : 'border-red-400/40 bg-red-950/5'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                allChecksPassed
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${allChecksPassed ? 'text-slate-900' : 'text-red-700'}`}>
                {allChecksPassed ? 'All checks passed — ledger is balanced' : 'Reconciliation issues detected — review spot checks below'}
              </p>
              <p className="text-xs text-muted">
                Ledger vs database cross-check across settlements, cash flow, and wallets
              </p>
            </div>
          </div>

          {/* Spot checks */}
          <section className="dc-panel">
            <div className="dc-panel-header">
              <h2 className="text-sm font-semibold text-slate-900">Spot checks</h2>
              <p className="text-xs text-muted">
                Drift = difference between ledger account and source-of-truth DB records. Should be ₱0.
              </p>
            </div>
            <div className="dc-panel-body space-y-2">
              <DriftBadge
                value={data.spotChecks.clearingDrift}
                label="Order revenue clearing"
              />
              <DriftBadge
                value={data.spotChecks.commissionDrift}
                label="Commission (platform_revenue vs sum of settlement lunaraFee)"
              />
              <DriftBadge
                value={data.spotChecks.cashOutDrift}
                label="Cash out (ledger vs partner payouts + rider withdrawals)"
              />
              <DriftBadge
                value={data.spotChecks.walletDrift}
                label="Customer wallets (ledger liability vs actual wallet balances)"
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* P&L */}
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Platform P&L (all time)</h2>
                <p className="text-xs text-muted">Commission earned minus operating costs from ledger</p>
              </div>
              <div className="dc-panel-body">
                <StatRow
                  label="Commission earned"
                  sub="20% of partner laundry subtotals at settlement"
                  value={peso(data.pnl.platformRevenue)}
                  highlight="green"
                />
                <StatRow
                  label="Rider task costs"
                  sub="₱80 pickup + ₱120 delivery per completed task"
                  value={`−${peso(data.pnl.riderCost)}`}
                  highlight="red"
                />
                <StatRow
                  label="Refund & compensation costs"
                  sub="Goodwill payouts and order refunds"
                  value={`−${peso(data.pnl.refundCost)}`}
                  highlight="red"
                />
                <div className="mt-3 flex items-baseline justify-between border-t-2 border-slate-200 pt-3">
                  <p className="text-sm font-bold text-slate-900">Net platform margin</p>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      data.pnl.netMargin >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {peso(data.pnl.netMargin)}
                  </span>
                </div>
              </div>
            </section>

            {/* Cash flow */}
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Cash flow (all time)</h2>
                <p className="text-xs text-muted">Physical and digital cash movement through the platform</p>
              </div>
              <div className="dc-panel-body">
                <StatRow
                  label="Cash in"
                  sub="PayMongo payments + wallet topups + verified rider remittances"
                  value={peso(data.cashFlow.cashIn)}
                  highlight="green"
                />
                <StatRow
                  label="Cash out"
                  sub="Partner payouts + rider withdrawals (accounting only)"
                  value={`−${peso(data.cashFlow.cashOut)}`}
                  highlight="red"
                />
                <div className="mt-3 flex items-baseline justify-between border-t-2 border-slate-200 pt-3">
                  <p className="text-sm font-bold text-slate-900">Net cash position</p>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      data.cashFlow.net >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {peso(data.cashFlow.net)}
                  </span>
                </div>
              </div>
            </section>

            {/* Settlements */}
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Partner settlements</h2>
                <p className="text-xs text-muted">All-time settlement records from DB</p>
              </div>
              <div className="dc-panel-body">
                <StatRow
                  label="Total settlements"
                  value={`${data.settlements.count.toLocaleString()} (${data.settlements.paidCount} paid, ${data.settlements.pendingCount} pending)`}
                />
                <StatRow
                  label="Gross revenue settled"
                  sub="Sum of all order totals across settled periods"
                  value={peso(data.settlements.totalRevenue)}
                />
                <StatRow
                  label="Lunara commission"
                  sub="20% of subtotals — should match ledger platform_revenue"
                  value={peso(data.settlements.totalLunaraFee)}
                  highlight="green"
                />
                <StatRow
                  label="Total paid to partners"
                  sub="Should match ledger cash_out (partner portion)"
                  value={peso(data.settlements.totalPartnerPayout)}
                />
              </div>
              <div className="border-t border-border/50 px-4 py-2">
                <Link href="/partners/settlements" className="link-primary text-xs font-medium">
                  View all settlements →
                </Link>
              </div>
            </section>

            {/* Rider withdrawals */}
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Rider payouts</h2>
                <p className="text-xs text-muted">Earnings, withdrawals, and cash remittances</p>
              </div>
              <div className="dc-panel-body">
                <StatRow
                  label="Withdrawals paid"
                  value={`${data.riderWithdrawals.paidCount.toLocaleString()} · ${peso(data.riderWithdrawals.totalPaid)}`}
                />
                <StatRow
                  label="Withdrawals pending"
                  value={
                    data.riderWithdrawals.pendingCount > 0
                      ? `${data.riderWithdrawals.pendingCount} · ${peso(data.riderWithdrawals.pendingTotal)}`
                      : 'None'
                  }
                  highlight={data.riderWithdrawals.pendingCount > 0 ? 'amber' : undefined}
                />
                <StatRow
                  label="Total rider payable (ledger)"
                  sub="What Lunara still owes riders for earned but unwithdrawn balance"
                  value={peso(data.riderWithdrawals.riderPayableBalance)}
                />
                <StatRow
                  label="Cash remittance receivable"
                  sub="Cash riders hold pending admin verification"
                  value={peso(data.riderWithdrawals.riderRemittanceReceivable)}
                  highlight={data.riderWithdrawals.riderRemittanceReceivable > 0 ? 'amber' : undefined}
                />
              </div>
              <div className="border-t border-border/50 px-4 py-2">
                <Link href="/riders/withdrawals" className="link-primary text-xs font-medium">
                  View withdrawals →
                </Link>
              </div>
            </section>
          </div>

          {/* Wallet reconciliation */}
          <section className="dc-panel">
            <div className="dc-panel-header">
              <h2 className="text-sm font-semibold text-slate-900">Customer wallets</h2>
              <p className="text-xs text-muted">
                Ledger <code>customer_wallet_liability</code> total vs sum of actual{' '}
                <code>Wallet.balance</code> records. Should always match.
              </p>
            </div>
            <div className="dc-panel-body grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs text-muted">Wallets on platform</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {data.wallets.count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs text-muted">Ledger liability</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatPesoWhole(data.wallets.ledgerLiability)}
                </p>
                <p className="mt-0.5 text-xs text-muted">customer_wallet_liability net credit</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs text-muted">Actual wallet sum</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatPesoWhole(data.wallets.actualBalance)}
                </p>
                <p className="mt-0.5 text-xs text-muted">Sum of all Wallet.balance records</p>
              </div>
            </div>
            {Math.abs(data.wallets.drift) >= 2 && (
              <div className="mx-4 mb-4 mt-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Wallet drift detected: {peso(data.wallets.drift)}</strong> — ledger liability
                does not match actual balances. This usually means a wallet credit or debit was posted
                without a corresponding ledger entry (e.g. the dev topup path before this fix).
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
