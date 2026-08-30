'use client';

import Link from 'next/link';
import { Fragment, useCallback, useState } from 'react';
import type { PartnerInvoice, PartnerInvoiceOrder } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { formatPeso } from '../../lib/format-peso';
import { exportCsv } from '../../lib/export-csv';
import { getApiBaseUrl, getPartnerToken, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InvoicesPage() {
  const { ready } = useRequirePartner();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ordersCache, setOrdersCache] = useState<Record<string, PartnerInvoiceOrder[]>>({});
  const [ordersLoading, setOrdersLoading] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  async function toggleOrders(inv: PartnerInvoice) {
    if (expandedId === inv._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(inv._id);
    setOrdersError(null);
    if (ordersCache[inv._id]) return;
    setOrdersLoading(inv._id);
    try {
      const orders = await partnerFetch<PartnerInvoiceOrder[]>(`/partner/invoices/${inv._id}/orders`);
      setOrdersCache((c) => ({ ...c, [inv._id]: orders }));
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setOrdersLoading(null);
    }
  }

  async function downloadPdf(inv: PartnerInvoice) {
    setDownloadingId(inv._id);
    setDownloadError('');
    try {
      const token = getPartnerToken();
      const res = await fetch(`${getApiBaseUrl()}/partner/invoices/${inv._id}/pdf`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download invoice PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Failed to download invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  }

  const load = useCallback(async () => {
    return partnerFetch<PartnerInvoice[]>('/partner/invoices');
  }, []);

  const loadReceivableBalance = useCallback(async () => {
    return partnerFetch<{ partnerId: string; receivableBalance: number }>('/partner/receivable-balance');
  }, []);

  const { data, loading, error, reload } = usePartnerQuery(load, []);
  const { data: receivable } = usePartnerQuery(loadReceivableBalance, []);

  if (!ready) return <AuthLoading message="Loading invoices…" />;

  const totalBilled = data?.reduce((sum, i) => sum + i.amountDue, 0) ?? 0;
  const totalInvoices = data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="You collect payment directly from your customers. Lunara bills you here for its commission and any delivery costs fronted on your behalf."
        actions={
          <>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!data?.length}
              onClick={() => {
                if (!data) return;
                exportCsv(
                  'invoices.csv',
                  ['Invoice #', 'Period', 'Orders', 'Collected (₱)', 'Commission (₱)', 'Amount due (₱)', 'Status'],
                  data.map((i) => [
                    i.invoiceNumber,
                    formatDateRange(i.periodStart, i.periodEnd),
                    i.totalOrders,
                    i.totalCollected,
                    i.commissionDue,
                    i.amountDue,
                    i.status,
                  ]),
                );
              }}
            >
              Export CSV
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
          <p className="font-medium">Invoices are generated every Saturday</p>
          <p className="mt-0.5 text-xs opacity-80">
            Commission and rider costs owed for the week&apos;s completed orders are tallied and
            emailed to you automatically. Settle via your usual payment channel (bank
            transfer/GCash) — Lunara will mark it paid once received.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading invoices…" />
      </div>
      {downloadError && <div className="alert-error mt-2">{downloadError}</div>}

      {data && (
        <>
          <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="stat-card col-span-2 sm:col-span-1">
              <p className="text-xs text-muted">Outstanding balance</p>
              <p className="text-2xl font-semibold text-slate-900">
                {receivable ? formatPeso(receivable.receivableBalance) : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                What you owe Lunara, from the accounting ledger
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Total billed</p>
              <p className="text-2xl font-semibold text-slate-900">{formatPeso(totalBilled)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{totalInvoices} invoice{totalInvoices === 1 ? '' : 's'}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Latest invoice</p>
              {data.length > 0 ? (
                <>
                  <p className="text-2xl font-semibold text-slate-900">{formatPeso(data[0].amountDue)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Due {formatDate(data[0].dueDate)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">No invoices yet</p>
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
              <p className="font-medium text-slate-700">No invoices yet</p>
              <p className="mt-1 text-sm text-muted">
                Lunara will generate an invoice once your completed orders for a period are ready
                to be billed.
              </p>
            </div>
          ) : (
            <div className="section-panel mt-8 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th>Invoice</th>
                    <th>Period</th>
                    <th>Orders</th>
                    <th>Status</th>
                    <th>Due</th>
                    <th className="text-right font-semibold">Amount due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.map((inv) => {
                    const isExpanded = expandedId === inv._id;
                    const isLoadingThis = ordersLoading === inv._id;
                    const orders = ordersCache[inv._id];
                    return (
                      <Fragment key={inv._id}>
                        <tr className="cursor-pointer hover:bg-slate-50"
                          onClick={() => void toggleOrders(inv)}
                        >
                          <td className="text-center text-xs text-muted">
                            <span
                              className="inline-block transition-transform duration-150"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                            >▶</span>
                          </td>
                          <td className="font-mono text-xs text-slate-900 whitespace-nowrap">{inv.invoiceNumber}</td>
                          <td className="text-slate-900 text-sm whitespace-nowrap">{formatDateRange(inv.periodStart, inv.periodEnd)}</td>
                          <td className="text-muted whitespace-nowrap">
                            {inv.totalOrders}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({inv.cashOrders}C / {inv.digitalOrders}D)
                            </span>
                          </td>
                          <td className="whitespace-nowrap">
                            {inv.status === 'paid' ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Paid</span>
                            ) : inv.status === 'void' ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Void</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>
                            )}
                          </td>
                          <td className="text-muted text-sm whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                          <td className="text-right font-semibold text-slate-900">{formatPeso(inv.amountDue)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              disabled={downloadingId === inv._id}
                              onClick={() => void downloadPdf(inv)}
                            >
                              {downloadingId === inv._id ? 'Downloading…' : 'PDF'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-slate-50/70 p-0">
                              <div className="border-t border-border/60 px-3 py-4 sm:px-5">
                                <div className="mb-4 grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                  <span className="text-muted">Total collected by you</span>
                                  <span className="text-right text-slate-900">{formatPeso(inv.totalCollected)}</span>
                                  <span className="text-muted">Lunara commission</span>
                                  <span className="text-right text-slate-900">{formatPeso(inv.commissionDue)}</span>
                                  {inv.riderCostDue ? (
                                    <>
                                      <span className="text-muted">Rider delivery cost</span>
                                      <span className="text-right text-slate-900">{formatPeso(inv.riderCostDue)}</span>
                                    </>
                                  ) : null}
                                  {inv.creditApplied ? (
                                    <>
                                      <span className="text-muted">Credit applied</span>
                                      <span className="text-right text-green-700">−{formatPeso(inv.creditApplied)}</span>
                                    </>
                                  ) : null}
                                  <span className="border-t border-border/60 pt-1 font-semibold text-slate-900">You owe</span>
                                  <span className="border-t border-border/60 pt-1 text-right font-semibold text-slate-900">{formatPeso(inv.amountDue)}</span>
                                </div>
                                {isLoadingThis && <p className="text-sm text-muted">Loading orders…</p>}
                                {!isLoadingThis && ordersError && <p className="text-sm text-destructive">{ordersError}</p>}
                                {!isLoadingThis && orders?.length === 0 && (
                                  <p className="text-sm text-muted">No orders found for this period.</p>
                                )}
                                {!isLoadingThis && orders && orders.length > 0 && (
                                  <div className="overflow-x-auto">
                                  <table className="w-full text-sm" style={{ minWidth: 'unset' }}>
                                    <thead>
                                      <tr className="text-left text-xs text-muted">
                                        <th className="pb-2 pr-4 font-medium">Completed</th>
                                        <th className="pb-2 pr-4 font-medium">Order ID</th>
                                        <th className="pb-2 pr-4 font-medium">Type</th>
                                        <th className="pb-2 pr-4 font-medium">Payment</th>
                                        <th className="pb-2 text-right font-medium">Collected</th>
                                        <th className="pb-2 text-right font-medium">Commission</th>
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
                                          <td className="py-1.5 text-right text-slate-900">{formatPeso(o.amount)}</td>
                                          <td className="py-1.5 text-right font-semibold text-slate-900">{formatPeso(o.commissionDue ?? 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-border/60 text-xs font-semibold">
                                        <td colSpan={4} className="pt-2 text-muted">{orders.length} order{orders.length === 1 ? '' : 's'} total</td>
                                        <td className="pt-2 text-right text-slate-900">{formatPeso(orders.reduce((sum, o) => sum + o.amount, 0))}</td>
                                        <td className="pt-2 text-right text-slate-900">{formatPeso(orders.reduce((sum, o) => sum + (o.commissionDue ?? 0), 0))}</td>
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

          {data.some((i) => i.adminNote) && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Admin notes</h3>
              {data.filter((i) => i.adminNote).map((i) => (
                <div key={i._id} className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium">{i.invoiceNumber}:</span> {i.adminNote}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
