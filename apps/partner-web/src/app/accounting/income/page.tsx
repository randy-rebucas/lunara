'use client';

import { useCallback } from 'react';
import type { PartnerInvoice } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { StatCard } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import { partnerFetch } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Net income for one invoice period: what the partner collected directly from customers, minus
 * what Lunara billed them (commission + fronted rider cost + subscription fee) for that period. */
function netIncome(inv: PartnerInvoice) {
  return inv.totalCollected - inv.amountDue;
}

export default function AccountingIncomePage() {
  const { ready } = useRequirePartner();

  const load = useCallback(() => partnerFetch<PartnerInvoice[]>('/partner/invoices'), []);
  const { data, loading, error, reload } = usePartnerQuery(load, []);

  if (!ready) return <AuthLoading message="Loading income…" />;

  const invoices = [...(data ?? [])].sort(
    (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
  );

  const totalCollected = invoices.reduce((s, i) => s + i.totalCollected, 0);
  const totalFees = invoices.reduce((s, i) => s + i.amountDue, 0);
  const totalNet = totalCollected - totalFees;

  return (
    <div>
      <PageHeader
        title="Income"
        description="Your net income per billing period — what you collected directly from customers, minus what Lunara billed you for commission, fronted rider costs, and subscription fees."
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading income…" onRetry={reload} />
      </div>

      {!loading && !error && invoices.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No billing periods yet — income appears once your first invoice is issued.</p>
        </div>
      )}

      {invoices.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total collected" value={formatPeso(totalCollected, true)} />
            <StatCard label="Total billed by Lunara" value={formatPeso(totalFees, true)} />
            <StatCard label="Net income" value={formatPeso(totalNet, true)} accent="accent" />
          </div>

          <div className="section-panel mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Collected</th>
                    <th>Commission</th>
                    <th>Rider cost</th>
                    <th>Subscription</th>
                    <th>Net income</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const net = netIncome(inv);
                    return (
                      <tr key={inv._id}>
                        <td className="font-medium text-slate-900">{formatDateRange(inv.periodStart, inv.periodEnd)}</td>
                        <td className="text-muted">{formatPeso(inv.totalCollected, true)}</td>
                        <td className="text-muted">{formatPeso(inv.commissionDue, true)}</td>
                        <td className="text-muted">{formatPeso(inv.riderCostDue, true)}</td>
                        <td className="text-muted">{formatPeso(inv.subscriptionFeeDue, true)}</td>
                        <td className={net >= 0 ? 'font-medium text-accent' : 'font-medium text-red-600'}>
                          {formatPeso(net, true)}
                        </td>
                        <td>
                          <span className={inv.status === 'paid' ? 'badge-accent text-xs' : 'badge-neutral text-xs'}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
