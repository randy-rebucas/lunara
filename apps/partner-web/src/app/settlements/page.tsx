'use client';

import Link from 'next/link';
import { Fragment, useCallback, useState } from 'react';
import type { PartnerOrderDetail, PartnerSettlement, PartnerSettingsData } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { formatPeso } from '../../lib/format-peso';
import { exportCsv } from '../../lib/export-csv';
import { exportPdf } from '../../lib/export-pdf';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

const PAYOUT_METHOD_LABELS: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank transfer',
  counter: 'Personal / Over the counter',
};

function payoutMethodSub(settings: PartnerSettingsData['settings'] | undefined): string {
  if (!settings?.payoutMethod) return '';
  if (settings.payoutMethod === 'gcash') return settings.gcashNumber ?? '';
  if (settings.payoutMethod === 'maya') return settings.mayaNumber ?? '';
  if (settings.payoutMethod === 'bank')
    return [settings.bankName, settings.bankAccountNumber].filter(Boolean).join(' · ');
  return '';
}

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function SettlementsPage() {
  const { ready } = useRequirePartner();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ordersCache, setOrdersCache] = useState<Record<string, PartnerOrderDetail[]>>({});
  const [ordersLoading, setOrdersLoading] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  async function toggleOrders(s: PartnerSettlement) {
    if (expandedId === s._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(s._id);
    setOrdersError(null);
    if (ordersCache[s._id]) return;
    setOrdersLoading(s._id);
    try {
      const orders = await partnerFetch<PartnerOrderDetail[]>(`/partner/settlements/${s._id}/orders`);
      setOrdersCache((c) => ({ ...c, [s._id]: orders }));
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setOrdersLoading(null);
    }
  }

  const load = useCallback(async () => {
    return partnerFetch<PartnerSettlement[]>('/partner/settlements');
  }, []);

  const loadLedgerBalance = useCallback(async () => {
    return partnerFetch<{ partnerId: string; payableBalance: number }>('/partner/ledger-balance');
  }, []);

  const loadSettings = useCallback(async () => {
    return partnerFetch<PartnerSettingsData>('/partner/settings');
  }, []);

  const { data, loading, error, reload } = usePartnerQuery(load, []);
  const { data: ledger } = usePartnerQuery(loadLedgerBalance, []);
  const { data: settingsData } = usePartnerQuery(loadSettings, []);

  if (!ready) return <AuthLoading message="Loading settlements…" />;

  const totalPayout = data?.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.partnerPayout ?? s.totalAmount), 0) ?? 0;
  const totalSettlements = data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Settlements"
        description="Payout records from Lunara for your completed orders. Cash collected by riders is remitted to Lunara and settled to you per period."
        actions={
          <>
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={!data?.length}
            onClick={() => {
              if (!data) return;
              exportCsv(
                'settlements.csv',
                ['Period', 'Orders', 'Revenue (₱)', 'Lunara Fee (₱)', 'Payout (₱)', 'Status'],
                data.map((s) => [
                  formatDateRange(s.periodStart, s.periodEnd),
                  s.totalOrders,
                  s.totalAmount,
                  s.lunaraFee ?? '',
                  s.partnerPayout ?? s.totalAmount,
                  s.status,
                ]),
              );
            }}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={!data?.length}
            onClick={() => {
              if (!data) return;
              exportPdf(
                'settlements.pdf',
                ['Period', 'Orders', 'Revenue (₱)', 'Lunara Fee (₱)', 'Payout (₱)', 'Status'],
                data.map((s) => [
                  formatDateRange(s.periodStart, s.periodEnd),
                  s.totalOrders,
                  s.totalAmount,
                  s.lunaraFee ?? '',
                  s.partnerPayout ?? s.totalAmount,
                  s.status,
                ]),
                'Settlements',
              );
            }}
          >
            Export PDF
          </button>
          <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
            Refresh
          </button>
          </>
        }
      />

      <div className="alert-info mt-4 flex items-start gap-3">
        <span className="text-base">📅</span>
        <div>
          <p className="font-medium">Settlements process every Saturday</p>
          <p className="mt-0.5 text-xs opacity-80">
            Earnings from completed orders are tallied weekly and sent out on Saturdays.
            Pending settlements will appear here once processed by Lunara admin.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading settlements…" />
      </div>

      {data && (
        <>
          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="stat-card col-span-2 sm:col-span-1">
              <p className="text-xs text-muted">Outstanding balance</p>
              <p className="text-2xl font-semibold text-slate-900">
                {ledger ? formatPeso(ledger.payableBalance) : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                What Lunara still owes you, from the accounting ledger
              </p>
            </div>
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
            <div className="stat-card">
              <p className="text-xs text-muted">Payout method</p>
              {settingsData?.settings.payoutMethod ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {PAYOUT_METHOD_LABELS[settingsData.settings.payoutMethod] ?? settingsData.settings.payoutMethod}
                  </p>
                  {payoutMethodSub(settingsData.settings) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{payoutMethodSub(settingsData.settings)}</p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-amber-600">Not set</p>
              )}
              <p className="mt-2 text-xs">
                <Link href="/settings" className="text-primary underline hover:opacity-80">
                  Change in Settings →
                </Link>
              </p>
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
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th>Period</th>
                    <th>Orders</th>
                    <th>Status</th>
                    <th>Paid on</th>
                    <th className="text-right font-semibold">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((s) => {
                    const isExpanded = expandedId === s._id;
                    const isLoadingThis = ordersLoading === s._id;
                    const orders = ordersCache[s._id];
                    return (
                      <Fragment key={s._id}>
                        <tr className="cursor-pointer hover:bg-slate-50"
                          onClick={() => void toggleOrders(s)}
                        >
                          <td className="text-center text-xs text-muted">
                            <span
                              className="inline-block transition-transform duration-150"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                            >▶</span>
                          </td>
                          <td className="text-slate-900 text-sm whitespace-nowrap">{formatDateRange(s.periodStart, s.periodEnd)}</td>
                          <td className="text-muted whitespace-nowrap">
                            {s.totalOrders}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({s.cashOrders}C / {s.digitalOrders}D)
                            </span>
                          </td>
                          <td className="whitespace-nowrap">
                            {s.status === 'paid' ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Paid</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>
                            )}
                          </td>
                          <td className="text-muted text-sm whitespace-nowrap">
                            {s.paidAt
                              ? new Date(s.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="text-right font-semibold text-slate-900">{formatPeso(s.partnerPayout ?? s.totalAmount)}</td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-slate-50/70 p-0">
                              <div className="border-t border-border/60 px-3 py-4 sm:px-5">
                                {isLoadingThis && <p className="text-sm text-muted">Loading orders…</p>}
                                {!isLoadingThis && ordersError && <p className="text-sm text-destructive">{ordersError}</p>}
                                {!isLoadingThis && orders?.length === 0 && (
                                  <p className="text-sm text-muted">No orders found for this period.</p>
                                )}
                                {!isLoadingThis && orders && orders.length > 0 && (
                                  <div className="overflow-x-auto">
                                  <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                                    <thead>
                                      <tr className="text-left text-xs text-muted">
                                        <th className="pb-2 pr-4 font-medium">Completed</th>
                                        <th className="pb-2 pr-4 font-medium">Order ID</th>
                                        <th className="pb-2 pr-4 font-medium">Type</th>
                                        <th className="pb-2 pr-4 font-medium">Payment</th>
                                        <th className="pb-2 text-right font-medium">Earnings</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                      {orders.map((o) => (
                                        <tr key={o.orderId}>
                                          <td className="py-1.5 pr-4 text-muted">
                                            {o.completedAt
                                              ? new Date(o.completedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                                              : '—'}
                                          </td>
                                          <td className="py-1.5 pr-4 font-mono text-xs text-muted">{o.orderId.slice(-8).toUpperCase()}</td>
                                          <td className="py-1.5 pr-4 capitalize text-slate-700">{o.bookingType?.replace(/_/g, ' ') ?? '—'}</td>
                                          <td className="py-1.5 pr-4">
                                            {o.paymentMethod === 'CASH' ? (
                                              o.cashCollected
                                                ? <span className="text-xs font-medium text-green-700">Cash ✓</span>
                                                : <span className="text-xs text-amber-600">Cash pending</span>
                                            ) : (
                                              <span className="text-xs text-blue-700">{o.paymentMethod ?? '—'}</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 text-right font-semibold text-slate-900">{formatPeso(o.partnerPayout ?? o.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-border/60 text-xs font-semibold">
                                        <td colSpan={4} className="pt-2 text-muted">{orders.length} order{orders.length === 1 ? '' : 's'} total</td>
                                        <td className="pt-2 text-right text-slate-900">{formatPeso(orders.reduce((sum, o) => sum + (o.partnerPayout ?? o.amount), 0))}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
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
