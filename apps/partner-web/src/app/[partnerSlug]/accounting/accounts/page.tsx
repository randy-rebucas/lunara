'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import type { PartnerInvoice } from '@lunara/types';
import { AuthLoading } from '../../../../components/auth-loading';
import { DataPageStatus } from '../../../../components/data-page-status';
import { PageHeader } from '../../../../components/ui/page-header';
import { useRequirePartner } from '../../../../hooks/use-protected-page';
import { computeTotals } from '../../../../lib/accounting-totals';
import { formatPeso } from '../../../../lib/format-peso';
import { listExpenses, partnerFetch } from '../../../../lib/partner-api';
import { usePartnerPath } from '../../../../lib/partner-path';
import { usePartnerQuery } from '../../../../lib/use-partner-query';

export default function AccountingAccountsPage() {
  const { ready } = useRequirePartner();
  const toPath = usePartnerPath();

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

  if (!ready) return <AuthLoading message="Loading accounts…" />;

  // Same invoice-based totals the Income and Profit & Loss pages use, so "net income" agrees
  // across all three screens instead of mixing this page's revenue source with theirs.
  const { totalCollected: grossRevenue, totalFeesBilled: feesBilled, totalExpenses: operatingExpenses, netIncome } =
    computeTotals(invoices ?? [], expenses ?? []);

  const accounts = [
    {
      name: 'Revenue',
      type: 'Income',
      description: 'Gross amount collected directly from customers across all invoiced billing periods.',
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
                      <Link href={toPath(a.href)} className="btn-outline btn-sm">
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
