'use client';

import { useCallback, useMemo, useState } from 'react';
import { adminFetch } from '../../../lib/admin-api';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface Plan {
  _id: string;
  key: string;
  name: string;
}

interface Promotion {
  _id: string;
  code: string;
  name: string;
  discountType: 'percentage' | 'fixed' | 'free_months';
  discountValue: number;
  applicablePlanIds: string[];
  maxRedemptions?: number;
  redemptionCount: number;
  expiresAt?: string;
  isActive: boolean;
}

function formatDiscount(p: Pick<Promotion, 'discountType' | 'discountValue'>) {
  if (p.discountType === 'percentage') return `${p.discountValue}% off`;
  if (p.discountType === 'fixed') return `${formatPeso(p.discountValue)} off`;
  return `${p.discountValue} free month${p.discountValue !== 1 ? 's' : ''}`;
}

function PromotionFormModal({
  plans,
  onClose,
  onSaved,
}: {
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<Promotion['discountType']>('free_months');
  const [discountValue, setDiscountValue] = useState('1');
  const [planIds, setPlanIds] = useState<Set<string>>(new Set());
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePlan(id: string) {
    setPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await adminFetch('/admin/billing/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          discountType,
          discountValue: Number(discountValue) || 0,
          applicablePlanIds: planIds.size > 0 ? [...planIds] : undefined,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save promo code');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="dc-panel-header flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">New promo code</h2>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-slate-700">✕</button>
        </div>
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          <div>
            <label className="form-label">Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. FOUNDING6"
              className="input-field w-full font-mono"
            />
          </div>
          <div>
            <label className="form-label">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Founding partner — 6 free months"
              className="input-field w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Discount type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as Promotion['discountType'])}
                className="input-field w-full"
              >
                <option value="free_months">Free months</option>
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </div>
            <div>
              <label className="form-label">
                {discountType === 'free_months' ? 'Months' : discountType === 'percentage' ? 'Percent' : 'Amount (₱)'}
              </label>
              <input
                type="number"
                min={1}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Applies to plans <span className="font-normal text-muted">(none checked = all plans)</span></label>
            <div className="space-y-1 rounded-lg border border-border p-2.5">
              {plans.map((p) => (
                <label key={p._id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={planIds.has(p._id)} onChange={() => togglePlan(p._id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Max redemptions <span className="font-normal text-muted">(optional)</span></label>
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">Expires <span className="font-normal text-muted">(optional)</span></label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>
          {error && <div className="alert-error">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
            <button
              type="button"
              disabled={saving || !code.trim() || !name.trim()}
              className="btn-primary btn-sm disabled:opacity-50"
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Create promo code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromoCodesPage() {
  const [showModal, setShowModal] = useState(false);

  const loadPromotions = useCallback(() => adminFetch<Promotion[]>('/admin/billing/promotions'), []);
  const { data: promotions, loading, error, reload } = useAdminQuery(loadPromotions, []);

  const loadPlans = useCallback(() => adminFetch<Plan[]>('/admin/billing/plans?includeInactive=true'), []);
  const { data: plans } = useAdminQuery(loadPlans, []);

  const planNameById = useMemo(() => new Map((plans ?? []).map((p) => [p._id, p.name])), [plans]);

  async function toggleActive(p: Promotion) {
    await adminFetch(`/admin/billing/promotions/${p._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await reload();
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Promo codes
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Subscription discount codes — founding-partner pricing and similar offers. Partners
              redeem these themselves from their billing settings, or you can apply one directly
              to a partner&apos;s subscription.
            </p>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowModal(true)}>
            + New promo code
          </button>
        </div>
      </header>

      {error && <div className="alert-error mb-3">{error}</div>}

      <section className="dc-panel">
        {loading && <p className="dc-panel-body text-sm text-muted">Loading promo codes…</p>}
        {promotions?.length === 0 && (
          <div className="dc-panel-empty text-center">
            <p className="font-medium text-slate-900">No promo codes yet</p>
            <p className="mt-1 text-sm text-muted">Create one to offer founding-partner pricing or a limited-time discount.</p>
          </div>
        )}
        {promotions && promotions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Discount</th>
                  <th>Plans</th>
                  <th className="text-right">Redemptions</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p._id}>
                    <td className="font-mono text-xs text-slate-600">{p.code}</td>
                    <td className="text-sm font-medium text-slate-900">{p.name}</td>
                    <td className="text-sm text-slate-900">{formatDiscount(p)}</td>
                    <td className="text-sm text-muted">
                      {p.applicablePlanIds.length === 0
                        ? 'All plans'
                        : p.applicablePlanIds.map((id) => planNameById.get(id) ?? id).join(', ')}
                    </td>
                    <td className="text-right text-sm text-slate-900">
                      {p.redemptionCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}
                    </td>
                    <td>{p.isActive ? <span className="badge-accent">Active</span> : <span className="badge-neutral">Inactive</span>}</td>
                    <td className="text-right">
                      <button type="button" className="btn-outline btn-sm" onClick={() => void toggleActive(p)}>
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <PromotionFormModal plans={plans ?? []} onClose={() => setShowModal(false)} onSaved={reload} />
      )}
    </div>
  );
}
