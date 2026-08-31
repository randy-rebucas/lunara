'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import type { PartnerInvoice, PartnerRevenueData } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import { listExpenses, partnerFetch } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';

export default function AccountingAccountsPage() {
  const { ready } = useRequirePartner();

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

  if (!ready) return <AuthLoading message="Loading accounts…" />;

  const grossRevenue = revenue?.allTimeRevenue ?? 0;
  const feesBilled = (invoices ?? []).reduce((s, i) => s + i.amountDue, 0);
  const operatingExpenses = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const netIncome = grossRevenue - feesBilled - operatingExpenses;

  const accounts = [
    {
      name: 'Revenue',
      type: 'Income',
      description: 'Gross amount collected directly from customers, all time.',
      balance: grossRevenue,
      href: '/revenue',
    },
    {
      name: 'Commission & fees payable',
      type: 'Liability',
      description: "What Lunara has billed you for commission, fronted rider costs, and subscription fees.",
      balance: -feesBilled,
      href: '/accounting/income',
    },
    {
      name: 'Operating expenses',
      type: 'Expense',
      description: 'Supplies, utilities, and other costs you’ve recorded for your shop.',
      balance: -operatingExpenses,
      href: '/accounting/expenses',
    },
    {
      name: 'Net income',
      type: 'Equity',
      description: 'Revenue minus commission/fees and operating expenses.',
      balance: netIncome,
      href: '/accounting/profit-loss',
    },
  ];

  return (
    <div>
      <PageHeader title="Accounts" description="Chart of accounts for your shop's bookkeeping." />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading accounts…" onRetry={reloadAll} />
      </div>

      {!loading && !error && (
        <div className="section-panel mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.name}>
                    <td>
                      <p className="font-medium text-slate-900">{a.name}</p>
                      <p className="text-xs text-muted">{a.description}</p>
                    </td>
                    <td>
                      <span className="badge-neutral text-xs">{a.type}</span>
                    </td>
                    <td className={a.balance >= 0 ? 'font-medium text-accent' : 'font-medium text-red-600'}>
                      {a.balance >= 0 ? '' : '-'}
                      {formatPeso(Math.abs(a.balance))}
                    </td>
                    <td>
                      <Link href={a.href} className="btn-outline btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
