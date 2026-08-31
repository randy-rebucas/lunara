'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PartnerInvoice, PartnerRevenueData } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import { listExpenses, partnerFetch, type PartnerExpense } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';

type TxType = 'payment' | 'invoice' | 'expense';

interface Transaction {
  id: string;
  date: string;
  type: TxType;
  label: string;
  detail: string;
  amount: number;
}

const TYPE_LABELS: Record<TxType, string> = {
  payment: 'Payment',
  invoice: 'Invoice',
  expense: 'Expense',
};

const TYPE_BADGE_CLASS: Record<TxType, string> = {
  payment: 'badge-accent',
  invoice: 'badge-neutral',
  expense: 'badge-neutral',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AccountingTransactionsPage() {
  const { ready } = useRequirePartner();
  const [activeType, setActiveType] = useState<TxType | 'all'>('all');

  const loadRevenue = useCallback(() => partnerFetch<PartnerRevenueData>('/partner/revenue'), []);
  const { data: revenue, loading: revenueLoading, error: revenueError, reload: reloadRevenue } = usePartnerQuery(
    loadRevenue,
    [],
  );

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

  const loading = revenueLoading || invoicesLoading || expensesLoading;
  const error = revenueError || invoicesError || expensesError;

  function reloadAll() {
    reloadRevenue();
    reloadInvoices();
    reloadExpenses();
  }

  const transactions = useMemo<Transaction[]>(() => {
    const payments: Transaction[] = (revenue?.recentOrders ?? []).map((o) => ({
      id: `payment-${o.orderId}`,
      date: o.completedAt,
      type: 'payment' as const,
      label: 'Customer payment',
      detail: `Order #${o.orderId.slice(-6).toUpperCase()}`,
      amount: o.amount,
    }));

    const invoiceTx: Transaction[] = (invoices ?? []).map((i: PartnerInvoice) => ({
      id: `invoice-${i._id}`,
      date: i.createdAt,
      type: 'invoice' as const,
      label: `Invoice ${i.invoiceNumber}`,
      detail: `${i.status} · commission + fees billed by Lunara`,
      amount: -i.amountDue,
    }));

    const expenseTx: Transaction[] = (expenses ?? []).map((e: PartnerExpense) => ({
      id: `expense-${e._id}`,
      date: e.date,
      type: 'expense' as const,
      label: e.category,
      detail: e.note || 'Shop expense',
      amount: -e.amount,
    }));

    return [...payments, ...invoiceTx, ...expenseTx].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [revenue, invoices, expenses]);

  const filtered = activeType === 'all' ? transactions : transactions.filter((t) => t.type === activeType);

  if (!ready) return <AuthLoading message="Loading transactions…" />;

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="A unified transaction log spanning payments, invoices, and adjustments."
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading transactions…" onRetry={reloadAll} />
      </div>

      {!loading && !error && (
        <>
          <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-slate-50 p-1">
            {(
              [
                { id: 'all' as const, label: 'All' },
                { id: 'payment' as const, label: 'Payments' },
                { id: 'invoice' as const, label: 'Invoices' },
                { id: 'expense' as const, label: 'Expenses' },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveType(tab.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-1 ${
                  activeType === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-muted hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-muted">No transactions yet.</p>
            </div>
          ) : (
            <div className="section-panel mt-4 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id}>
                        <td className="text-muted">{formatDate(t.date)}</td>
                        <td>
                          <span className={`${TYPE_BADGE_CLASS[t.type]} text-xs`}>{TYPE_LABELS[t.type]}</span>
                        </td>
                        <td>
                          <p className="font-medium text-slate-900">{t.label}</p>
                          <p className="text-xs text-muted">{t.detail}</p>
                        </td>
                        <td className={t.amount >= 0 ? 'font-medium text-accent' : 'font-medium text-red-600'}>
                          {t.amount >= 0 ? '+' : '-'}
                          {formatPeso(Math.abs(t.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
