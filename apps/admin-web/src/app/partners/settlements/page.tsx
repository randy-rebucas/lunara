'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PartnerSettlement } from '@lunara/types';
import { adminFetch } from '../../../lib/admin-api';
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

interface UnsettledOrder {
  orderId: string;
  completedAt: string;
  amount: number;
  subtotal: number;
  lunaraFee: number;
  partnerPayout: number;
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

function CreateSettlementModal({
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
  const [orders, setOrders] = useState<UnsettledOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<UnsettledOrder[]>(`/admin/partners/${partnerId}/unsettled-orders`)
      .then((res) => {
        setOrders(res);
        setSelected(new Set(res.map((o) => o.orderId)));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load orders'));
  }, [partnerId]);

  const selectedOrders = orders?.filter((o) => selected.has(o.orderId)) ?? [];
  const totalGross  = selectedOrders.reduce((s, o) => s + o.amount, 0);
  const totalFee    = selectedOrders.reduce((s, o) => s + o.lunaraFee, 0);
  const totalPayout = selectedOrders.reduce((s, o) => s + o.partnerPayout, 0);

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
      await adminFetch(`/admin/partners/${partnerId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [...selected], adminNote: adminNote.trim() || undefined }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create settlement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="dc-panel-header flex shrink-0 items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              {step === 'select' ? 'Select orders to settle' : 'Confirm settlement'}
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
                <p className="text-sm text-muted">No unsettled completed orders for this partner.</p>
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
                      <th className="text-right">Amount</th>
                      <th className="text-right">Payout</th>
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
                        <td className="text-right font-medium text-slate-900">{formatPeso(o.partnerPayout)}</td>
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
                  <span className="text-muted">Gross: <span className="font-medium text-slate-900">{formatPeso(totalGross)}</span></span>
                  <span className="text-muted">Fee: <span className="font-medium text-rose-600">+{formatPeso(totalFee)}</span></span>
                  <span className="text-muted">Payout: <span className="font-semibold text-slate-900">{formatPeso(totalPayout)}</span></span>
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
                <span className="text-muted">Gross revenue</span>
                <span className="font-medium text-slate-900">{formatPeso(totalGross)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">
                  Lunara fee
                  {new Set(selectedOrders.map((o) => o.commissionRate)).size > 1
                    ? ' (mixed rates)'
                    : ` (${Math.round((selectedOrders[0]?.commissionRate ?? 0.2) * 100)}%)`}
                </span>
                <span className="font-medium text-rose-600">+{formatPeso(totalFee)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-slate-900">Partner payout</span>
                <span className="font-bold text-slate-900">{formatPeso(totalPayout)}</span>
              </div>
            </div>

            <div>
              <label className="form-label">Admin note <span className="font-normal text-muted">(optional)</span></label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                placeholder="e.g. Cash remitted via GCash transfer"
                className="input-field w-full resize-none"
              />
            </div>

            {error && <div className="alert-error">{error}</div>}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={() => setStep('select')} className="btn-outline btn-sm">← Back</button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
                <button type="button" disabled={saving} className="btn-primary btn-sm disabled:opacity-50" onClick={handleConfirm}>
                  {saving ? 'Saving…' : 'Create settlement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartnerSettlementsPage() {
  const [selectedPartner, setSelectedPartner] = useState<PartnerRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadPartners = useCallback(async () => {
    const res = await adminFetch<{ shops: PartnerRow[] }>('/admin/shops');
    return res.shops ?? [];
  }, []);

  const { data: partners, loading: partnersLoading, error: partnersError } = useAdminQuery(loadPartners, []);

  const loadSettlements = useCallback(async () => {
    if (!selectedPartner) return [] as PartnerSettlement[];
    return adminFetch<PartnerSettlement[]>(`/admin/partners/${selectedPartner._id}/settlements`);
  }, [selectedPartner]);

  const { data: settlements, loading: settlementsLoading, reload: reloadSettlements } = useAdminQuery(
    loadSettlements,
    [selectedPartner],
  );

  const partnerLabel = selectedPartner
    ? (branchLabel(selectedPartner.branchNames) ?? selectedPartner.email ?? selectedPartner._id)
    : '';

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Partner settlements
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Create settlement records after remitting cash to a partner. Partners can view these in their portal.
            </p>
          </div>
          {selectedPartner && (
            <button type="button" className="btn-primary btn-sm" onClick={() => setShowModal(true)}>
              + Create settlement
            </button>
          )}
        </div>
      </header>

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

        {/* ── Settlement history ───────────────────────────────────── */}
        <div>
          {!selectedPartner ? (
            <div className="dc-panel dc-panel-empty text-center text-sm text-muted">
              Select a partner to view their settlements.
            </div>
          ) : (
            <section className="dc-panel">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{partnerLabel}</h2>
                  {settlements && (
                    <p className="text-xs text-muted">
                      {settlements.length} settlement{settlements.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {settlementsLoading && <p className="dc-panel-body text-sm text-muted">Loading settlements…</p>}

              {settlements?.length === 0 && (
                <div className="dc-panel-empty text-center">
                  <p className="font-medium text-slate-900">No settlements yet</p>
                  <p className="mt-1 text-sm text-muted">Create the first settlement after completing a cash remittance.</p>
                </div>
              )}

              {settlements && settlements.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Orders</th>
                          <th>Status</th>
                          <th>Paid on</th>
                          <th className="text-right">Gross</th>
                          <th className="text-right">Lunara fee</th>
                          <th className="text-right">Partner payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlements.map((s) => (
                          <tr key={s._id}>
                            <td className="text-sm text-slate-900">{formatDateRange(s.periodStart, s.periodEnd)}</td>
                            <td className="text-sm text-muted">
                              {s.totalOrders}
                              <span className="ml-1 text-xs">({s.cashOrders}C / {s.digitalOrders}D)</span>
                            </td>
                            <td>
                              {s.status === 'paid' ? (
                                <span className="badge-accent">Paid</span>
                              ) : (
                                <span className="badge-warning">Pending</span>
                              )}
                            </td>
                            <td className="text-sm text-muted">
                              {s.paidAt
                                ? new Date(s.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                            </td>
                            <td className="text-right text-muted">{formatPeso(s.totalAmount)}</td>
                            <td className="text-right text-sm text-rose-600">
                              +{formatPeso(s.lunaraFee ?? 0)}
                              {s.commissionRate != null && (
                                <span className="ml-1 text-xs text-muted">({Math.round(s.commissionRate * 100)}%)</span>
                              )}
                            </td>
                            <td className="text-right font-semibold text-slate-900">
                              {formatPeso(s.partnerPayout ?? s.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
                          <td className="text-slate-900">Total</td>
                          <td className="text-muted">{settlements.reduce((s, r) => s + r.totalOrders, 0)}</td>
                          <td /><td />
                          <td className="text-right text-muted">{formatPeso(settlements.reduce((s, r) => s + r.totalAmount, 0))}</td>
                          <td className="text-right text-rose-600">+{formatPeso(settlements.reduce((s, r) => s + (r.lunaraFee ?? 0), 0))}</td>
                          <td className="text-right text-slate-900">{formatPeso(settlements.reduce((s, r) => s + (r.partnerPayout ?? r.totalAmount), 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {settlements.some((s) => s.adminNote) && (
                    <div className="dc-panel-body space-y-1.5 border-t border-border/60">
                      {settlements.filter((s) => s.adminNote).map((s) => (
                        <p key={s._id} className="text-xs text-muted">
                          <span className="font-medium text-slate-700">{formatDateRange(s.periodStart, s.periodEnd)}:</span>{' '}
                          {s.adminNote}
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
        <CreateSettlementModal
          partnerId={selectedPartner._id}
          partnerLabel={partnerLabel}
          onClose={() => setShowModal(false)}
          onCreated={reloadSettlements}
        />
      )}
    </div>
  );
}
