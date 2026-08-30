'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PartnerInvoice } from '@lunara/types';
import { adminFetch, getAdminToken, getApiBaseUrl } from '../../../lib/admin-api';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface PartnerRow {
  _id: string;
  email?: string;
  phone?: string;
  branchNames?: string[];
}

function branchLabel(branchNames?: string[]): string | undefined {
  if (!branchNames || branchNames.length === 0) return undefined;
  if (branchNames.length <= 2) return branchNames.join(', ');
  return `${branchNames.length} shops`;
}

interface UninvoicedOrder {
  orderId: string;
  completedAt: string;
  amount: number;
  subtotal: number;
  commissionDue: number;
  commissionRate: number;
  bookingType: string;
  paymentMethod: string | null;
  cashCollected: boolean;
}

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CreateInvoiceModal({
  partnerId,
  partnerLabel,
  onClose,
  onCreated,
}: {
  partnerId: string;
  partnerLabel: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adminNote, setAdminNote] = useState('');
  const [applyCredit, setApplyCredit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(
    () => adminFetch<UninvoicedOrder[]>(`/admin/partners/${partnerId}/uninvoiced-orders`),
    [partnerId],
  );
  const { data: orders, error: loadError } = useAdminQuery(loadOrders, [partnerId]);

  const loadCredit = useCallback(
    () => adminFetch<{ outstanding: number }>(`/admin/partners/${partnerId}/credit-balance`),
    [partnerId],
  );
  const { data: credit } = useAdminQuery(loadCredit, [partnerId]);
  const outstandingCredit = credit?.outstanding ?? 0;

  useEffect(() => {
    if (orders) setSelected(new Set(orders.map((o) => o.orderId)));
  }, [orders]);

  const selectedOrders = orders?.filter((o) => selected.has(o.orderId)) ?? [];
  const totalCollected = selectedOrders.reduce((s, o) => s + o.amount, 0);
  const totalCommission = selectedOrders.reduce((s, o) => s + o.commissionDue, 0);

  function toggleAll() {
    if (!orders) return;
    setSelected(selected.size === orders.length ? new Set() : new Set(orders.map((o) => o.orderId)));
  }

  function toggle(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/admin/partners/${partnerId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: [...selected],
          adminNote: adminNote.trim() || undefined,
          applyCredit: applyCredit || undefined,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="dc-panel-header flex shrink-0 items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              {step === 'select' ? 'Select orders to invoice' : 'Confirm invoice'}
            </h2>
            <p className="text-xs text-muted">{partnerLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-slate-700">✕</button>
        </div>

        {step === 'select' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loadError && <div className="alert-error mb-3">{loadError}</div>}
              {!orders && !loadError && <p className="text-sm text-muted">Loading orders…</p>}
              {orders?.length === 0 && (
                <p className="text-sm text-muted">No uninvoiced completed orders for this partner.</p>
              )}
              {orders && orders.length > 0 && (
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="w-8">
                        <input type="checkbox" checked={selected.size === orders.length} onChange={toggleAll} className="cursor-pointer" />
                      </th>
                      <th>Completed</th>
                      <th>Order</th>
                      <th>Type</th>
                      <th>Payment</th>
                      <th className="text-right">Collected</th>
                      <th className="text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.orderId} className="cursor-pointer hover:bg-slate-50" onClick={() => toggle(o.orderId)}>
                        <td>
                          <input type="checkbox" checked={selected.has(o.orderId)} onChange={() => toggle(o.orderId)} onClick={(e) => e.stopPropagation()} className="cursor-pointer" />
                        </td>
                        <td className="text-muted">
                          {new Date(o.completedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="font-mono text-xs text-slate-600">…{o.orderId.slice(-6)}</td>
                        <td className="capitalize text-muted">{o.bookingType.replace(/_/g, ' ')}</td>
                        <td className="capitalize text-muted">{o.paymentMethod ?? '—'}</td>
                        <td className="text-right">{formatPeso(o.amount)}</td>
                        <td className="text-right font-medium text-slate-900">{formatPeso(o.commissionDue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {orders && orders.length > 0 && (
              <div className="dc-panel-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-t">
                <p className="text-sm text-muted">
                  {selected.size} of {orders.length} order{orders.length !== 1 ? 's' : ''} selected
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted">Collected: <span className="font-medium text-slate-900">{formatPeso(totalCollected)}</span></span>
                  <span className="text-muted">Commission: <span className="font-semibold text-slate-900">{formatPeso(totalCommission)}</span></span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
                  <button type="button" disabled={selected.size === 0} className="btn-primary btn-sm disabled:opacity-50" onClick={() => setStep('confirm')}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'confirm' && (
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Orders</span>
                <span className="font-medium text-slate-900">{selectedOrders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Collected by partner (info only)</span>
                <span className="font-medium text-slate-900">{formatPeso(totalCollected)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-slate-900">
                  Commission due
                  {new Set(selectedOrders.map((o) => o.commissionRate)).size > 1
                    ? ' (mixed rates)'
                    : ` (${Math.round((selectedOrders[0]?.commissionRate ?? 0.2) * 100)}%)`}
                </span>
                <span className="font-bold text-slate-900">{formatPeso(totalCommission)}</span>
              </div>
              <p className="pt-1 text-xs text-muted">
                The final amount due will also include the actual rider pickup/delivery cost Lunara
                fronts for these orders (looked up at invoicing time) — shown on the invoice once
                created.
              </p>
            </div>

            {outstandingCredit > 0 && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={applyCredit}
                  onChange={(e) => setApplyCredit(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-900">
                    Apply outstanding credit — {formatPeso(outstandingCredit)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    This partner has {formatPeso(outstandingCredit)} of credit from refunds on
                    orders in earlier invoices. Check this to deduct it from this invoice instead
                    of leaving it outstanding.
                  </span>
                </span>
              </label>
            )}

            <div>
              <label className="form-label">Admin note <span className="font-normal text-muted">(optional)</span></label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                placeholder="e.g. Manual invoice for a missed period"
                className="input-field w-full resize-none"
              />
            </div>

            {error && <div className="alert-error">{error}</div>}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={() => setStep('select')} className="btn-outline btn-sm">← Back</button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
                <button type="button" disabled={saving} className="btn-primary btn-sm disabled:opacity-50" onClick={handleConfirm}>
                  {saving ? 'Saving…' : 'Create invoice'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MarkPaidModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: PartnerInvoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paymentReference, setPaymentReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/admin/invoices/${invoice._id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentReference: paymentReference.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice paid');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="dc-panel-header flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Mark {invoice.invoiceNumber} as paid</h2>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-slate-700">✕</button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted">
            Amount due: <span className="font-semibold text-slate-900">{formatPeso(invoice.amountDue)}</span>
          </p>
          <div>
            <label className="form-label">Payment reference <span className="font-normal text-muted">(optional)</span></label>
            <input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. GCash ref # or bank transfer ID"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="form-label">Note <span className="font-normal text-muted">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="input-field w-full resize-none"
            />
          </div>
          {error && <div className="alert-error">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
            <button type="button" disabled={saving} className="btn-primary btn-sm disabled:opacity-50" onClick={handleSave}>
              {saving ? 'Saving…' : 'Mark paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartnerInvoicesPage() {
  const [selectedPartner, setSelectedPartner] = useState<PartnerRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<PartnerInvoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const loadPartners = useCallback(async () => {
    const res = await adminFetch<{ shops: PartnerRow[] }>('/admin/shops');
    return res.shops ?? [];
  }, []);

  const { data: partners, loading: partnersLoading, error: partnersError } = useAdminQuery(loadPartners, []);

  const loadInvoices = useCallback(async () => {
    if (!selectedPartner) return [] as PartnerInvoice[];
    return adminFetch<PartnerInvoice[]>(`/admin/partners/${selectedPartner._id}/invoices`);
  }, [selectedPartner]);

  const { data: invoices, loading: invoicesLoading, reload: reloadInvoices } = useAdminQuery(
    loadInvoices,
    [selectedPartner],
  );

  const partnerLabel = selectedPartner
    ? (branchLabel(selectedPartner.branchNames) ?? selectedPartner.email ?? selectedPartner._id)
    : '';

  async function downloadPdf(inv: PartnerInvoice) {
    setDownloadingId(inv._id);
    setDownloadError('');
    try {
      const token = getAdminToken();
      const res = await fetch(`${getApiBaseUrl()}/admin/invoices/${inv._id}/pdf`, {
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
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Failed to download invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Partner invoices
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Partners collect payment directly from customers. Create an invoice to bill a
              partner for Lunara&apos;s commission and any rider costs fronted on their behalf,
              then mark it paid once they settle it via bank transfer/GCash.
            </p>
          </div>
          {selectedPartner && (
            <button type="button" className="btn-primary btn-sm" onClick={() => setShowModal(true)}>
              + Create invoice
            </button>
          )}
        </div>
      </header>

      {downloadError && <div className="alert-error mb-3">{downloadError}</div>}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* ── Partner list ────────────────────────────────────────── */}
        <section className="dc-panel self-start">
          <div className="dc-panel-header">
            <h2 className="text-sm font-semibold text-slate-900">Partners</h2>
          </div>
          {partnersLoading && <p className="px-3 py-4 text-sm text-muted">Loading…</p>}
          {partnersError && <div className="alert-error m-3">{partnersError}</div>}
          {partners?.length === 0 && <p className="px-3 py-4 text-sm text-muted">No partners found.</p>}
          <div className="divide-y divide-border/50">
            {partners?.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => setSelectedPartner(p)}
                className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                  selectedPartner?._id === p._id ? 'bg-primary/5 font-medium text-primary' : 'text-slate-700'
                }`}
              >
                {branchLabel(p.branchNames) ?? p.email ?? p._id}
                {p.email && branchLabel(p.branchNames) && (
                  <span className="mt-0.5 block text-xs text-muted">{p.email}</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Invoice history ───────────────────────────────────── */}
        <div>
          {!selectedPartner ? (
            <div className="dc-panel dc-panel-empty text-center text-sm text-muted">
              Select a partner to view their invoices.
            </div>
          ) : (
            <section className="dc-panel">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{partnerLabel}</h2>
                  {invoices && (
                    <p className="text-xs text-muted">
                      {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {invoicesLoading && <p className="dc-panel-body text-sm text-muted">Loading invoices…</p>}

              {invoices?.length === 0 && (
                <div className="dc-panel-empty text-center">
                  <p className="font-medium text-slate-900">No invoices yet</p>
                  <p className="mt-1 text-sm text-muted">Create the first invoice for this partner&apos;s completed orders.</p>
                </div>
              )}

              {invoices && invoices.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Period</th>
                          <th>Orders</th>
                          <th>Status</th>
                          <th>Due</th>
                          <th className="text-right">Collected</th>
                          <th className="text-right">Commission</th>
                          <th className="text-right">Rider cost</th>
                          <th className="text-right">Subscription</th>
                          <th className="text-right">Amount due</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv._id}>
                            <td className="font-mono text-xs text-slate-600">{inv.invoiceNumber}</td>
                            <td className="text-sm text-slate-900">{formatDateRange(inv.periodStart, inv.periodEnd)}</td>
                            <td className="text-sm text-muted">
                              {inv.totalOrders}
                              <span className="ml-1 text-xs">({inv.cashOrders}C / {inv.digitalOrders}D)</span>
                            </td>
                            <td>
                              {inv.status === 'paid' ? (
                                <span className="badge-accent">Paid</span>
                              ) : inv.status === 'void' ? (
                                <span className="badge-neutral">Void</span>
                              ) : (
                                <span className="badge-warning">Pending</span>
                              )}
                              {inv.emailError && (
                                <span className="mt-0.5 block text-xs text-rose-600" title={inv.emailError}>
                                  Email failed
                                </span>
                              )}
                              {!inv.emailError && inv.emailedAt && (
                                <span className="mt-0.5 block text-xs text-muted">Emailed</span>
                              )}
                            </td>
                            <td className="text-sm text-muted">{formatDate(inv.dueDate)}</td>
                            <td className="text-right text-muted">{formatPeso(inv.totalCollected)}</td>
                            <td className="text-right text-sm text-slate-900">
                              {formatPeso(inv.commissionDue)}
                              {inv.commissionRate != null && (
                                <span className="ml-1 text-xs text-muted">({Math.round(inv.commissionRate * 100)}%)</span>
                              )}
                            </td>
                            <td className="text-right text-sm text-slate-900">
                              {inv.riderCostDue ? formatPeso(inv.riderCostDue) : '—'}
                            </td>
                            <td className="text-right text-sm text-slate-900">
                              {inv.subscriptionFeeDue ? formatPeso(inv.subscriptionFeeDue) : '—'}
                            </td>
                            <td className="text-right font-semibold text-slate-900">
                              {formatPeso(inv.amountDue)}
                              {inv.creditApplied ? (
                                <span className="mt-0.5 block text-xs font-normal text-green-700">
                                  net of {formatPeso(inv.creditApplied)} credit applied
                                </span>
                              ) : null}
                              {inv.creditTotal ? (
                                <span className="mt-0.5 block text-xs font-normal text-muted">
                                  {formatPeso(inv.creditTotal - (inv.creditRecovered ?? 0))} credit outstanding from {inv.creditOrderCount} refund{inv.creditOrderCount !== 1 ? 's' : ''}
                                </span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap text-right">
                              <button
                                type="button"
                                className="btn-outline btn-sm mr-1.5"
                                disabled={downloadingId === inv._id}
                                onClick={() => void downloadPdf(inv)}
                              >
                                {downloadingId === inv._id ? '…' : 'PDF'}
                              </button>
                              {inv.status === 'pending' && (
                                <button
                                  type="button"
                                  className="btn-primary btn-sm"
                                  onClick={() => setPayingInvoice(inv)}
                                >
                                  Mark paid
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
                          <td className="text-slate-900">Total</td>
                          <td className="text-muted">{invoices.reduce((s, r) => s + r.totalOrders, 0)}</td>
                          <td /><td /><td />
                          <td className="text-right text-muted">{formatPeso(invoices.reduce((s, r) => s + r.totalCollected, 0))}</td>
                          <td className="text-right text-slate-900">{formatPeso(invoices.reduce((s, r) => s + r.commissionDue, 0))}</td>
                          <td className="text-right text-slate-900">{formatPeso(invoices.reduce((s, r) => s + (r.riderCostDue ?? 0), 0))}</td>
                          <td className="text-right text-slate-900">{formatPeso(invoices.reduce((s, r) => s + (r.subscriptionFeeDue ?? 0), 0))}</td>
                          <td className="text-right text-slate-900">{formatPeso(invoices.reduce((s, r) => s + r.amountDue, 0))}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {invoices.some((inv) => inv.adminNote) && (
                    <div className="dc-panel-body space-y-1.5 border-t border-border/60">
                      {invoices.filter((inv) => inv.adminNote).map((inv) => (
                        <p key={inv._id} className="text-xs text-muted">
                          <span className="font-medium text-slate-700">{inv.invoiceNumber}:</span>{' '}
                          {inv.adminNote}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {showModal && selectedPartner && (
        <CreateInvoiceModal
          partnerId={selectedPartner._id}
          partnerLabel={partnerLabel}
          onClose={() => setShowModal(false)}
          onCreated={reloadInvoices}
        />
      )}

      {payingInvoice && (
        <MarkPaidModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSaved={reloadInvoices}
        />
      )}
    </div>
  );
}
