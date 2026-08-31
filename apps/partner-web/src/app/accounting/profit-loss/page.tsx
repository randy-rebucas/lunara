'use client';

import { useCallback, useMemo } from 'react';
import type { PartnerInvoice } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { StatCard } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import { listExpenses, partnerFetch, type PartnerExpense } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';

const MONTHS_TO_SHOW = 6;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

export default function AccountingProfitLossPage() {
  const { ready } = useRequirePartner();

  const loadInvoices = useCallback(() => partnerFetch<PartnerInvoice[]>('/partner/invoices'), []);
  const { data: invoices, loading: invoicesLoading, error: invoicesError, reload: reloadInvoices } = usePartnerQuery(
    loadInvoices,
    [],
  );

  const loadExpenses = useCallback(() => listExpenses(), []);
  const { data: expenses, loading: expensesLoading, error: expensesError, reload: reloadExpenses } = usePartnerQuery(
    loadExpenses,
    [],
  );

  const loading = invoicesLoading || expensesLoading;
  const error = invoicesError || expensesError;

  function reloadAll() {
    reloadInvoices();
    reloadExpenses();
  }

  const trend = useMemo(() => {
    const buckets = new Map<string, { revenue: number; fees: number; expenses: number }>();
    const now = new Date();
    for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(monthKey(d), { revenue: 0, fees: 0, expenses: 0 });
    }

    for (const inv of invoices ?? []) {
      const key = monthKey(new Date(inv.periodStart));
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.revenue += inv.totalCollected;
      bucket.fees += inv.amountDue;
    }

    for (const exp of (expenses ?? []) as PartnerExpense[]) {
      const key = monthKey(new Date(exp.date));
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.expenses += exp.amount;
    }

    return [...buckets.entries()].map(([key, b]) => ({
      month: key,
      label: monthLabel(key),
      revenue: b.revenue,
      fees: b.fees,
      expenses: b.expenses,
      netProfit: b.revenue - b.fees - b.expenses,
    }));
  }, [invoices, expenses]);

  if (!ready) return <AuthLoading message="Loading profit & loss…" />;

  const totalRevenue = trend.reduce((s, t) => s + t.revenue, 0);
  const totalFees = trend.reduce((s, t) => s + t.fees, 0);
  const totalExpenses = trend.reduce((s, t) => s + t.expenses, 0);
  const totalNet = totalRevenue - totalFees - totalExpenses;

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description={`A profit and loss statement summarizing income against expenses over the last ${MONTHS_TO_SHOW} months.`}
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading profit & loss…" onRetry={reloadAll} />
      </div>

      {!loading && !error && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatPeso(totalRevenue, true)} />
            <StatCard label="Commission & fees" value={formatPeso(totalFees, true)} />
            <StatCard label="Expenses" value={formatPeso(totalExpenses, true)} />
            <StatCard label="Net profit" value={formatPeso(totalNet, true)} accent="accent" />
          </div>

          <div className="section-panel mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Revenue</th>
                    <th>Commission & fees</th>
                    <th>Expenses</th>
                    <th>Net profit</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((t) => (
                    <tr key={t.month}>
                      <td className="font-medium text-slate-900">{t.label}</td>
                      <td className="text-muted">{formatPeso(t.revenue, true)}</td>
                      <td className="text-muted">{formatPeso(t.fees, true)}</td>
                      <td className="text-muted">{formatPeso(t.expenses, true)}</td>
                      <td className={t.netProfit >= 0 ? 'font-medium text-accent' : 'font-medium text-red-600'}>
                        {formatPeso(t.netProfit, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
