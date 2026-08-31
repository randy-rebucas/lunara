'use client';

import { useCallback, useState } from 'react';
import { adminFetch } from '../../../lib/admin-api';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'grace_period' | 'suspended' | 'cancelled' | 'expired';

interface SubscriptionRow {
  _id: string;
  partnerId: string;
  partnerEmail?: string;
  partnerPhone?: string;
  planName?: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  priceSnapshot: number;
  provider: 'manual' | 'paymongo';
  paymentMethodOnFile: boolean;
  cardBrand?: string;
  cardLast4?: string;
  adminNote?: string;
}

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  trialing: 'badge-neutral',
  active: 'badge-accent',
  past_due: 'badge-warning',
  grace_period: 'badge-warning',
  suspended: 'badge-danger',
  cancelled: 'badge-neutral',
  expired: 'badge-neutral',
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  grace_period: 'Grace period',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const NEEDS_ATTENTION: SubscriptionStatus[] = ['past_due', 'grace_period', 'suspended'];

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RecordPaymentModal({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: SubscriptionRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amountPhp, setAmountPhp] = useState(String(subscription.priceSnapshot || ''));
  const [paymentReference, setPaymentReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const amount = Number(amountPhp);
    if (!amount || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/admin/partners/${subscription.partnerId}/subscription/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPhp: amount,
          paymentReference: paymentReference.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="dc-panel-header flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Record subscription payment</h2>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-slate-700">✕</button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted">
            {subscription.partnerEmail ?? subscription.partnerId} — {subscription.planName ?? 'plan'}
          </p>
          <p className="text-xs text-muted">
            Recording a payment advances the billing period by one month (new renewal date{' '}
            <span className="font-medium text-slate-700">
              {(() => {
                const next = new Date(subscription.currentPeriodEnd);
                next.setMonth(next.getMonth() + 1);
                return formatDate(next.toISOString());
              })()}
            </span>
            ) and immediately reactivates the account if it was past due or suspended.
          </p>
          <div>
            <label className="form-label">Amount received (₱)</label>
            <input
              type="number"
              min={0}
              value={amountPhp}
              onChange={(e) => setAmountPhp(e.target.value)}
              className="input-field w-full"
            />
          </div>
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
              {saving ? 'Saving…' : 'Record payment & renew'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartnerSubscriptionsPage() {
  const [payingSubscription, setPayingSubscription] = useState<SubscriptionRow | null>(null);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');

  const loadSubscriptions = useCallback(() => adminFetch<SubscriptionRow[]>('/admin/billing/subscriptions'), []);
  const { data: subscriptions, loading, error, reload } = useAdminQuery(loadSubscriptions, []);

  const rows = subscriptions?.filter((s) => (filter === 'attention' ? NEEDS_ATTENTION.includes(s.status) : true)) ?? [];
  const attentionCount = subscriptions?.filter((s) => NEEDS_ATTENTION.includes(s.status)).length ?? 0;

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Subscriptions</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Every partner&apos;s SaaS subscription and billing period. Use &quot;Record payment&quot; to
              settle a payment received outside the normal invoice cycle (bank transfer, cash, GCash) —
              it renews the billing period and reactivates the account immediately, without waiting for
              a pending invoice.
            </p>
          </div>
        </div>
      </header>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className={filter === 'all' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={filter === 'attention' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
          onClick={() => setFilter('attention')}
        >
          Needs attention{attentionCount > 0 ? ` (${attentionCount})` : ''}
        </button>
      </div>

      {error && <div className="alert-error mb-3">{error}</div>}

      <section className="dc-panel">
        {loading && <p className="dc-panel-body text-sm text-muted">Loading subscriptions…</p>}
        {rows.length === 0 && !loading && (
          <div className="dc-panel-empty text-center">
            <p className="font-medium text-slate-900">
              {filter === 'attention' ? 'Nothing needs attention' : 'No subscriptions yet'}
            </p>
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Period end</th>
                  <th className="text-right">Price</th>
                  <th>Payment method</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s._id}>
                    <td className="text-sm text-slate-900">
                      {s.partnerEmail ?? s.partnerId}
                      {s.partnerPhone && <span className="mt-0.5 block text-xs text-muted">{s.partnerPhone}</span>}
                    </td>
                    <td className="text-sm text-muted">{s.planName ?? '—'}</td>
                    <td>
                      <span className={STATUS_BADGE[s.status]}>{STATUS_LABEL[s.status]}</span>
                    </td>
                    <td className="text-sm text-muted">{formatDate(s.currentPeriodEnd)}</td>
                    <td className="text-right text-sm text-slate-900">{formatPeso(s.priceSnapshot)}</td>
                    <td className="text-sm text-muted">
                      {s.paymentMethodOnFile
                        ? `${s.cardBrand ?? 'Card'} •••• ${s.cardLast4 ?? ''}`
                        : 'None on file'}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" className="btn-primary btn-sm" onClick={() => setPayingSubscription(s)}>
                        Record payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {payingSubscription && (
        <RecordPaymentModal
          subscription={payingSubscription}
          onClose={() => setPayingSubscription(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
