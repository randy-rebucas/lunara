'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BranchAddressEditor, type BranchAddressValue } from './branch-address-editor';
import { ShopPricingPanel } from './shop-pricing-panel';
import { adminFetch, adminUpload } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';
import { TILE_TONES, type StatusPillCopy } from './tile-tones';

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
    logoUrl?: string;
    maxActiveOrders: number;
    maxWeightCapacityKg: number;
    dailyQuotaOrders: number;
    dailyQuotaWeightKg: number;
    commissionRate: number;
    serviceRadiusKm: number;
    servicePricing: {
      serviceType: string;
      basePricePerKg: number;
      basePricePerLoad?: number;
      basePricePerPiece?: number;
      pricingUnit?: string;
    }[];
    addonPricing: { addonSlug: string; basePrice: number; pricingUnit?: string }[];
    location: { latitude: number; longitude: number };
    assignedRiderId?: string;
  };
  hierarchy: {
    parent: { id: string; code: string; name: string } | null;
    children: { id: string; code: string; name: string; city: string }[];
  };
  manager: { id: string; email?: string; phone?: string } | null;
  partner: { id: string; email?: string; phone?: string } | null;
  staff: { id: string; email?: string; phone?: string }[];
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

const TILE_CHIPS: Record<keyof typeof TILE_TONES, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  secondary: 'bg-secondary/10 text-secondary',
  amber: 'bg-amber-500/10 text-amber-600',
  violet: 'bg-violet-500/10 text-violet-600',
  rose: 'bg-rose-500/10 text-rose-600',
};

function TileIcon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  );
}

const tileIcons = {
  locations: <TileIcon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  operational: <TileIcon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  inactive: <TileIcon d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  performance: <TileIcon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
};

function StatTile({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg p-4 ring-1 ${TILE_TONES[tone]}`}>
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TILE_CHIPS[tone]}`}>
            {icon}
          </span>
        ) : null}
        <p className="text-xs font-medium text-muted">{label}</p>
      </div>
      <p className="dc-value mt-2">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </div>
  );
}

