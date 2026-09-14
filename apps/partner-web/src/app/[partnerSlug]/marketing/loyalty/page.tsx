'use client';

import { useCallback, useState } from 'react';
import { AuthLoading } from '../../../../components/auth-loading';
import { DataPageStatus } from '../../../../components/data-page-status';
import { StatCard } from '../../../../components/ui/card';
import { PageHeader } from '../../../../components/ui/page-header';
import { useRequirePartner } from '../../../../hooks/use-protected-page';
import {
  addRewardsCatalogItem,
  deleteRewardsCatalogItem,
  getBranchLoyaltyStats,
  getOwnRewardsProgram,
  updateOwnRewardsProgram,
  updateRewardsCatalogItem,
  type RewardsCatalogItem,
  type RewardsCatalogItemInput,
} from '../../../../lib/partner-api';
import { usePartnerQuery } from '../../../../lib/use-partner-query';
import { useShopPricing } from '../../../../lib/use-shop-pricing';

const MAX_PERCENT_DISCOUNT = 50;
const MAX_FIXED_DISCOUNT = 300;

const EMPTY_ITEM_FORM: RewardsCatalogItemInput = {
  title: '',
  description: '',
  points: 100,
  discountType: 'percent',
  discountValue: 10,
};

function formatDiscount(item: { discountType: 'percent' | 'fixed'; discountValue: number }) {
  return item.discountType === 'percent' ? `${item.discountValue}% off` : `₱${item.discountValue} off`;
}

