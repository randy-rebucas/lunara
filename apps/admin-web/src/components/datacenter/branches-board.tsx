'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BranchAddressEditor, type BranchAddressValue } from './branch-address-editor';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
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
    commissionRate: number;
    location: { latitude: number; longitude: number };
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

type NetworkState = 'nominal' | 'attention';

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/shops', label: 'Shops' },
  { href: '/orders', label: 'Orders' },
] as const;

const networkCopy: Record<
  NetworkState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Network nominal',
    detail: 'All registered locations are operational.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Capacity attention',
    detail: 'Some locations may be inactive or below full operational capacity.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

function performanceBadgeClass(score: number) {
  if (score >= 85) return 'badge-accent';
  if (score >= 70) return 'badge-primary';
  return 'badge-warning';
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
    <div className={depth > 0 ? 'ml-3 border-l border-border/60 pl-3' : ''}>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={`mb-1 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
          selectedId === node.id
            ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
            : 'border-border/60 bg-surface hover:border-primary/30'
        }`}
      >
        <span className="text-code text-primary">{node.code}</span>
        <span className="ml-2 font-medium text-slate-900">{node.name}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {node.branchTypeLabel}
          {node.city ? ` · ${node.city}` : ''}
          {node.childCount > 0 ? ` · ${node.childCount} below` : ''}
        </span>
        {!node.isActive ? <span className="badge-warning mt-1 text-xs">Inactive</span> : null}
        {isHq ? <span className="ml-1 text-xs text-muted">(network root)</span> : null}
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

export function BranchesBoard() {
  const searchParams = useSearchParams();
  const partnerFromUrl = searchParams.get('partner');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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
  });
  const [createAddressForm, setCreateAddressForm] = useState<BranchAddressValue>({
    line1: '',
    city: '',
    province: '',
    latitude: 14.5995,
    longitude: 120.9842,
  });
  const [createAddressResetToken, setCreateAddressResetToken] = useState(0);
  const [editForm, setEditForm] = useState({
    name: '',
    maxActiveOrders: '',
    maxWeightCapacityKg: '',
    dailyQuotaOrders: '',
    dailyQuotaWeightKg: '',
    commissionRate: '',
    isActive: true,
  });
  const [addressForm, setAddressForm] = useState<BranchAddressValue>({
    line1: '',
    city: '',
    province: '',
    latitude: 14.5995,
    longitude: 120.9842,
  });

  const loadNetwork = useCallback(async () => {
    const data = await adminFetch<{
      tree: BranchTreeNode[];
      totalBranches: number;
      operationalCount: number;
    }>('/admin/branches/network');
    setLastUpdated(new Date());
    return data;
  }, []);

  const loadMeta = useCallback(async () => {
    const [branches, shops] = await Promise.all([
      adminFetch<Array<{ _id: string; code: string; name: string }>>('/admin/branches'),
      adminFetch<{ shops: Array<{ _id: string; email?: string }> }>('/admin/shops'),
    ]);
    return { branches, shops: shops.shops };
  }, []);

  const {
    data: network,
    loading,
    error,
    reload: reloadNetwork,
  } = useAdminQuery(loadNetwork, []);
  const { data: meta } = useAdminQuery(loadMeta, []);

  const tree = network?.tree ?? [];
  const stats = {
    totalBranches: network?.totalBranches ?? 0,
    operationalCount: network?.operationalCount ?? 0,
  };
  const inactiveCount = Math.max(0, stats.totalBranches - stats.operationalCount);
  const networkState: NetworkState =
    inactiveCount > 0 || stats.operationalCount < stats.totalBranches ? 'attention' : 'nominal';
  const copy = networkCopy[networkState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

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
      commissionRate: String(Math.round((profile.branch.commissionRate ?? 0.2) * 100)),
      isActive: profile.branch.isActive,
    });
    setAddressForm({
      line1: profile.branch.line1,
      city: profile.branch.city,
      province: profile.branch.province,
      latitude: profile.branch.location.latitude,
      longitude: profile.branch.location.longitude,
    });
  }, [profile]);

  useEffect(() => {
    if (!partnerFromUrl || !meta?.shops?.some((s) => s._id === partnerFromUrl)) return;
    setShowCreate(true);
    setCreateForm((f) => ({ ...f, partnerUserId: partnerFromUrl }));
    requestAnimationFrame(() => {
      document.getElementById('branch-create')?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [partnerFromUrl, meta?.shops]);

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      setProfileError('');
      return;
    }
    const controller = new AbortController();
    setLoadingProfile(true);
    setProfileError('');
    adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`, { signal: controller.signal })
      .then(setProfile)
      .catch((e) => {
        if (controller.signal.aborted) return;
        setProfile(null);
        setProfileError(e instanceof Error ? e.message : 'Failed to load branch profile');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProfile(false);
      });
    return () => controller.abort();
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
          line1: createAddressForm.line1,
          city: createAddressForm.city,
          province: createAddressForm.province,
          coordinates: [createAddressForm.longitude, createAddressForm.latitude],
        }),
      });
      setBranchMsg('Branch created.');
      setShowCreate(false);
      setCreateAddressForm({
        line1: '',
        city: '',
        province: '',
        latitude: 14.5995,
        longitude: 120.9842,
      });
      setCreateAddressResetToken((t) => t + 1);
      await reloadNetwork();
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBranchBusy(false);
    }
  }

  async function toggleBranchActive() {
    if (!profile || !selectedId) return;
    const nextActive = !profile.branch.isActive;
    if (
      !nextActive &&
      !window.confirm(
        `Deactivate ${profile.branch.name}? This fails if it has orders still in progress.`,
      )
    ) {
      return;
    }
    setBranchBusy(true);
    setBranchMsg('');
    try {
      await adminFetch(`/admin/branches/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      setBranchMsg(nextActive ? 'Branch reactivated.' : 'Branch deactivated.');
      const refreshed = await adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`);
      setProfile(refreshed);
      await reloadNetwork();
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Update failed');
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
      // Blank fields must be skipped, not sent as 0 — Number('') is 0, and silently zeroing
      // a branch's order/weight capacity or quota would block it from accepting any orders.
      const numericField = (raw: string) => {
        if (raw.trim() === '') return undefined;
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
      };
      const commissionPct = numericField(editForm.commissionRate);

      await adminFetch(`/admin/branches/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          ...(numericField(editForm.maxActiveOrders) !== undefined
            ? { maxActiveOrders: numericField(editForm.maxActiveOrders) }
            : {}),
          ...(numericField(editForm.maxWeightCapacityKg) !== undefined
            ? { maxWeightCapacityKg: numericField(editForm.maxWeightCapacityKg) }
            : {}),
          ...(numericField(editForm.dailyQuotaOrders) !== undefined
            ? { dailyQuotaOrders: numericField(editForm.dailyQuotaOrders) }
            : {}),
          ...(numericField(editForm.dailyQuotaWeightKg) !== undefined
            ? { dailyQuotaWeightKg: numericField(editForm.dailyQuotaWeightKg) }
            : {}),
          isActive: editForm.isActive,
          ...(commissionPct !== undefined ? { commissionRate: commissionPct / 100 } : {}),
          line1: addressForm.line1,
          city: addressForm.city,
          province: addressForm.province,
          coordinates: [addressForm.longitude, addressForm.latitude],
        }),
      });
      setBranchMsg('Branch updated.');
      const refreshed = await adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`);
      setProfile(refreshed);
      await reloadNetwork();
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBranchBusy(false);
    }
  }

  const profileMetrics = useMemo(() => {
    if (!profile) return null;
    return {
      orderUtil: `${profile.capacity.activeOrders}/${profile.capacity.maxActiveOrders}`,
      weightUtil: `${profile.capacity.utilizationWeightPercent}%`,
      quotaOrders: `${profile.dailyQuota.ordersToday}/${profile.dailyQuota.quotaOrders}`,
      score: profile.performance.performanceScore,
    };
  }, [profile]);

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Network</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Branch network
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              HQ at the root — franchises and partner shops below, with managers, capacity, quotas,
              and performance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reloadNetwork()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/dispatch" className="btn-outline btn-sm">
              Dispatch
            </Link>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                setShowCreate(true);
                document.getElementById('branch-create')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Create branch
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !network ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading branch network…
        </div>
      ) : null}

      {network ? (
        <div className="space-y-3">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {inactiveCount > 0 ? (
              <span className="badge-warning px-3 py-1 text-xs font-semibold">
                {inactiveCount} non-operational
              </span>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell label="Total locations" value={stats.totalBranches} />
            <MetricCell
              label="Operational"
              value={stats.operationalCount}
              href="/dispatch"
              highlight={stats.operationalCount > 0 ? 'accent' : undefined}
            />
            <MetricCell
              label="Non-operational"
              value={inactiveCount}
              highlight={inactiveCount > 0 ? 'warning' : undefined}
            />
            {profileMetrics ? (
              <MetricCell
                label="Selected · performance"
                value={profileMetrics.score}
                sub={profile?.branch.code}
                highlight={
                  profileMetrics.score >= 85
                    ? 'accent'
                    : profileMetrics.score >= 70
                      ? 'primary'
                      : 'warning'
                }
              />
            ) : (
              <MetricCell label="Selected branch" value="—" sub="Pick from tree" />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-md border border-border/80 bg-surface px-3 py-1.5 dc-chip transition-colors hover:border-primary/40 hover:text-primary"
              >
                {a.label}
              </Link>
            ))}
          </div>

          {branchMsg ? (
            <div className="alert-info text-sm" role="status">
              {branchMsg}
            </div>
          ) : null}

          <section className="dc-panel" id="branch-create">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Create branch</h2>
                <p className="text-xs text-muted">Add a franchise or partner shop under the network</p>
              </div>
              <button
                type="button"
                className="link-primary text-xs font-medium"
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? 'Hide form' : 'Show form'}
              </button>
            </div>
            {showCreate ? (
              <form onSubmit={createBranch} className="dc-panel-body">
                <div className="dc-form-grid">
                  <div>
                    <label htmlFor="branch-code" className="form-label">
                      Code
                    </label>
                    <input
                      id="branch-code"
                      className="input-field"
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
                      className="input-field"
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
                      className="input-field"
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
                      className="input-field"
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
                      className="input-field"
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
                </div>

                <div className="mt-4 border-t border-border/60 pt-4">
                  <h4 className="text-sm font-semibold text-slate-900">Address</h4>
                  <p className="mt-0.5 text-xs text-muted">
                    Search to auto-fill, or pin the exact pickup location on the map.
                  </p>
                  <div className="mt-3">
                    <BranchAddressEditor
                      value={createAddressForm}
                      onChange={setCreateAddressForm}
                      resetKey={createAddressResetToken}
                    />
                  </div>
                </div>

                <div className="dc-form-actions mt-4">
                  <button type="submit" className="btn-primary btn-sm" disabled={branchBusy}>
                    {branchBusy ? 'Creating…' : 'Create branch'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="dc-panel-body text-sm text-muted">
                Expand to register a new franchise or partner shop location.
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="dc-panel lg:col-span-2">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Branch structure</h2>
                <p className="text-xs text-muted">HQ → franchise or partner shop chains</p>
              </div>
              <div className="dc-panel-body max-h-[32rem] overflow-y-auto pt-2">
                {tree.length === 0 ? (
                  <p className="text-sm text-muted">No branches in network.</p>
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
            </section>

            <section className="dc-panel lg:col-span-3">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Branch profile</h2>
                  <p className="text-xs text-muted">
                    {profile
                      ? `${profile.branch.branchTypeLabel} · ${profile.branch.city}`
                      : 'Select a branch from the tree'}
                  </p>
                </div>
                {profile ? (
                  <div className="flex items-center gap-2">
                    <span className={performanceBadgeClass(profile.performance.performanceScore)}>
                      {profile.performance.performanceLabel} ({profile.performance.performanceScore})
                    </span>
                    {profile.branch.branchType !== 'hq' ? (
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        disabled={branchBusy}
                        onClick={() => void toggleBranchActive()}
                      >
                        {profile.branch.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="dc-panel-body">
                {loadingProfile ? (
                  <p className="text-sm text-muted">Loading branch…</p>
                ) : null}
                {profileError ? (
                  <div className="alert-error text-sm" role="alert">
                    {profileError}
                  </div>
                ) : null}
                {!loadingProfile && !profile && !profileError ? (
                  <div className="dc-panel-empty py-8">
                    <p className="font-medium text-slate-900">No branch selected</p>
                    <p className="mt-1 text-sm text-muted">
                      Choose a location from the network tree to view capacity and edit settings.
                    </p>
                  </div>
                ) : null}

                {profile ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-code text-primary">{profile.branch.code}</p>
                      <h3 className="text-xl font-semibold text-slate-900">{profile.branch.name}</h3>
                      <p className="text-sm text-muted">
                        {profile.branch.line1}, {profile.branch.city}, {profile.branch.province}
                      </p>
                      {!profile.branch.isActive ? (
                        <span className="badge-warning mt-2">Inactive</span>
                      ) : null}
                    </div>

                    {profile.hierarchy.parent ? (
                      <p className="text-sm text-muted">
                        Reports to:{' '}
                        <button
                          type="button"
                          className="link-primary font-medium"
                          onClick={() => setSelectedId(profile.hierarchy.parent!.id)}
                        >
                          {profile.hierarchy.parent.name}
                        </button>
                      </p>
                    ) : null}

                    {profile.hierarchy.children.length > 0 ? (
                      <div>
                        <p className="dc-label">Child branches</p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {profile.hierarchy.children.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedId(c.id)}
                                className="rounded-md border border-border/80 px-2 py-1 text-xs dc-chip hover:border-primary/40"
                              >
                                {c.name} <span className="text-code">({c.code})</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      <MetricCell
                        label="Order capacity"
                        value={profileMetrics?.orderUtil ?? '—'}
                        sub={
                          profile.capacity.ordersCapacityAvailable ? 'Accepting' : 'At limit'
                        }
                        highlight={
                          !profile.capacity.ordersCapacityAvailable ? 'warning' : undefined
                        }
                      />
                      <MetricCell
                        label="Weight load"
                        value={profileMetrics?.weightUtil ?? '—'}
                        sub={`${profile.capacity.currentLoadKg}/${profile.capacity.maxWeightCapacityKg} kg`}
                        highlight={
                          profile.capacity.utilizationWeightPercent >= 90 ? 'danger' : undefined
                        }
                      />
                      <MetricCell
                        label="Daily orders"
                        value={profileMetrics?.quotaOrders ?? '—'}
                        sub={`${profile.dailyQuota.ordersQuotaPercent}% of quota`}
                      />
                      <MetricCell
                        label="Revenue today"
                        value={formatPeso(profile.performance.revenueToday)}
                        sub={`${profile.performance.ordersToday} orders`}
                        highlight="accent"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/60 p-3">
                        <p className="dc-label">Manager</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          {profile.manager
                            ? (profile.manager.email ?? profile.manager.phone ?? profile.manager.id)
                            : 'Not assigned'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 p-3">
                        <p className="dc-label">Staff ({profile.staff.length})</p>
                        {profile.staff.length === 0 ? (
                          <p className="mt-2 text-sm text-muted">No staff linked</p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-sm text-muted">
                            {profile.staff.map((s) => (
                              <li key={s.id}>{s.email ?? s.phone}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {profile.machines.length > 0 ? (
                      <div>
                        <p className="dc-label">Machines ({profile.machines.length})</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {profile.machines.map((m) => (
                            <span
                              key={m.id}
                              className={
                                m.status === 'active' ? 'badge-accent' : 'badge-warning'
                              }
                            >
                              {m.label} · {m.machineType} · {m.capacityKg}kg
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-border/60 p-3 text-sm">
                      <p className="dc-label">Performance (30d)</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {profile.performance.completedOrders30d} completed ·{' '}
                        {profile.performance.onTimeRatePercent}% on-time
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Daily weight quota: {profile.dailyQuota.weightTodayKg} /{' '}
                        {profile.dailyQuota.quotaWeightKg} kg (
                        {profile.dailyQuota.weightQuotaPercent}%)
                      </p>
                    </div>

                    <form onSubmit={updateBranch} className="border-t border-border/60 pt-4">
                      <h4 className="text-sm font-semibold text-slate-900">Edit branch</h4>
                      <div className="dc-form-grid mt-3">
                        <div>
                          <label htmlFor="edit-name" className="form-label">
                            Name
                          </label>
                          <input
                            id="edit-name"
                            className="input-field"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          />
                        </div>
                        <div className="flex items-end gap-2 pb-1">
                          <input
                            id="edit-active"
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, isActive: e.target.checked }))
                            }
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
                            className="input-field"
                            value={editForm.maxActiveOrders}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, maxActiveOrders: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-max-weight" className="form-label">
                            Max weight (kg)
                          </label>
                          <input
                            id="edit-max-weight"
                            type="number"
                            className="input-field"
                            value={editForm.maxWeightCapacityKg}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, maxWeightCapacityKg: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-quota-orders" className="form-label">
                            Daily quota (orders)
                          </label>
                          <input
                            id="edit-quota-orders"
                            type="number"
                            className="input-field"
                            value={editForm.dailyQuotaOrders}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, dailyQuotaOrders: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-quota-weight" className="form-label">
                            Daily quota (kg)
                          </label>
                          <input
                            id="edit-quota-weight"
                            type="number"
                            className="input-field"
                            value={editForm.dailyQuotaWeightKg}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, dailyQuotaWeightKg: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-commission" className="form-label">
                            Commission rate (%)
                          </label>
                          <input
                            id="edit-commission"
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="input-field"
                            value={editForm.commissionRate}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, commissionRate: e.target.value }))
                            }
                          />
                          <p className="mt-1 text-xs text-muted">Platform fee on laundry subtotal. Default 20%.</p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-border/60 pt-4">
                        <h4 className="text-sm font-semibold text-slate-900">Address</h4>
                        <p className="mt-0.5 text-xs text-muted">
                          Used for dispatch distance ranking — keep the pin accurate.
                        </p>
                        <div className="mt-3">
                          <BranchAddressEditor
                            value={addressForm}
                            onChange={setAddressForm}
                            resetKey={selectedId ?? undefined}
                          />
                        </div>
                      </div>

                      <div className="dc-form-actions mt-4">
                        <button type="submit" className="btn-primary btn-sm" disabled={branchBusy}>
                          {branchBusy ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