function CapacityBar({ percent }: { percent: number }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${
          percent >= 100 ? 'bg-destructive' : percent >= 80 ? 'bg-amber-500' : 'bg-primary/80'
        }`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

const networkCopy: StatusPillCopy<NetworkState> = {
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
    serviceRadiusKm: '',
    isActive: true,
  });
  const [addressForm, setAddressForm] = useState<BranchAddressValue>({
    line1: '',
    city: '',
    province: '',
    latitude: 14.5995,
    longitude: 120.9842,
  });
  const [assignedRiderId, setAssignedRiderId] = useState('');
  const [riderBusy, setRiderBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [profileTab, setProfileTab] = useState<'edit' | 'pricing' | 'address'>('edit');

  // Selecting a different branch always lands on the settings tab; staying put after a
  // save (profile refresh) is intentional.
  useEffect(() => {
    setProfileTab('edit');
  }, [selectedId]);

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
    // Parent-branch options must include HQ, so this uses the dedicated
    // /admin/branches/parents list rather than /admin/branches (which excludes HQ).
    const [branches, shops, riders] = await Promise.all([
      adminFetch<Array<{ _id: string; code: string; name: string }>>('/admin/branches/parents'),
      adminFetch<{ shops: Array<{ _id: string; email?: string }> }>('/admin/shops'),
      adminFetch<Array<{ userId: string; email?: string; firstName?: string; lastName?: string; isOnline: boolean }>>(
        '/admin/riders',
      ),
    ]);
    return { branches, shops: shops.shops, riders };
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
      serviceRadiusKm: String(profile.branch.serviceRadiusKm ?? 10),
      isActive: profile.branch.isActive,
    });
    setAddressForm({
      line1: profile.branch.line1,
      city: profile.branch.city,
      province: profile.branch.province,
      latitude: profile.branch.location.latitude,
      longitude: profile.branch.location.longitude,
    });
    setAssignedRiderId(profile.branch.assignedRiderId ?? '');
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

  async function saveAssignedRider() {
    if (!selectedId) return;
    setRiderBusy(true);
    setBranchMsg('');
    try {
      await adminFetch(`/admin/branches/${selectedId}/assigned-rider`, {
        method: 'PATCH',
        body: JSON.stringify({ riderId: assignedRiderId || null }),
      });
      setBranchMsg(assignedRiderId ? 'Assigned rider updated.' : 'Assigned rider cleared.');
      const refreshed = await adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`);
      setProfile(refreshed);
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Failed to update assigned rider');
    } finally {
      setRiderBusy(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedId) return;
    setLogoBusy(true);
    setBranchMsg('');
    try {
      const formData = new FormData();
      formData.append('logo', file);
      await adminUpload(`/admin/branches/${selectedId}/logo`, formData);
      setBranchMsg('Logo updated.');
      const refreshed = await adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`);
      setProfile(refreshed);
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    if (!selectedId) return;
    setLogoBusy(true);
    setBranchMsg('');
    try {
      await adminFetch(`/admin/branches/${selectedId}/logo`, { method: 'DELETE' });
      setBranchMsg('Logo removed.');
      const refreshed = await adminFetch<BranchProfile>(`/admin/branches/${selectedId}/profile`);
      setProfile(refreshed);
    } catch (err) {
      setBranchMsg(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setLogoBusy(false);
    }
  }

  // Called from the edit form's submit and from the standalone address panel's Save —
  // both persist the combined branch settings + address in one PATCH.
  async function updateBranch(e?: React.FormEvent) {
    e?.preventDefault();
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
          ...(numericField(editForm.serviceRadiusKm) !== undefined
            ? { serviceRadiusKm: numericField(editForm.serviceRadiusKm) }
            : {}),
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

  const assignedRider = useMemo(() => {
    const riderId = profile?.branch.assignedRiderId;
    if (!riderId) return null;
    return meta?.riders?.find((r) => r.userId === riderId) ?? null;
  }, [profile, meta]);

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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Total locations"
              value={String(stats.totalBranches)}
              sub="HQ, franchises, partner shops"
              tone="primary"
              icon={tileIcons.locations}
            />
            <StatTile
              label="Operational"
              value={String(stats.operationalCount)}
              sub={
                stats.totalBranches > 0
                  ? `${Math.round((stats.operationalCount / stats.totalBranches) * 100)}% of network`
                  : undefined
              }
              tone="accent"
              icon={tileIcons.operational}
            />
            <StatTile
              label="Non-operational"
              value={String(inactiveCount)}
              sub="inactive locations"
              tone={inactiveCount > 0 ? 'amber' : 'violet'}
              icon={tileIcons.inactive}
            />
            {profileMetrics ? (
              <StatTile
                label="Selected performance"
                value={String(profileMetrics.score)}
                sub={profile?.branch.code}
                tone={
                  profileMetrics.score >= 85
                    ? 'accent'
                    : profileMetrics.score >= 70
                      ? 'secondary'
                      : 'amber'
                }
                icon={tileIcons.performance}
              />
            ) : (
              <StatTile
                label="Selected branch"
                value="—"
                sub="Pick from tree"
                tone="violet"
                icon={tileIcons.performance}
              />
            )}
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

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <section className="dc-panel xl:col-span-4">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Branch structure</h2>
                <p className="text-xs text-muted">HQ → franchise or partner shop chains</p>
              </div>
              <div className="dc-panel-body max-h-[40rem] overflow-y-auto pt-2">
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

            <section className="dc-panel min-w-0 xl:col-span-8">
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
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-slate-50">
                        {profile.branch.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.branch.logoUrl}
                            alt={`${profile.branch.name} logo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted">No logo</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-code text-primary">{profile.branch.code}</p>
                        <h3 className="text-xl font-semibold text-slate-900">{profile.branch.name}</h3>
                        <p className="text-sm text-muted">
                          {profile.branch.line1}, {profile.branch.city}, {profile.branch.province}
                        </p>
                        {!profile.branch.isActive ? (
                          <span className="badge-warning mt-2">Inactive</span>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <label
                            className={`btn-outline btn-sm cursor-pointer ${logoBusy ? 'pointer-events-none opacity-60' : ''}`}
                          >
                            {logoBusy ? 'Uploading…' : profile.branch.logoUrl ? 'Change logo' : 'Upload logo'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={logoBusy}
                              onChange={handleLogoChange}
                            />
                          </label>
                          {profile.branch.logoUrl ? (
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              disabled={logoBusy}
                              onClick={() => void handleLogoRemove()}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
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

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div
                        className={`rounded-lg p-3.5 ring-1 ${
                          profile.capacity.ordersCapacityAvailable
                            ? TILE_TONES.primary
                            : TILE_TONES.amber
                        }`}
                      >
                        <p className="text-xs font-medium text-muted">Order capacity</p>
                        <p className="dc-value-sm mt-1">{profileMetrics?.orderUtil ?? '—'}</p>
                        <CapacityBar
                          percent={
                            profile.capacity.maxActiveOrders > 0
                              ? (profile.capacity.activeOrders / profile.capacity.maxActiveOrders) * 100
                              : 0
                          }
                        />
                        <p className="dc-sublabel mt-1">
                          {profile.capacity.ordersCapacityAvailable ? 'Accepting orders' : 'At limit'}
                        </p>
                      </div>
                      <div
                        className={`rounded-lg p-3.5 ring-1 ${
                          profile.capacity.utilizationWeightPercent >= 90
                            ? TILE_TONES.rose
                            : TILE_TONES.secondary
                        }`}
                      >
                        <p className="text-xs font-medium text-muted">Weight load</p>
                        <p className="dc-value-sm mt-1">{profileMetrics?.weightUtil ?? '—'}</p>
                        <CapacityBar percent={profile.capacity.utilizationWeightPercent} />
                        <p className="dc-sublabel mt-1">
                          {profile.capacity.currentLoadKg}/{profile.capacity.maxWeightCapacityKg} kg
                        </p>
                      </div>
                      <div className={`rounded-lg p-3.5 ring-1 ${TILE_TONES.violet}`}>
                        <p className="text-xs font-medium text-muted">Daily orders</p>
                        <p className="dc-value-sm mt-1">{profileMetrics?.quotaOrders ?? '—'}</p>
                        <CapacityBar percent={profile.dailyQuota.ordersQuotaPercent} />
                        <p className="dc-sublabel mt-1">{profile.dailyQuota.ordersQuotaPercent}% of quota</p>
                      </div>
                      <div className={`rounded-lg p-3.5 ring-1 ${TILE_TONES.accent}`}>
                        <p className="text-xs font-medium text-muted">Revenue today</p>
                        <p className="dc-value-sm mt-1">{formatPeso(profile.performance.revenueToday)}</p>
                        <p className="dc-sublabel mt-1">{profile.performance.ordersToday} orders today</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-border/60 p-3">
                        <p className="dc-label">Partner owner</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          {profile.partner
                            ? (profile.partner.email ?? profile.partner.phone ?? profile.partner.id)
                            : '—'}
                        </p>
                      </div>
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
                      <div className="rounded-lg border border-border/60 p-3">
                        <p className="dc-label">Assigned rider</p>
                        {assignedRider ? (
                          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                            {assignedRider.firstName || assignedRider.lastName
                              ? `${assignedRider.firstName ?? ''} ${assignedRider.lastName ?? ''}`.trim()
                              : (assignedRider.email ?? assignedRider.userId)}
                            <span className={assignedRider.isOnline ? 'badge-accent' : 'badge-warning'}>
                              {assignedRider.isOnline ? 'Online' : 'Offline'}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-muted">No default rider assigned</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="dc-label">Assign default rider</p>
                      <p className="mt-1 text-xs text-muted">
                        Default rider dispatched for pickups/deliveries at this branch. If they&apos;re
                        offline when a task comes up, the nearest online rider is used instead.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select
                          id="assigned-rider"
                          className="input-field min-w-0 flex-1"
                          value={assignedRiderId}
                          onChange={(e) => setAssignedRiderId(e.target.value)}
                        >
                          <option value="">No default rider</option>
                          {(meta?.riders ?? []).map((r) => (
                            <option key={r.userId} value={r.userId}>
                              {r.firstName || r.lastName
                                ? `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()
                                : (r.email ?? r.userId)}
                              {r.isOnline ? ' (online)' : ' (offline)'}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-primary btn-sm shrink-0"
                          disabled={riderBusy}
                          onClick={() => void saveAssignedRider()}
                        >
                          {riderBusy ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>

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

                    {/* ── Settings / pricing / address tabs ── */}
                    <div
                      className="overflow-x-auto overflow-y-hidden border-t border-border/60 pt-2"
                      role="tablist"
                      aria-label="Branch settings sections"
                    >
                      <div className="flex min-w-max gap-1 border-b border-border/60">
                        {(
                          [
                            { id: 'edit', label: 'Edit branch' },
                            ...(profile.branch.branchType === 'partner_shop'
                              ? [{ id: 'pricing', label: 'Shop pricing' }]
                              : []),
                            { id: 'address', label: 'Address' },
                          ] as { id: typeof profileTab; label: string }[]
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={profileTab === t.id}
                            onClick={() => setProfileTab(t.id)}
                            className={`-mb-px inline-flex items-center whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                              profileTab === t.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-slate-900'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {profileTab === 'edit' ? (
                    <form onSubmit={updateBranch} className="pt-1">
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
                        <div>
                          <label htmlFor="edit-radius" className="form-label">
                            Service radius (km)
                          </label>
                          <input
                            id="edit-radius"
                            type="number"
                            min="1"
                            max="50"
                            step="1"
                            className="input-field"
                            value={editForm.serviceRadiusKm}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, serviceRadiusKm: e.target.value }))
                            }
                          />
                          <p className="mt-1 text-xs text-muted">
                            Riders and dispatch only consider this shop within this distance from a pickup.
                          </p>
                        </div>
                      </div>

                      <div className="dc-form-actions mt-4">
                        <button type="submit" className="btn-primary btn-sm" disabled={branchBusy}>
                          {branchBusy ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                    ) : null}

                    {profileTab === 'pricing' && profile.branch.branchType === 'partner_shop' ? (
                      <div className="pt-1">
                        <ShopPricingPanel
                          branchId={profile.branch.id}
                          initialPricing={profile.branch.servicePricing}
                          initialAddonPricing={profile.branch.addonPricing}
                        />
                      </div>
                    ) : null}

                    {profileTab === 'address' ? (
                      <div className="pt-3">
                        <p className="text-xs text-muted">
                          Used for dispatch distance ranking — keep the pin accurate.
                        </p>
                        <div className="mt-3">
                          <BranchAddressEditor
                            value={addressForm}
                            onChange={setAddressForm}
                            resetKey={selectedId ?? undefined}
                          />
                        </div>
                        <div className="dc-form-actions mt-4">
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={branchBusy}
                            onClick={() => void updateBranch()}
                          >
                            {branchBusy ? 'Saving…' : 'Save changes'}
                          </button>
                        </div>
                      </div>
                    ) : null}
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
