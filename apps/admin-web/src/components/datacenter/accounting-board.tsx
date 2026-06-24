'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface LedgerRow {
  accountType: string;
  accountSubject: string;
  balance: number;
}

const ACCOUNT_LABELS: Record<string, string> = {
  order_revenue_clearing: 'Order revenue clearing',
  platform_revenue: 'Platform revenue (commission)',
  partner_payable: 'Owed to partner',
  rider_payable: 'Owed to rider',
  rider_remittance_receivable: 'Cash owed by rider',
  cash_out: 'Cash paid out',
  platform_cash: 'Platform cash received',
  rider_payout_expense: 'Rider payout expense',
  customer_wallet_liability: 'Customer wallet balance',
  refund_expense: 'Refund / compensation expense',
};

const ACCOUNT_HELP: Record<string, string> = {
  order_revenue_clearing:
    'Order revenue recognized but not yet settled to a partner. Should trend toward zero — sustained drift means orders are unsettled or refunds are outpacing settlement.',
  partner_payable: 'What Lunara owes each partner. Should match their unpaid settlement totals.',
  rider_payable: 'What Lunara owes each rider for completed tasks and bonuses, before withdrawal.',
  rider_remittance_receivable: 'Cash a rider is holding that is owed back to Lunara, pending verification.',
  customer_wallet_liability: 'Customer wallet balances — money Lunara owes back to customers.',
};

function formatPeso(amount: number) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatPesoWhole(Math.abs(amount))}`;
}

export function AccountingBoard() {
  const load = useCallback(async () => {
    return adminFetch<LedgerRow[]>('/admin/ledger/trial-balance');
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  const rows = data ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, LedgerRow[]>();
    for (const row of rows) {
      const list = map.get(row.accountType) ?? [];
      list.push(row);
      map.set(row.accountType, list);
    }
    return Array.from(map.entries()).map(([accountType, items]) => ({
      accountType,
      items: items.sort((a, b) => b.balance - a.balance),
      total: items.reduce((sum, r) => sum + r.balance, 0),
    }));
  }, [rows]);

  const clearingDrift = grouped.find((g) => g.accountType === 'order_revenue_clearing')?.total ?? 0;

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Ledger</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Accounting
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Net balance per account, derived from every settlement, payment, remittance, withdrawal,
              and refund posted to the double-entry ledger. Use this to reconcile partner payouts,
              rider earnings, and customer wallet balances against real money movement.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/shops" className="btn-outline btn-sm">
              Shops
            </Link>
            <Link href="/revenue" className="btn-outline btn-sm">
              Revenue
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
          Loading ledger…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div
            className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${
              Math.abs(clearingDrift) < 1
                ? 'border-emerald-500/30 bg-emerald-950/5'
                : 'border-amber-500/35 bg-amber-950/5'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                Math.abs(clearingDrift) < 1
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Order revenue clearing: {formatPeso(clearingDrift)}
              </p>
              <p className="text-xs text-muted">
                {Math.abs(clearingDrift) < 1
                  ? 'Clearing account balanced — recognized order revenue is fully settled or refunded.'
                  : 'Unsettled balance: orders paid but not yet settled (expected day-to-day), or refunds outpacing settlement.'}
              </p>
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="dc-panel-empty">
              <p className="font-medium text-slate-900">No ledger entries yet</p>
              <p className="mt-1 text-sm text-muted">
                Entries are posted automatically as payments, settlements, remittances, withdrawals,
                and refunds happen.
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <section className="dc-panel" key={group.accountType}>
                <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {ACCOUNT_LABELS[group.accountType] ?? group.accountType}
                    </h2>
                    {ACCOUNT_HELP[group.accountType] ? (
                      <p className="text-xs text-muted">{ACCOUNT_HELP[group.accountType]}</p>
                    ) : null}
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatPeso(group.total)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[480px]">
                    <caption className="sr-only">{group.accountType} balances by subject</caption>
                    <thead>
                      <tr>
                        <th scope="col">Subject</th>
                        <th scope="col" className="text-right">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((row) => (
                        <tr key={`${row.accountType}:${row.accountSubject}`}>
                          <td className="text-code text-muted">{row.accountSubject || '—'}</td>
                          <td className="text-right tabular-nums">{formatPeso(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
