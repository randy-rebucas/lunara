'use client';

import { useCallback, useState } from 'react';
import { adminFetch } from '../../../lib/admin-api';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface Plan {
  _id: string;
  key: string;
  name: string;
  monthlyPrice: number;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
}

function PlanFormModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key, setKey] = useState(plan?.key ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [monthlyPrice, setMonthlyPrice] = useState(String(plan?.monthlyPrice ?? 0));
  const [trialDays, setTrialDays] = useState(String(plan?.trialDays ?? 0));
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        monthlyPrice: Number(monthlyPrice) || 0,
        trialDays: Number(trialDays) || 0,
        isActive,
      };
      if (plan) {
        await adminFetch(`/admin/billing/plans/${plan._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await adminFetch('/admin/billing/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, key: key.trim() }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="dc-panel-header flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{plan ? `Edit ${plan.name}` : 'New plan'}</h2>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-slate-700">✕</button>
        </div>
        <div className="space-y-3 p-4">
          {!plan && (
            <div>
              <label className="form-label">Key</label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. professional"
                className="input-field w-full"
              />
            </div>
          )}
          <div>
            <label className="form-label">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Monthly price (₱)</label>
              <input
                type="number"
                min={0}
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">Trial days</label>
              <input
                type="number"
                min={0}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active (selectable for new/existing subscriptions)
          </label>
          {error && <div className="alert-error">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
            <button
              type="button"
              disabled={saving || !name.trim() || (!plan && !key.trim())}
              className="btn-primary btn-sm disabled:opacity-50"
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [editingPlan, setEditingPlan] = useState<Plan | 'new' | null>(null);

  const loadPlans = useCallback(() => adminFetch<Plan[]>('/admin/billing/plans?includeInactive=true'), []);
  const { data: plans, loading, error, reload } = useAdminQuery(loadPlans, []);

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Plans</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Subscription tiers partners can be assigned to. Editing a plan&apos;s price only
              affects new/renewing subscriptions — invoices already billed keep the price
              snapshot they were charged at.
            </p>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => setEditingPlan('new')}>
            + New plan
          </button>
        </div>
      </header>

      {error && <div className="alert-error mb-3">{error}</div>}

      <section className="dc-panel">
        {loading && <p className="dc-panel-body text-sm text-muted">Loading plans…</p>}
        {plans?.length === 0 && (
          <div className="dc-panel-empty text-center">
            <p className="font-medium text-slate-900">No plans yet</p>
            <p className="mt-1 text-sm text-muted">Create the first plan to start assigning partners to it.</p>
          </div>
        )}
        {plans && plans.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Name</th>
                  <th className="text-right">Monthly price</th>
                  <th className="text-right">Trial days</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p._id}>
                    <td className="font-mono text-xs text-slate-600">{p.key}</td>
                    <td className="text-sm font-medium text-slate-900">{p.name}</td>
                    <td className="text-right text-sm text-slate-900">{formatPeso(p.monthlyPrice)}</td>
                    <td className="text-right text-sm text-muted">{p.trialDays || '—'}</td>
                    <td>{p.isActive ? <span className="badge-accent">Active</span> : <span className="badge-neutral">Inactive</span>}</td>
                    <td className="text-right">
                      <button type="button" className="btn-outline btn-sm" onClick={() => setEditingPlan(p)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingPlan && (
        <PlanFormModal
          plan={editingPlan === 'new' ? null : editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
