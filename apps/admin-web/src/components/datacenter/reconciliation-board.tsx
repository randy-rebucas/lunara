'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { MetricCell } from './metric-cell';
import { DetailRow, OpsPanel } from '../ui/ops-panel';
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

function DriftBadge({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const clean = Math.abs(value) < 2;
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${clean ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-red-400/40 bg-red-950/5'}`}>
      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${clean ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${clean ? 'text-slate-900' : 'text-red-700'}`}>{label}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
        <p className={`mt-0.5 text-xs ${clean ? 'text-emerald-700' : 'text-red-600'}`}>
          {clean ? 'Balanced' : `Drift: ${peso(value)} — investigate`}
        </p>
      </div>
      <span className={`ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums ${clean ? 'text-emerald-700' : 'text-red-700'}`}>
        {peso(value)}
      </span>
    </div>
  );
}

export function ReconciliationBoard() {
  const load = useCallback(() => adminFetch<ReconciliationData>('/admin/ledger/reconciliation'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  const allChecksPassed = data ? Object.values(data.spotChecks).every((v) => Math.abs(v) < 2) : null;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Revenue Reconciliation
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Cross-checks the double-entry ledger against database records for settlements,
              rider withdrawals, and customer wallets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link href="/accounting" className="btn-outline btn-sm">Trial balance</Link>
            <Link href="/revenue" className="btn-outline btn-sm">Revenue</Link>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}

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
              <p className="text-xs text-muted">Ledger vs database cross-check across settlements, cash flow, and wallets</p>
            </div>
            {!allChecksPassed && <span className="badge-danger px-3 py-1 text-xs font-semibold">Drift detected</span>}
          </div>

          {/* ── Headline metric row ──────────────────────────────── */}
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCell
              label="Platform revenue"
              value={formatPesoWhole(data.pnl.platformRevenue)}
              highlight="accent"
            />
            <MetricCell
              label="Net margin"
              value={formatPesoWhole(data.pnl.netMargin)}
              highlight={data.pnl.netMargin >= 0 ? 'accent' : 'danger'}
            />
            <MetricCell
              label="Cash in"
              value={formatPesoWhole(data.cashFlow.cashIn)}
              sub="PayMongo · topups · remittances"
              highlight="accent"
            />
            <MetricCell
              label="Cash out"
              value={formatPesoWhole(data.cashFlow.cashOut)}
              sub="Partner payouts · rider withdrawals"
              highlight="warning"
            />
            <MetricCell
              label="Net cash position"
              value={formatPesoWhole(data.cashFlow.net)}
              highlight={data.cashFlow.net >= 0 ? 'accent' : 'danger'}
            />
          </div>

          {/* ── Spot checks ─────────────────────────────────────── */}
          <OpsPanel
            title="Spot checks"
            description="Drift = ledger account balance minus source-of-truth DB records. Should be ₱0."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <DriftBadge
                value={data.spotChecks.clearingDrift}
                label="Order revenue clearing"
                sub="Uncleared orders still in transit"
              />
              <DriftBadge
                value={data.spotChecks.commissionDrift}
                label="Commission"
                sub="Ledger platform_revenue vs sum of settlement lunaraFee"
              />
              <DriftBadge
                value={data.spotChecks.cashOutDrift}
                label="Cash out"
                sub="Ledger vs partner payouts + rider withdrawals paid"
              />
              <DriftBadge
                value={data.spotChecks.walletDrift}
                label="Customer wallets"
                sub="Ledger liability vs actual Wallet.balance records"
              />
            </div>
          </OpsPanel>

          {/* ── P&L + Cash flow ─────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">

            <OpsPanel title="Platform P&L" description="Commission earned minus rider and refund costs (all time)">
              <dl>
                <DetailRow label="Commission earned" value={<span className="text-emerald-700">{peso(data.pnl.platformRevenue)}</span>} />
                <DetailRow label="Rider task costs" value={<span className="text-rose-600">−{peso(data.pnl.riderCost)}</span>} />
                <DetailRow label="Refund & compensation" value={<span className="text-rose-600">−{peso(data.pnl.refundCost)}</span>} />
              </dl>
              <div className="mt-2 flex items-baseline justify-between border-t-2 border-slate-200 pt-2.5">
                <p className="text-sm font-bold text-slate-900">Net platform margin</p>
                <span className={`text-lg font-bold tabular-nums ${data.pnl.netMargin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {peso(data.pnl.netMargin)}
                </span>
              </div>
            </OpsPanel>

            <OpsPanel title="Cash flow" description="Physical and digital cash movement through the platform (all time)">
              <dl>
                <DetailRow
                  label="Cash in"
                  value={<span className="text-emerald-700">{peso(data.cashFlow.cashIn)}</span>}
                />
                <DetailRow
                  label="Cash out"
                  value={<span className="text-rose-600">−{peso(data.cashFlow.cashOut)}</span>}
                />
              </dl>
              <div className="mt-2 flex items-baseline justify-between border-t-2 border-slate-200 pt-2.5">
                <p className="text-sm font-bold text-slate-900">Net cash position</p>
                <span className={`text-lg font-bold tabular-nums ${data.cashFlow.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {peso(data.cashFlow.net)}
                </span>
              </div>
            </OpsPanel>
          </div>

          {/* ── Settlements + Rider payouts ──────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">

            <OpsPanel
              title="Partner settlements"
              description="All-time settlement records from DB"
              headerAction={<Link href="/partners/settlements" className="link-primary text-xs font-medium">View all →</Link>}
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
              headerAction={<Link href="/riders/withdrawals" className="link-primary text-xs font-medium">View withdrawals →</Link>}
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
                <DetailRow
                  label="Rider payable (ledger)"
                  value={peso(data.riderWithdrawals.riderPayableBalance)}
                />
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
          </div>

          {/* ── Customer wallets ─────────────────────────────────── */}
          <OpsPanel
            title="Customer wallets"
            description="Ledger customer_wallet_liability vs sum of actual Wallet.balance records — should always match."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-slate-50/80 px-3.5 py-3">
                <p className="text-xs text-muted">Wallets on platform</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{data.wallets.count.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-slate-50/80 px-3.5 py-3">
                <p className="text-xs text-muted">Ledger liability</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatPesoWhole(data.wallets.ledgerLiability)}</p>
                <p className="mt-0.5 text-xs text-muted">customer_wallet_liability net credit</p>
              </div>
              <div className={`rounded-lg border px-3.5 py-3 ${Math.abs(data.wallets.drift) >= 2 ? 'border-red-300 bg-red-50' : 'border-border/60 bg-slate-50/80'}`}>
                <p className="text-xs text-muted">Actual wallet sum</p>
                <p className={`mt-1 text-xl font-semibold ${Math.abs(data.wallets.drift) >= 2 ? 'text-red-700' : 'text-slate-900'}`}>
                  {formatPesoWhole(data.wallets.actualBalance)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {Math.abs(data.wallets.drift) < 2 ? 'Matches ledger ✓' : `Drift: ${peso(data.wallets.drift)}`}
                </p>
              </div>
            </div>
            {Math.abs(data.wallets.drift) >= 2 && (
              <div className="alert-error mt-3 text-sm">
                <strong>Wallet drift: {peso(data.wallets.drift)}</strong> — ledger liability does not match actual balances.
                A wallet credit or debit was likely posted without a corresponding ledger entry.
              </div>
            )}
          </OpsPanel>

        </div>
      )}
    </div>
  );
}
