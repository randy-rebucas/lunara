'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import type { PartnerSettlement } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { formatPeso } from '../../lib/format-peso';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function SettlementsPage() {
  const { ready } = useRequirePartner();

  const load = useCallback(async () => {
    return partnerFetch<PartnerSettlement[]>('/partner/settlements');
  }, []);

  const { data, loading, error, reload } = usePartnerQuery(load, []);

  if (!ready) return <AuthLoading message="Loading settlements…" />;

  const totalPayout = data?.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.partnerPayout ?? s.totalAmount), 0) ?? 0;
  const totalSettlements = data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Settlements"
        description="Payout records from Lunara for your completed orders. Cash collected by riders is remitted to Lunara and settled to you per period."
        actions={
          <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
            Refresh
          </button>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading settlements…" />
      </div>

      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="stat-card">
              <p className="text-xs text-muted">Total paid out to you</p>
              <p className="text-2xl font-semibold text-slate-900">{formatPeso(totalPayout)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{totalSettlements} settlement record{totalSettlements === 1 ? '' : 's'}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Last settlement payout</p>
              {data.length > 0 ? (
                <>
                  <p className="text-2xl font-semibold text-slate-900">{formatPeso(data[0].partnerPayout ?? data[0].totalAmount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data[0].paidAt
                      ? new Date(data[0].paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">No settlements yet</p>
              )}
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Revenue tracking</p>
              <p className="mt-1 text-sm text-slate-700">
                <Link href="/revenue" className="underline hover:text-primary">
                  View revenue breakdown →
                </Link>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">See per-order cash collection status</p>
            </div>
          </div>

          {data.length === 0 ? (
            <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
              <p className="font-medium text-slate-700">No settlements yet</p>
              <p className="mt-1 text-sm text-muted">
                Lunara admin will create a settlement record once your earnings for a period have been remitted.
              </p>
            </div>
          ) : (
            <div className="section-panel mt-8 overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Orders</th>
                    <th>Status</th>
                    <th>Paid on</th>
                    <th className="text-right">Gross revenue</th>
                    <th className="text-right">Lunara fee</th>
                    <th className="text-right font-semibold">Your payout</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((s) => (
                    <tr key={s._id}>
                      <td className="text-slate-900 text-sm">{formatDateRange(s.periodStart, s.periodEnd)}</td>
                      <td className="text-muted">
                        {s.totalOrders}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({s.cashOrders}C / {s.digitalOrders}D)
                        </span>
                      </td>
                      <td>
                        {s.status === 'paid' ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="text-muted text-sm">
                        {s.paidAt
                          ? new Date(s.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="text-right text-muted">{formatPeso(s.totalAmount)}</td>
                      <td className="text-right text-rose-600 text-sm">
                        −{formatPeso(s.lunaraFee ?? 0)}
                        {s.commissionRate != null && (
                          <span className="ml-1 text-xs text-muted-foreground">({Math.round(s.commissionRate * 100)}%)</span>
                        )}
                      </td>
                      <td className="text-right font-semibold text-slate-900">{formatPeso(s.partnerPayout ?? s.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.some((s) => s.adminNote) && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Admin notes</h3>
              {data.filter((s) => s.adminNote).map((s) => (
                <div key={s._id} className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium">{formatDateRange(s.periodStart, s.periodEnd)}:</span>{' '}
                  {s.adminNote}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
