'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface BranchTreeNode {
  id: string;
  code: string;
  name: string;
  branchType: string;
  branchTypeLabel: string;
  city: string;
  isActive: boolean;
  childCount: number;
  children: BranchTreeNode[];
}

interface BranchProfile {
  branch: {
    id: string;
    code: string;
    name: string;
    branchType: string;
    branchTypeLabel: string;
    line1: string;
    city: string;
    province: string;
    isActive: boolean;
    maxActiveOrders: number;
    maxWeightCapacityKg: number;
    dailyQuotaOrders: number;
    dailyQuotaWeightKg: number;
  };
  hierarchy: {
    parent: { id: string; code: string; name: string } | null;
    children: { id: string; code: string; name: string; city: string }[];
  };
  manager: { id: string; email?: string; phone?: string } | null;
  staff: { id: string; email?: string; phone?: string }[];
  machines: {
    id: string;
    label: string;
    machineType: string;
    status: string;
    capacityKg: number;
  }[];
  capacity: {
    activeOrders: number;
    maxActiveOrders: number;
    ordersCapacityAvailable: boolean;
    currentLoadKg: number;
    maxWeightCapacityKg: number;
    utilizationWeightPercent: number;
  };
  dailyQuota: {
    ordersToday: number;
    quotaOrders: number;
    ordersQuotaPercent: number;
    weightTodayKg: number;
    quotaWeightKg: number;
    weightQuotaPercent: number;
  };
  performance: {
    performanceScore: number;
    performanceLabel: string;
    completedOrders30d: number;
    onTimeRatePercent: number;
    ordersToday: number;
    revenueToday: number;
  };
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: BranchTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const isHq = node.branchType === 'hq';
  return (
    <div className={depth > 0 ? 'ml-4 border-l border-slate-200 pl-3' : ''}>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={`mb-1 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
          selectedId === node.id
            ? 'border-primary/40 bg-primary/5'
            : 'border-transparent bg-white hover:border-slate-200'
        }`}
      >
        <span className="font-mono text-xs text-primary">{node.code}</span>
        <span className="ml-2 font-medium">{node.name}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {node.branchTypeLabel}
          {node.city ? ` · ${node.city}` : ''}
          {node.childCount > 0 ? ` · ${node.childCount} below` : ''}
        </span>
        {!node.isActive && (
          <span className="text-xs text-amber-700">Inactive</span>
        )}
        {isHq && (
          <span className="ml-1 text-xs text-slate-400">(network root)</span>
        )}
      </button>
      {node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default function BranchNetworkPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<BranchProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [branchMsg, setBranchMsg] = useState('');
  const [branchBusy, setBranchBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    branchType: 'partner_shop' as 'franchise' | 'partner_shop',
    parentBranchId: '',
    partnerUserId: '',
    line1: '',
    city: '',
    province: '',
    lat: '14.5995',
    lng: '120.9842',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    maxActiveOrders: '',
    maxWeightCapacityKg: '',
    dailyQuotaOrders: '',
    dailyQuotaWeightKg: '',
    isActive: true,
  });

  const loadNetwork = useCallback(async () => {
    return adminFetch<{ tree: BranchTreeNode[]; totalBranches: number; operationalCount: number }>(
      '/admin/branches/network',
    );
  }, []);

  const loadMeta = useCallback(async () => {
    const [branches, shops] = await Promise.all([
      adminFetch<Array<{ _id: string; code: string; name: string }>>('/admin/branches'),
      adminFetch<{ shops: Array<{ _id: string; email?: string }> }>('/admin/shops'),
    ]);
    return { branches, shops: shops.shops };
  }, []);

  const { data: network, loading, error } = useAdminQuery(loadNetwork, []);
  const { data: meta } = useAdminQuery(loadMeta, []);
  const tree = network?.tree ?? [];
  const stats = {
    totalBranches: network?.totalBranches ?? 0,
    operationalCount: network?.operationalCount ?? 0,
  };

  useEffect(() => {
    if (!network?.tree[0] || selectedId) return;
    function pick(node: BranchTreeNode): string | null {
      if (node.branchType !== 'hq') return node.id;
      for (const c of node.children) {
        const found = pick(c);
        if (found) return found;
      }
      return node.id;
    }
    const firstShop = pick(network.tree[0]);
    if (firstShop) setSelectedId(firstShop);
  }, [network, selectedId]);

  useEffect(() => {
    if (!profile) return;
    setEditForm({
      name: profile.branch.name,
      maxActiveOrders: String(profile.branch.maxActiveOrders),
      maxWeightCapacityKg: String(profile.branch.maxWeightCapacityKg),
      dailyQuotaOrders: String(profile.branch.dailyQuotaOrders),
      dailyQuotaWeightKg: String(profile.branch.dailyQuotaWeightKg),
      isActive: profile.branch.isActive,
    });
  }, [profile]);

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      setProfileError('');
      return;
    }
    setLoadingProfile(true);
    setProfileError('');
    adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`)
      .then(setProfile)
      .catch((e) => {
        setProfile(null);
        setProfileError(e instanceof Error ? e.message : 'Failed to load branch profile');
      })
      .finally(() => setLoadingProfile(false));
  }, [selectedId]);

  async function createBranch(e: React.FormEvent) {
    e.preventDefault();
    setBranchBusy(true);
    setBranchMsg('');
    try {
      await adminFetch('/admin/branches', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          coordinates: [Number(createForm.lng), Number(createForm.lat)],
        }),
      });
      setBranchMsg('Branch created.');
      setShowCreate(false);
      window.location.reload();
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBranchBusy(false);
    }
  }

  async function updateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBranchBusy(true);
    setBranchMsg('');
    try {
      await adminFetch(`/admin/branches/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          maxActiveOrders: Number(editForm.maxActiveOrders),
          maxWeightCapacityKg: Number(editForm.maxWeightCapacityKg),
          dailyQuotaOrders: Number(editForm.dailyQuotaOrders),
          dailyQuotaWeightKg: Number(editForm.dailyQuotaWeightKg),
          isActive: editForm.isActive,
        }),
      });
      setBranchMsg('Branch updated.');
      const refreshed = await adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`);
      setProfile(refreshed);
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBranchBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Branch network"
        description="HQ at the root — franchises and partner shops below, with managers, capacity, quotas, and performance."
        actions={
          <>
            <Link href="/dispatch" className="btn-outline btn-sm">
              Dispatch
            </Link>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? 'Cancel' : 'Create branch'}
            </button>
          </>
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading branch network…" />

      {network ? (
        <p className="mt-4 text-sm text-muted">
          <strong className="text-slate-900">{stats.totalBranches}</strong> locations ·{' '}
          <strong className="text-slate-900">{stats.operationalCount}</strong> operational shops
        </p>
      ) : null}

      {branchMsg ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {branchMsg}
        </p>
      ) : null}

      {showCreate ? (
        <form onSubmit={createBranch} className="card card-body mt-6 grid gap-3 md:grid-cols-2">
          <h3 className="md:col-span-2 text-lg font-semibold text-slate-900">Create branch</h3>
          <div>
            <label htmlFor="branch-code" className="form-label">
              Code
            </label>
            <input
              id="branch-code"
              className="input-field w-full"
              value={createForm.code}
              onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="branch-name" className="form-label">
              Name
            </label>
            <input
              id="branch-name"
              className="input-field w-full"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="branch-type" className="form-label">
              Type
            </label>
            <select
              id="branch-type"
              className="input-field w-full"
              value={createForm.branchType}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  branchType: e.target.value as 'franchise' | 'partner_shop',
                }))
              }
            >
              <option value="partner_shop">Partner shop</option>
              <option value="franchise">Franchise</option>
            </select>
          </div>
          <div>
            <label htmlFor="parent-branch" className="form-label">
              Parent branch
            </label>
            <select
              id="parent-branch"
              className="input-field w-full"
              value={createForm.parentBranchId}
              onChange={(e) => setCreateForm((f) => ({ ...f, parentBranchId: e.target.value }))}
              required
            >
              <option value="">Select parent</option>
              {(meta?.branches ?? []).map((b) => (
                <option key={b._id} value={b._id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="partner-user" className="form-label">
              Partner account
            </label>
            <select
              id="partner-user"
              className="input-field w-full"
              value={createForm.partnerUserId}
              onChange={(e) => setCreateForm((f) => ({ ...f, partnerUserId: e.target.value }))}
              required
            >
              <option value="">Select partner</option>
              {(meta?.shops ?? []).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.email ?? s._id}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="branch-line1" className="form-label">
              Address line
            </label>
            <input
              id="branch-line1"
              className="input-field w-full"
              value={createForm.line1}
              onChange={(e) => setCreateForm((f) => ({ ...f, line1: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="branch-city" className="form-label">
              City
            </label>
            <input
              id="branch-city"
              className="input-field w-full"
              value={createForm.city}
              onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="branch-province" className="form-label">
              Province
            </label>
            <input
              id="branch-province"
              className="input-field w-full"
              value={createForm.province}
              onChange={(e) => setCreateForm((f) => ({ ...f, province: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary btn-sm" disabled={branchBusy}>
              {branchBusy ? 'Creating…' : 'Create branch'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="card card-body !py-4 lg:col-span-2">
          <h3 className="font-semibold text-slate-800">Branch structure</h3>
          <p className="mt-1 text-xs text-slate-500">
            HQ → franchise or partner shop chains (multi-level supported)
          </p>
          <div className="mt-4 max-h-[32rem] overflow-y-auto">
            {tree.length === 0 ? (
              <p className="text-sm text-slate-500">Loading network…</p>
            ) : (
              tree.map((root) => (
                <TreeNode
                  key={root.id}
                  node={root}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>

        <div className="card card-body lg:col-span-3">
          {loadingProfile && <p className="text-slate-500">Loading branch…</p>}
          {profileError && <p className="text-sm text-red-500">{profileError}</p>}
          {!loadingProfile && !profile && !profileError && (
            <p className="text-slate-500">Select a branch to view details.</p>
          )}
          {profile && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-primary">{profile.branch.code}</p>
                  <h3 className="text-xl font-semibold">{profile.branch.name}</h3>
                  <p className="text-sm text-slate-500">
                    {profile.branch.branchTypeLabel} · {profile.branch.line1},{' '}
                    {profile.branch.city}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    profile.performance.performanceScore >= 85
                      ? 'bg-green-100 text-green-800'
                      : profile.performance.performanceScore >= 70
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {profile.performance.performanceLabel} ({profile.performance.performanceScore})
                </span>
              </div>

              {profile.hierarchy.parent && (
                <p className="mt-3 text-sm text-slate-600">
                  Reports to:{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setSelectedId(profile.hierarchy.parent!.id)}
                  >
                    {profile.hierarchy.parent.name}
                  </button>
                </p>
              )}

              {profile.hierarchy.children.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase text-slate-400">Child branches</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {profile.hierarchy.children.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          {c.name} ({c.code})
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <section className="rounded-lg bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold">Manager</h4>
                  {profile.manager ? (
                    <p className="mt-2 text-sm">
                      {profile.manager.email ?? profile.manager.phone ?? profile.manager.id}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Not assigned</p>
                  )}
                </section>
                <section className="rounded-lg bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold">Staff ({profile.staff.length})</h4>
                  {profile.staff.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No staff linked to this branch</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {profile.staff.map((s) => (
                        <li key={s.id}>{s.email ?? s.phone}</li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <section className="mt-4">
                <h4 className="text-sm font-semibold">
                  Machines ({profile.machines.length})
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.machines.map((m) => (
                    <span
                      key={m.id}
                      className={`rounded border px-2 py-1 text-xs ${
                        m.status === 'active'
                          ? 'border-green-200 bg-green-50'
                          : 'border-amber-200 bg-amber-50'
                      }`}
                    >
                      {m.label} · {m.machineType} · {m.capacityKg}kg
                    </span>
                  ))}
                </div>
              </section>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Order capacity</p>
                  <p className="mt-1 text-lg font-semibold">
                    {profile.capacity.activeOrders}/{profile.capacity.maxActiveOrders}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.capacity.ordersCapacityAvailable ? 'Accepting' : 'At limit'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Weight capacity</p>
                  <p className="mt-1 text-lg font-semibold">
                    {profile.capacity.currentLoadKg}/{profile.capacity.maxWeightCapacityKg} kg
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.capacity.utilizationWeightPercent}% utilized
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Daily quota (orders)</p>
                  <p className="mt-1 text-lg font-semibold">
                    {profile.dailyQuota.ordersToday}/{profile.dailyQuota.quotaOrders}
                  </p>
                  <div className="mt-1 h-1.5 rounded bg-slate-200">
                    <div
                      className="h-1.5 rounded bg-primary"
                      style={{ width: `${profile.dailyQuota.ordersQuotaPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Daily quota (weight)</p>
                  <p className="font-semibold">
                    {profile.dailyQuota.weightTodayKg} / {profile.dailyQuota.quotaWeightKg} kg
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Performance (30d)</p>
                  <p className="font-semibold">
                    {profile.performance.completedOrders30d} completed ·{' '}
                    {profile.performance.onTimeRatePercent}% on-time
                  </p>
                  <p className="text-xs text-slate-500">
                    Today: {profile.performance.ordersToday} orders · ₱
                    {profile.performance.revenueToday.toLocaleString()} revenue
                  </p>
                </div>
              </div>

              <form onSubmit={updateBranch} className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                <h4 className="text-sm font-semibold text-slate-900">Edit branch</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="edit-name" className="form-label">
                      Name
                    </label>
                    <input
                      id="edit-name"
                      className="input-field w-full"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-2">
                    <input
                      id="edit-active"
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                    />
                    <label htmlFor="edit-active" className="text-sm">
                      Active
                    </label>
                  </div>
                  <div>
                    <label htmlFor="edit-max-orders" className="form-label">
                      Max active orders
                    </label>
                    <input
                      id="edit-max-orders"
                      type="number"
                      className="input-field w-full"
                      value={editForm.maxActiveOrders}
                      onChange={(e) => setEditForm((f) => ({ ...f, maxActiveOrders: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-max-weight" className="form-label">
                      Max weight (kg)
                    </label>
                    <input
                      id="edit-max-weight"
                      type="number"
                      className="input-field w-full"
                      value={editForm.maxWeightCapacityKg}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, maxWeightCapacityKg: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary btn-sm" disabled={branchBusy}>
                  {branchBusy ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