export default function MarketingLoyaltyPage() {
  const { ready } = useRequirePartner();
  const {
    branches,
    branchesLoading,
    branchesError,
    reloadBranches,
    selectedBranchId,
    setSelectedBranchId,
  } = useShopPricing();

  const loadProgram = useCallback(() => getOwnRewardsProgram(), []);
  const { data: program, loading: programLoading, error: programError, reload: reloadProgram } = usePartnerQuery(
    loadProgram,
    [],
  );

  const loadStats = useCallback(async () => {
    if (!selectedBranchId) return null;
    return getBranchLoyaltyStats(selectedBranchId);
  }, [selectedBranchId]);
  const { data: stats, loading: statsLoading, error: statsError, reload: reloadStats } = usePartnerQuery(
    loadStats,
    [selectedBranchId],
  );

  const [savingActive, setSavingActive] = useState(false);
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [actionError, setActionError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RewardsCatalogItem | null>(null);
  const [form, setForm] = useState<RewardsCatalogItemInput>(EMPTY_ITEM_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const discountCap = form.discountType === 'percent' ? MAX_PERCENT_DISCOUNT : MAX_FIXED_DISCOUNT;

  async function toggleProgramActive() {
    if (!program) return;
    setSavingActive(true);
    setActionError('');
    try {
      await updateOwnRewardsProgram({ isActive: !program.isActive });
      await reloadProgram();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update rewards program');
    } finally {
      setSavingActive(false);
    }
  }

  async function saveRate() {
    if (rateDraft == null) return;
    const value = Number(rateDraft);
    if (!value || value < 1) return;
    setSavingRate(true);
    setActionError('');
    try {
      await updateOwnRewardsProgram({ pointsPerCompletedOrder: value });
      setRateDraft(null);
      await reloadProgram();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update rewards program');
    } finally {
      setSavingRate(false);
    }
  }

  function openCreateForm() {
    setEditingItem(null);
    setForm(EMPTY_ITEM_FORM);
    setShowForm(true);
  }

  function openEditForm(item: RewardsCatalogItem) {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description ?? '',
      points: item.points,
      discountType: item.discountType,
      discountValue: item.discountValue,
    });
    setShowForm(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const input: RewardsCatalogItemInput = {
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        points: Number(form.points),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
      };
      if (editingItem) {
        await updateRewardsCatalogItem(editingItem.id, input);
      } else {
        await addRewardsCatalogItem(input);
      }
      setShowForm(false);
      setEditingItem(null);
      setForm(EMPTY_ITEM_FORM);
      await reloadProgram();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save reward');
    } finally {
      setSaving(false);
    }
  }

  async function toggleItemActive(item: RewardsCatalogItem) {
    setBusyItemId(item.id);
    try {
      await updateRewardsCatalogItem(item.id, { isActive: !item.isActive });
      await reloadProgram();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update reward');
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(item: RewardsCatalogItem) {
    if (!window.confirm(`Delete "${item.title}" from your rewards catalog?`)) return;
    setBusyItemId(item.id);
    try {
      await deleteRewardsCatalogItem(item.id);
      await reloadProgram();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete reward');
    } finally {
      setBusyItemId(null);
    }
  }

  if (!ready) return <AuthLoading message="Loading loyalty…" />;

  const catalog = program?.catalog ?? [];

  return (
    <div>
      <PageHeader
        title="Loyalty"
        description="Run your own rewards program — customers earn points on completed orders at your shop and redeem them for discounts you set, funded by your own payout. No admin approval needed."
      />

      <div className="mt-4">
        <DataPageStatus loading={programLoading} error={programError} loadingMessage="Loading your rewards program…" onRetry={reloadProgram} />
      </div>

      {actionError && <div className="alert-error mt-3" role="alert">{actionError}</div>}

      {program && (
        <section className="section-panel mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Program status</h2>
              <p className="mt-1 text-xs text-muted">
                {program.isActive
                  ? 'Live — customers earn points at your shop and can redeem your catalog below.'
                  : 'Off — orders at your shop earn no points, and your catalog is hidden from customers.'}
              </p>
            </div>
            <button
              type="button"
              className={program.isActive ? 'btn-outline btn-sm' : 'btn-primary btn-sm'}
              disabled={savingActive}
              onClick={() => void toggleProgramActive()}
            >
              {savingActive ? 'Saving…' : program.isActive ? 'Turn off' : 'Turn on'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="form-label" htmlFor="pts-rate">Points per completed order</label>
              <input
                id="pts-rate"
                type="number"
                min={1}
                className="input-field w-32"
                value={rateDraft ?? String(program.pointsPerCompletedOrder)}
                onChange={(e) => setRateDraft(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={savingRate || rateDraft == null || Number(rateDraft) === program.pointsPerCompletedOrder}
              onClick={() => void saveRate()}
            >
              {savingRate ? 'Saving…' : 'Save rate'}
            </button>
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Your rewards catalog</h2>
          <button type="button" className="btn-primary btn-sm" onClick={() => (showForm ? setShowForm(false) : openCreateForm())}>
            {showForm ? 'Close' : 'New reward'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={saveItem} className="card mt-3 space-y-3 p-4">
            {formError && <div className="alert-error" role="alert">{formError}</div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="form-label" htmlFor="rw-title">Title</label>
                <input id="rw-title" className="input-field" placeholder="Free delivery" value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label" htmlFor="rw-points">Points cost</label>
                <input id="rw-points" className="input-field" type="number" min={1} value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))} required />
              </div>
              <div>
                <label className="form-label" htmlFor="rw-type">Discount type</label>
                <select id="rw-type" className="input-field" value={form.discountType}
                  onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as 'percent' | 'fixed' }))}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount (₱)</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="rw-value">
                  Value {form.discountType === 'percent' ? `(max ${discountCap}%)` : `(max ₱${discountCap})`}
                </label>
                <input id="rw-value" className="input-field" type="number" min={0} max={discountCap}
                  value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))} required />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="form-label" htmlFor="rw-desc">Description (optional)</label>
                <input id="rw-desc" className="input-field" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary btn-sm">
              {saving ? 'Saving…' : editingItem ? 'Save changes' : 'Add reward'}
            </button>
          </form>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!programLoading && !programError && catalog.length === 0 && (
            <div className="card p-6 text-center text-sm text-muted sm:col-span-2 lg:col-span-3">
              No rewards yet — add one so customers have something to redeem their points for.
            </div>
          )}
          {catalog.map((item) => (
            <div key={item.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={item.isActive ? 'badge-accent' : 'badge-neutral'}>{item.isActive ? 'Active' : 'Off'}</span>
                  <span className="badge-primary">{formatDiscount(item)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-primary">{item.points} pts</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-outline btn-sm" onClick={() => openEditForm(item)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={busyItemId === item.id}
                  onClick={() => void toggleItemActive(item)}
                >
                  {item.isActive ? 'Turn off' : 'Turn on'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={busyItemId === item.id}
                  onClick={() => void removeItem(item)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Activity at your shop</h2>

        <div className="mt-2">
          <DataPageStatus
            loading={branchesLoading}
            error={branchesError}
            loadingMessage="Loading shops…"
            onRetry={reloadBranches}
          />
        </div>

        {(branches ?? []).length > 1 && (
          <div className="mt-3">
            <label className="text-sm font-medium text-slate-900">Shop</label>
            <select
              className="input-field mt-1 w-full max-w-sm"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              {(branches ?? []).map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3">
          <DataPageStatus
            loading={statsLoading}
            error={statsError}
            loadingMessage="Loading loyalty stats…"
            onRetry={reloadStats}
          />
        </div>

        {stats && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Points earned at this shop" value={stats.totalPointsEarned} accent="accent" />
              <StatCard label="Orders that earned points" value={stats.ordersCounted} />
              <StatCard label="Customers earning here" value={stats.uniqueCustomers} accent="secondary" />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="section-panel overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">Top customers</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Points earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center text-sm text-muted">
                            No points earned at this shop yet.
                          </td>
                        </tr>
                      ) : (
                        stats.topCustomers.map((c) => (
                          <tr key={c.userId}>
                            <td className="font-medium text-slate-900">{c.displayName}</td>
                            <td className="text-muted">{c.points}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="section-panel overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Points</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentActivity.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center text-sm text-muted">
                            No activity yet.
                          </td>
                        </tr>
                      ) : (
                        stats.recentActivity.map((a, i) => (
                          <tr key={i}>
                            <td className="font-medium text-slate-900">{a.customerName}</td>
                            <td className="text-muted">+{a.amount}</td>
                            <td className="text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
