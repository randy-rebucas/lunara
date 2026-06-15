'use client';

import { useCallback, useState } from 'react';
import type { PartnerSettlement } from '@lunara/types';
import { adminFetch } from '../../../lib/admin-api';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface PartnerRow {
  _id: string;
  email?: string;
  phone?: string;
  branchName?: string;
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
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/admin/partners/${partnerId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart, periodEnd, adminNote: adminNote.trim() || undefined }),
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create settlement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-slate-900">Create settlement</h2>
          <p className="mt-0.5 text-sm text-muted">{partnerLabel}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Period start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Period end</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin note (optional)</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={2}
              placeholder="e.g. Cash remitted via GCash transfer"
              className="input w-full resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline btn-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary btn-sm">
              {saving ? 'Saving…' : 'Mark as settled'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PartnerSettlementsPage() {
  const [selectedPartner, setSelectedPartner] = useState<PartnerRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadPartners = useCallback(async () => {
    const res = await adminFetch<{ data: { shops: PartnerRow[] } }>('/admin/shops');
    return res.data?.shops ?? [];
  }, []);

  const { data: partners, loading: partnersLoading, error: partnersError } = useAdminQuery(loadPartners, []);

  const loadSettlements = useCallback(async () => {
    if (!selectedPartner) return [] as PartnerSettlement[];
    const res = await adminFetch<{ data: PartnerSettlement[] }>(
      `/admin/partners/${selectedPartner._id}/settlements`,
    );
    return res.data ?? [];
  }, [selectedPartner]);

  const {
    data: settlements,
    loading: settlementsLoading,
    reload: reloadSettlements,
  } = useAdminQuery(loadSettlements, [selectedPartner]);

  const partnerLabel = selectedPartner
    ? selectedPartner.branchName ?? selectedPartner.email ?? selectedPartner._id
    : '';

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Partner settlements</h1>
        <p className="mt-1 text-sm text-muted">
          Create settlement records after remitting cash to a partner. Partners can view these in their portal.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Partner list */}
        <div className="section-panel p-0 overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-slate-700">Partners</h2>
          </div>
          {partnersLoading && (
            <p className="px-4 py-4 text-sm text-muted">Loading…</p>
          )}
          {partnersError && (
            <p className="px-4 py-4 text-sm text-red-600">Failed to load partners</p>
          )}
          {partners && partners.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted">No partners found</p>
          )}
          {partners?.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => setSelectedPartner(p)}
              className={`w-full px-4 py-3 text-left text-sm border-b border-border/50 hover:bg-slate-50 transition-colors ${
                selectedPartner?._id === p._id ? 'bg-primary/5 font-medium text-primary' : 'text-slate-700'
              }`}
            >
              {p.branchName ?? p.email ?? p._id}
              {p.email && p.branchName && (
                <span className="block text-xs text-muted mt-0.5">{p.email}</span>
              )}
            </button>
          ))}
        </div>

        {/* Settlement history */}
        <div>
          {!selectedPartner ? (
            <div className="rounded-xl border border-border bg-slate-50 p-8 text-center text-sm text-muted">
              Select a partner to view their settlements
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{partnerLabel}</h2>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setShowModal(true)}
                >
                  + Create settlement
                </button>
              </div>

              {settlementsLoading && (
                <p className="text-sm text-muted">Loading settlements…</p>
              )}

              {settlements && settlements.length === 0 && (
                <div className="rounded-xl border border-border bg-slate-50 p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No settlements yet</p>
                  <p className="mt-1 text-xs text-muted">
                    Create the first settlement after completing a cash remittance.
                  </p>
                </div>
              )}

              {settlements && settlements.length > 0 && (
                <div className="section-panel overflow-hidden">
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
                          <td className="text-slate-900 text-sm">
                            {formatDateRange(s.periodStart, s.periodEnd)}
                          </td>
                          <td className="text-muted text-sm">
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
                              ? new Date(s.paidAt).toLocaleDateString('en-PH', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="text-right text-muted">{formatPeso(s.totalAmount)}</td>
                          <td className="text-right text-rose-600 text-sm">
                            +{formatPeso(s.lunaraFee ?? 0)}
                            {s.commissionRate != null && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({Math.round(s.commissionRate * 100)}%)
                              </span>
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
                        <td className="text-muted">
                          {settlements.reduce((s, r) => s + r.totalOrders, 0)}
                        </td>
                        <td />
                        <td />
                        <td className="text-right text-muted">
                          {formatPeso(settlements.reduce((s, r) => s + r.totalAmount, 0))}
                        </td>
                        <td className="text-right text-rose-600">
                          +{formatPeso(settlements.reduce((s, r) => s + (r.lunaraFee ?? 0), 0))}
                        </td>
                        <td className="text-right text-slate-900">
                          {formatPeso(settlements.reduce((s, r) => s + (r.partnerPayout ?? r.totalAmount), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  {settlements.some((s) => s.adminNote) && (
                    <div className="border-t border-border px-4 py-3 space-y-2">
                      {settlements.filter((s) => s.adminNote).map((s) => (
                        <p key={s._id} className="text-xs text-muted">
                          <span className="font-medium text-slate-700">
                            {formatDateRange(s.periodStart, s.periodEnd)}:
                          </span>{' '}
                          {s.adminNote}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
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
