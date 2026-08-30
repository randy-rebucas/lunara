'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { StatTile, TILE_TONES } from '../ui/stat-tile';
import { adminFetch } from '../../lib/admin-api';
import { formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';
import { BranchAddressEditor, type BranchAddressValue } from './branch-address-editor';

interface DayHours {
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
}

type SubscriptionPlan = 'trial' | 'basic' | 'starter' | 'professional';

interface Shop {
  _id: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  ownerName?: string;
  subscriptionPlan: SubscriptionPlan;
  planPrice: number;
  planRenewsAt?: string;
  trialEndsAt?: string;
  totalOrders: number;
  revenue: number;
  orders30d: number;
  revenue30d: number;
  rating: number | null;
  reviewCount: number;
  branchNames: string[];
  mainBranchName: string | null;
  operatingHours: DayHours[];
}

interface ParentBranch {
  _id: string;
  code: string;
  name: string;
}

interface DetailBranch {
  _id: string;
  name: string;
  city: string;
  province: string;
  isActive: boolean;
  serviceRadiusKm?: number;
  maxActiveOrders: number;
}

interface RecentOrder {
  _id: string;
  status: string;
  total: number;
  createdAt: string;
}

interface ShopDetail {
  _id: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  ownerName?: string;
  businessName?: string;
  tin?: string;
  businessPermitNumber?: string;
  businessPermitVerified: boolean;
  birRegistrationNumber?: string;
  birRegistrationVerified: boolean;
  deliveryRadiusKm?: number;
  subscriptionPlan: SubscriptionPlan;
  planPrice: number;
  planRenewsAt?: string;
  trialEndsAt?: string;
  createdAt: string;
  rating: number | null;
  reviewCount: number;
  performance: {
    ordersThisMonth: number;
    completedThisMonth: number;
    cancelledThisMonth: number;
    revenueThisMonth: number;
    ordersDelta: number;
    completedDelta: number;
    cancelledDelta: number;
    revenueDelta: number;
    completionRate: number;
    repeatRate: number;
  };
  branches: DetailBranch[];
  coverageCities: string[];
  pickupRadiusKm: number | null;
  recentOrders: RecentOrder[];
}

type DetailTab = 'overview' | 'branches' | 'subscription' | 'documents' | 'invoices' | 'audit' | 'settings';

const ORDER_STATUS_BADGE: Record<string, string> = {
  delivered: 'badge-accent',
  completed: 'badge-accent',
  cancelled: 'badge-neutral',
  refunded: 'badge-neutral',
};

function orderStatusBadge(status: string) {
  return ORDER_STATUS_BADGE[status] ?? 'badge-secondary';
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDelta(delta: number) {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}% vs last month`;
}

type StatusTab = 'all' | 'active' | 'trial' | 'inactive';

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  trial: 'Trial',
  basic: 'Basic',
  starter: 'Starter',
  professional: 'Professional',
};

const PLAN_BADGE: Record<SubscriptionPlan, string> = {
  trial: 'badge-warning',
  basic: 'badge-neutral',
  starter: 'badge-secondary',
  professional: 'badge-accent',
};

function isTrial(s: Shop) {
  return s.subscriptionPlan === 'trial';
}

/** Other branches are variants of the partner's one main shop — lead with it, then list the rest. */
function branchSummary(shop: Shop): string {
  const others = shop.branchNames.filter((n) => n !== shop.mainBranchName);
  if (!shop.mainBranchName) return shop.branchNames.join(', ');
  return others.length > 0 ? `${shop.mainBranchName} (Main) + ${others.length} branch${others.length === 1 ? '' : 'es'}` : `${shop.mainBranchName} (Main)`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatHours(hours: DayHours[]) {
  if (!hours || hours.length === 0) return 'Not set';
  const todayHours = hours[new Date().getDay()];
  if (!todayHours || todayHours.isClosed) return 'Closed today';
  return `${todayHours.openTime ?? '—'} – ${todayHours.closeTime ?? '—'}`;
}

// ── Small blocks ─────────────────────────────────────────────────────────
function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null) return <span className="text-sm text-muted">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-900">
      <span className="text-amber-500" aria-hidden>★</span>
      {rating.toFixed(1)}
      <span className="text-xs font-normal text-muted">({count})</span>
    </span>
  );
}

function partnerInitial(shop: Shop) {
  return (shop.ownerName ?? shop.email ?? shop._id).trim().charAt(0).toUpperCase() || '?';
}

function Avatar({ shop }: { shop: Shop }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
      aria-hidden
    >
      {partnerInitial(shop)}
    </span>
  );
}

function SlideDrawer({
  open,
  onClose,
  ariaLabel,
  widthClass = 'md:w-2/5',
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={`Close ${ariaLabel}`}
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative flex h-full w-full min-w-[22rem] flex-col overflow-y-auto bg-surface shadow-2xl transition-transform duration-300 ease-out ${widthClass} ${
          entered ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const ADD_BRANCH_INITIAL_ADDRESS: BranchAddressValue = {
  line1: '',
  city: '',
  province: '',
  latitude: 14.5995,
  longitude: 120.9842,
};

function AddBranchDrawer({
  open,
  partner,
  parentBranches,
  onClose,
  onCreated,
}: {
  open: boolean;
  partner: Shop | null;
  parentBranches: ParentBranch[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [branchType, setBranchType] = useState<'partner_shop' | 'franchise'>('partner_shop');
  const [parentBranchId, setParentBranchId] = useState('');
  const [address, setAddress] = useState<BranchAddressValue>(ADD_BRANCH_INITIAL_ADDRESS);
  const [addressResetToken, setAddressResetToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setCode('');
    setName('');
    setBranchType('partner_shop');
    setParentBranchId('');
    setAddress(ADD_BRANCH_INITIAL_ADDRESS);
    setAddressResetToken((t) => t + 1);
    setError('');
  }, [open]);

  if (!partner) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!partner) return;
    setBusy(true);
    setError('');
    try {
      await adminFetch('/admin/branches', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          branchType,
          parentBranchId,
          partnerUserId: partner._id,
          line1: address.line1.trim(),
          city: address.city.trim(),
          province: address.province.trim(),
          coordinates: [address.longitude, address.latitude],
        }),
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SlideDrawer open={open} onClose={onClose} ariaLabel="Add branch">
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Add branch</h2>
          <p className="mt-0.5 truncate text-xs text-muted">
            New location for {partner.ownerName ?? partner.email ?? partner._id}
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm shrink-0" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-4 px-5 py-4">
          {error ? (
            <div className="alert-error" role="alert">
              {error}
            </div>
          ) : null}

          <div>
            <label htmlFor="add-branch-code" className="form-label">Branch code</label>
            <input
              id="add-branch-code"
              className="input-field uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="e.g. PS-QC-01"
            />
          </div>
          <div>
            <label htmlFor="add-branch-name" className="form-label">Branch name</label>
            <input
              id="add-branch-name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Quezon City North"
            />
          </div>
          <div>
            <label htmlFor="add-branch-type" className="form-label">Type</label>
            <select
              id="add-branch-type"
              className="input-field"
              value={branchType}
              onChange={(e) => setBranchType(e.target.value as 'partner_shop' | 'franchise')}
            >
              <option value="partner_shop">Partner shop</option>
              <option value="franchise">Franchise</option>
            </select>
          </div>
          <div>
            <label htmlFor="add-branch-parent" className="form-label">Parent branch</label>
            <select
              id="add-branch-parent"
              className="input-field"
              value={parentBranchId}
              onChange={(e) => setParentBranchId(e.target.value)}
              required
            >
              <option value="">Select parent</option>
              {parentBranches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-border/60 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Address</h3>
            <p className="mt-0.5 text-xs text-muted">Search to auto-fill, or pin the exact pickup location.</p>
            <div className="mt-3">
              <BranchAddressEditor value={address} onChange={setAddress} resetKey={addressResetToken} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border/60 px-5 py-4">
          <button type="button" className="btn-outline btn-sm flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-sm flex-1" disabled={busy}>
            {busy ? 'Creating…' : 'Create branch'}
          </button>
        </div>
      </form>
    </SlideDrawer>
  );
}

function MiniStatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
}) {
  return (
    <div className={`rounded-lg p-3 ring-1 ${TILE_TONES[tone]}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-[0.6875rem] text-muted">{sub}</p> : null}
    </div>
  );
}

function DetailTabs({ tab, onChange }: { tab: DetailTab; onChange: (t: DetailTab) => void }) {
  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'branches', label: 'Branches' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'documents', label: 'Documents' },
    { id: 'audit', label: 'Audit Trail' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <div className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3" role="tablist" aria-label="Partner detail tabs">
      <div className="flex min-w-max gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onChange(t.id)}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const EMPTY_PROFILE_EDIT = {
  ownerName: '',
  businessName: '',
  tin: '',
  businessPermitNumber: '',
  birRegistrationNumber: '',
  deliveryRadiusKm: '',
};

function PartnerDetailsDrawer({
  open,
  shop,
  onClose,
  onAddBranch,
  onChanged,
}: {
  open: boolean;
  shop: Shop | null;
  onClose: () => void;
  onAddBranch: (shop: Shop) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [togglingActive, setTogglingActive] = useState(false);
  const [actionError, setActionError] = useState('');

  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState(EMPTY_PROFILE_EDIT);
  const [savingInfo, setSavingInfo] = useState(false);

  const [editingSub, setEditingSub] = useState(false);
  const [subPlan, setSubPlan] = useState<SubscriptionPlan>('trial');
  const [subPrice, setSubPrice] = useState('0');
  const [subRenewsAt, setSubRenewsAt] = useState('');
  const [subTrialEndsAt, setSubTrialEndsAt] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  const [verifyBusy, setVerifyBusy] = useState<'permit' | 'bir' | null>(null);

  const shopId = shop?._id ?? null;

  const loadDetail = useCallback(async () => {
    if (!shopId) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await adminFetch<ShopDetail>(`/admin/shops/${shopId}/detail`);
      setDetail(res);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load partner details');
    } finally {
      setDetailLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!open || !shopId) {
      setDetail(null);
      setTab('overview');
      setEditingInfo(false);
      setEditingSub(false);
      return;
    }
    void loadDetail();
  }, [open, shopId, loadDetail]);

  useEffect(() => {
    if (!detail) return;
    setInfoForm({
      ownerName: detail.ownerName ?? '',
      businessName: detail.businessName ?? '',
      tin: detail.tin ?? '',
      businessPermitNumber: detail.businessPermitNumber ?? '',
      birRegistrationNumber: detail.birRegistrationNumber ?? '',
      deliveryRadiusKm: detail.deliveryRadiusKm != null ? String(detail.deliveryRadiusKm) : '',
    });
    setSubPlan(detail.subscriptionPlan);
    setSubPrice(String(detail.planPrice ?? 0));
    setSubRenewsAt(detail.planRenewsAt ? detail.planRenewsAt.slice(0, 10) : '');
    setSubTrialEndsAt(detail.trialEndsAt ? detail.trialEndsAt.slice(0, 10) : '');
  }, [detail]);

  if (!shop) return null;

  async function toggleActive() {
    if (!shop || !detail) return;
    const nextActive = !detail.isActive;
    if (
      !nextActive &&
      !window.confirm(
        `Suspend ${detail.businessName ?? shop.ownerName ?? shop.email ?? shop._id}? This also deactivates all of their branches and blocks new dispatch to them. This fails if they have orders still in progress.`,
      )
    ) {
      return;
    }
    setTogglingActive(true);
    setActionError('');
    try {
      await adminFetch(`/admin/shops/${shop._id}`, { method: 'PATCH', body: JSON.stringify({ isActive: nextActive }) });
      await Promise.all([loadDetail(), onChanged()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update partner status');
    } finally {
      setTogglingActive(false);
    }
  }

  async function saveInfo() {
    if (!shop) return;
    setSavingInfo(true);
    setActionError('');
    try {
      await adminFetch(`/admin/shops/${shop._id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          ownerName: infoForm.ownerName.trim() || undefined,
          businessName: infoForm.businessName.trim() || undefined,
          tin: infoForm.tin.trim() || undefined,
          businessPermitNumber: infoForm.businessPermitNumber.trim() || undefined,
          birRegistrationNumber: infoForm.birRegistrationNumber.trim() || undefined,
          ...(infoForm.deliveryRadiusKm ? { deliveryRadiusKm: Number(infoForm.deliveryRadiusKm) } : {}),
        }),
      });
      setEditingInfo(false);
      await Promise.all([loadDetail(), onChanged()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update partner information');
    } finally {
      setSavingInfo(false);
    }
  }

  async function saveSubscription() {
    if (!shop) return;
    setSavingSub(true);
    setActionError('');
    try {
      await adminFetch(`/admin/shops/${shop._id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          subscriptionPlan: subPlan,
          planPrice: Number(subPrice) || 0,
          ...(subRenewsAt ? { planRenewsAt: new Date(subRenewsAt).toISOString() } : {}),
          ...(subTrialEndsAt ? { trialEndsAt: new Date(subTrialEndsAt).toISOString() } : {}),
        }),
      });
      setEditingSub(false);
      await Promise.all([loadDetail(), onChanged()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setSavingSub(false);
    }
  }

  async function toggleVerified(field: 'businessPermitVerified' | 'birRegistrationVerified', which: 'permit' | 'bir') {
    if (!shop || !detail) return;
    setVerifyBusy(which);
    setActionError('');
    try {
      await adminFetch(`/admin/shops/${shop._id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !detail[field] }),
      });
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update verification');
    } finally {
      setVerifyBusy(null);
    }
  }

  const displayName = detail?.businessName ?? shop.ownerName ?? shop.email ?? shop._id;
  const fullyVerified = detail ? detail.businessPermitVerified && detail.birRegistrationVerified : false;

  return (
    <SlideDrawer open={open} onClose={onClose} ariaLabel="Partner details" widthClass="md:w-1/2">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar shop={shop} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-slate-900" title={displayName}>
                  {displayName}
                </p>
                {fullyVerified ? (
                  <span className="text-primary" title="Business permit and BIR registration verified" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </div>
              <p className="text-code text-xs text-muted">ID: {shop._id.slice(-8).toUpperCase()}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className={shop.isActive ? 'badge-accent' : 'badge-neutral'}>
                  {shop.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className={PLAN_BADGE[shop.subscriptionPlan]}>{PLAN_LABEL[shop.subscriptionPlan]}</span>
                {detail ? <Stars rating={detail.rating} count={detail.reviewCount} /> : null}
              </div>
              {shop.branchNames.length > 0 ? (
                <p className="mt-1 truncate text-xs text-muted">{branchSummary(shop)}</p>
              ) : null}
            </div>
          </div>
          <button type="button" className="btn-ghost btn-sm shrink-0" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <DetailTabs tab={tab} onChange={setTab} />

      <div className="flex-1">
        {detailError ? (
          <div className="alert-error m-4" role="alert">
            {detailError}
          </div>
        ) : null}
        {actionError ? (
          <div className="alert-error m-4" role="alert">
            {actionError}
          </div>
        ) : null}

        {detailLoading && !detail ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
            Loading details…
          </div>
        ) : null}

        {detail && tab === 'overview' ? (
          <>
            <div className="grid grid-cols-3 gap-2 px-5 py-4">
              <MiniStatTile
                label="Orders"
                value={detail.performance.ordersThisMonth.toLocaleString()}
                sub={formatDelta(detail.performance.ordersDelta)}
                tone="primary"
              />
              <MiniStatTile
                label="Completed"
                value={detail.performance.completedThisMonth.toLocaleString()}
                sub={formatDelta(detail.performance.completedDelta)}
                tone="accent"
              />
              <MiniStatTile
                label="Cancelled"
                value={detail.performance.cancelledThisMonth.toLocaleString()}
                sub={formatDelta(detail.performance.cancelledDelta)}
                tone="rose"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 px-5 pb-4">
              <MiniStatTile label="Completion rate" value={`${detail.performance.completionRate}%`} tone="secondary" />
              <MiniStatTile
                label="Avg. rating"
                value={detail.rating != null ? detail.rating.toFixed(1) : '—'}
                sub={`${detail.reviewCount} reviews`}
                tone="amber"
              />
              <MiniStatTile label="Repeat rate" value={`${detail.performance.repeatRate}%`} tone="secondary" />
            </div>

            <div className="border-t border-border/60 px-5 py-4">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Business information</p>
                {!editingInfo ? (
                  <button type="button" className="link-primary text-xs font-medium" onClick={() => setEditingInfo(true)}>
                    Edit →
                  </button>
                ) : null}
              </div>
              {!editingInfo ? (
                <div className="space-y-2">
                  <RailRow label="Business name" value={detail.businessName ?? '—'} />
                  <RailRow label="Owner" value={detail.ownerName ?? '—'} />
                  <RailRow label="Email" value={detail.email ?? '—'} />
                  <RailRow label="Phone" value={detail.phone ?? '—'} />
                  <RailRow label="Address" value={shop.branchNames.length > 0 ? branchSummary(shop) : '—'} />
                  <RailRow label="Business hours (today)" value={formatHours(shop.operatingHours)} />
                  <RailRow label="Joined" value={formatDate(detail.createdAt)} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="info-business-name" className="form-label">Business name</label>
                    <input
                      id="info-business-name"
                      className="input-field"
                      value={infoForm.businessName}
                      onChange={(e) => setInfoForm((f) => ({ ...f, businessName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="info-owner-name" className="form-label">Owner name</label>
                    <input
                      id="info-owner-name"
                      className="input-field"
                      value={infoForm.ownerName}
                      onChange={(e) => setInfoForm((f) => ({ ...f, ownerName: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" className="btn-primary btn-sm flex-1" disabled={savingInfo} onClick={() => void saveInfo()}>
                      {savingInfo ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="btn-outline btn-sm flex-1" disabled={savingInfo} onClick={() => setEditingInfo(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <RailSection title="Coverage area">
              <RailRow label="Pickup radius" value={detail.pickupRadiusKm != null ? `${detail.pickupRadiusKm} km` : '—'} />
              <RailRow label="Delivery radius" value={detail.deliveryRadiusKm != null ? `${detail.deliveryRadiusKm} km` : '—'} />
              <RailRow label="Cities covered" value={detail.coverageCities.length > 0 ? detail.coverageCities.join(', ') : '—'} />
            </RailSection>

            <div className="border-t border-border/60 px-5 py-4">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recent orders</p>
                <Link href="/orders" className="link-primary text-xs font-medium">View all →</Link>
              </div>
              {detail.recentOrders.length === 0 ? (
                <p className="text-sm text-muted">No orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.recentOrders.map((o) => (
                    <div key={o._id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="text-code font-medium text-slate-900">ORD-{o._id.slice(-6).toUpperCase()}</p>
                        <p className="text-xs text-muted">{formatDate(o.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums">{formatPesoWhole(o.total)}</span>
                        <span className={orderStatusBadge(o.status)}>{formatStatusLabel(o.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/60 px-5 py-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Quick actions</p>
              <div className="space-y-2">
                <Link
                  href={`/partners/${shop._id}/command-center`}
                  className="btn-outline btn-sm block w-full text-left"
                >
                  Open command center
                </Link>
                <button type="button" className="btn-outline btn-sm w-full text-left" onClick={() => onAddBranch(shop)}>
                  Add branch
                </button>
                <button type="button" className="btn-outline btn-sm w-full text-left" onClick={() => setTab('subscription')}>
                  Manage subscription
                </button>
                <button type="button" className="btn-outline btn-sm w-full text-left" onClick={() => setTab('documents')}>
                  Verify documents
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm w-full text-left"
                  disabled={togglingActive}
                  onClick={() => void toggleActive()}
                >
                  {togglingActive ? 'Saving…' : detail.isActive ? 'Suspend partner' : 'Reactivate partner'}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {detail && tab === 'branches' ? (
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{detail.branches.length} branch(es)</p>
              <button type="button" className="btn-primary btn-sm" onClick={() => onAddBranch(shop)}>
                + Add branch
              </button>
            </div>
            {detail.branches.length === 0 ? (
              <p className="text-sm text-muted">No branches yet.</p>
            ) : (
              <div className="space-y-2">
                {detail.branches.map((b) => (
                  <div key={b._id} className="rounded-lg border border-border/60 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{b.name}</p>
                      <span className={b.isActive ? 'badge-accent' : 'badge-neutral'}>
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {b.city}, {b.province} · Capacity {b.maxActiveOrders}
                      {b.serviceRadiusKm ? ` · ${b.serviceRadiusKm}km radius` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link href="/branches" className="link-primary mt-3 inline-block text-xs font-medium">
              Manage in Branch network →
            </Link>
          </div>
        ) : null}

        {detail && tab === 'subscription' ? (
          <div className="px-5 py-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Active subscription</p>
              {!editingSub ? (
                <button type="button" className="link-primary text-xs font-medium" onClick={() => setEditingSub(true)}>
                  Edit →
                </button>
              ) : null}
            </div>
            {!editingSub ? (
              <div className="space-y-2">
                <RailRow label="Plan" value={PLAN_LABEL[detail.subscriptionPlan]} />
                <RailRow label="Price / month" value={formatPesoWhole(detail.planPrice)} />
                <RailRow
                  label={detail.subscriptionPlan === 'trial' ? 'Trial ends' : 'Renews on'}
                  value={detail.subscriptionPlan === 'trial' ? formatDate(detail.trialEndsAt) : formatDate(detail.planRenewsAt)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor="sub-plan" className="form-label">Plan</label>
                  <select id="sub-plan" className="input-field" value={subPlan} onChange={(e) => setSubPlan(e.target.value as SubscriptionPlan)}>
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sub-price" className="form-label">Price / month (₱)</label>
                  <input id="sub-price" type="number" min={0} className="input-field" value={subPrice} onChange={(e) => setSubPrice(e.target.value)} />
                </div>
                {subPlan === 'trial' ? (
                  <div>
                    <label htmlFor="sub-trial-ends" className="form-label">Trial ends</label>
                    <input id="sub-trial-ends" type="date" className="input-field" value={subTrialEndsAt} onChange={(e) => setSubTrialEndsAt(e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="sub-renews" className="form-label">Renews on</label>
                    <input id="sub-renews" type="date" className="input-field" value={subRenewsAt} onChange={(e) => setSubRenewsAt(e.target.value)} />
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="button" className="btn-primary btn-sm flex-1" disabled={savingSub} onClick={() => void saveSubscription()}>
                    {savingSub ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="btn-outline btn-sm flex-1" disabled={savingSub} onClick={() => setEditingSub(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {detail && tab === 'invoices' ? (
          <div className="px-5 py-4">
            <p className="text-sm text-muted">
              Commission billing and payment history for this partner are managed in Invoices.
            </p>
            <Link href="/partners/invoices" className="link-primary mt-2 inline-block text-xs font-medium">
              Open Invoices →
            </Link>
          </div>
        ) : null}

        {detail && tab === 'documents' ? (
          <div className="px-5 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="doc-tin" className="form-label">TIN</label>
              </div>
              <input
                id="doc-tin"
                className="input-field"
                value={infoForm.tin}
                onChange={(e) => setInfoForm((f) => ({ ...f, tin: e.target.value }))}
                placeholder="000-000-000-000"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="doc-permit" className="form-label">Business permit number</label>
                <span className={detail.businessPermitVerified ? 'badge-accent' : 'badge-neutral'}>
                  {detail.businessPermitVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  id="doc-permit"
                  className="input-field flex-1"
                  value={infoForm.businessPermitNumber}
                  onChange={(e) => setInfoForm((f) => ({ ...f, businessPermitNumber: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn-outline btn-sm shrink-0"
                  disabled={verifyBusy === 'permit'}
                  onClick={() => void toggleVerified('businessPermitVerified', 'permit')}
                >
                  {detail.businessPermitVerified ? 'Unverify' : 'Verify'}
                </button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="doc-bir" className="form-label">BIR registration number</label>
                <span className={detail.birRegistrationVerified ? 'badge-accent' : 'badge-neutral'}>
                  {detail.birRegistrationVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  id="doc-bir"
                  className="input-field flex-1"
                  value={infoForm.birRegistrationNumber}
                  onChange={(e) => setInfoForm((f) => ({ ...f, birRegistrationNumber: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn-outline btn-sm shrink-0"
                  disabled={verifyBusy === 'bir'}
                  onClick={() => void toggleVerified('birRegistrationVerified', 'bir')}
                >
                  {detail.birRegistrationVerified ? 'Unverify' : 'Verify'}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="doc-delivery-radius" className="form-label">Delivery radius (km)</label>
              <input
                id="doc-delivery-radius"
                type="number"
                min={0}
                className="input-field"
                value={infoForm.deliveryRadiusKm}
                onChange={(e) => setInfoForm((f) => ({ ...f, deliveryRadiusKm: e.target.value }))}
              />
            </div>
            <button type="button" className="btn-primary btn-sm" disabled={savingInfo} onClick={() => void saveInfo()}>
              {savingInfo ? 'Saving…' : 'Save documents'}
            </button>
          </div>
        ) : null}

        {detail && tab === 'audit' ? (
          <div className="px-5 py-4">
            <p className="text-sm text-muted">
              Admin actions on this partner&apos;s account and branches are recorded in the audit log.
            </p>
            <Link href="/audit-log" className="link-primary mt-2 inline-block text-xs font-medium">
              Open Audit log →
            </Link>
          </div>
        ) : null}

        {detail && tab === 'settings' ? (
          <div className="px-5 py-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Account status</p>
            <p className="mb-3 text-sm text-muted">
              Suspending blocks new dispatch to all of this partner&apos;s branches. This fails if they have orders
              still in progress.
            </p>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={togglingActive}
              onClick={() => void toggleActive()}
            >
              {togglingActive ? 'Saving…' : detail.isActive ? 'Suspend partner' : 'Reactivate partner'}
            </button>
            <p className="mt-4 text-sm text-muted">
              Branding, domain, and app appearance are managed separately.
            </p>
            <Link href="/partners/branding" className="link-primary mt-1 inline-block text-xs font-medium">
              Open Branding →
            </Link>
          </div>
        ) : null}
      </div>
    </SlideDrawer>
  );
}

export function PartnersBoard() {
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [addBranchPartnerId, setAddBranchPartnerId] = useState<string | null>(null);
  const [parentBranches, setParentBranches] = useState<ParentBranch[]>([]);

  const load = useCallback(async () => {
    const [res, branches] = await Promise.all([
      adminFetch<{ shops: Shop[] }>('/admin/shops'),
      adminFetch<ParentBranch[]>('/admin/branches/parents'),
    ]);
    setParentBranches(branches);
    setLastUpdated(new Date());
    return res.shops;
  }, []);

  const { data: items, loading, error, reload } = useAdminQuery(load, []);

  const shops = useMemo(() => items ?? [], [items]);
  const activeCount = shops.filter((s) => s.isActive).length;
  const trialCount = shops.filter((s) => isTrial(s)).length;
  const inactiveCount = shops.filter((s) => !s.isActive).length;
  const totalOrders = shops.reduce((sum, s) => sum + s.totalOrders, 0);
  const totalRevenue30d = shops.reduce((sum, s) => sum + s.revenue30d, 0);

  const tabFiltered = useMemo(() => {
    if (statusTab === 'active') return shops.filter((s) => s.isActive);
    if (statusTab === 'trial') return shops.filter((s) => isTrial(s));
    if (statusTab === 'inactive') return shops.filter((s) => !s.isActive);
    return shops;
  }, [shops, statusTab]);

  const filteredShops = useMemo(
    () =>
      filterBySearch(tabFiltered, search, [
        (s) => s.email,
        (s) => s.phone,
        (s) => s.ownerName,
        (s) => s._id,
        (s) => s.branchNames.join(' '),
      ]).slice(0, limit),
    [tabFiltered, search, limit],
  );

  const selected = useMemo(
    () => (selectedId ? (shops.find((s) => s._id === selectedId) ?? null) : null),
    [shops, selectedId],
  );

  const addBranchPartner = useMemo(
    () => (addBranchPartnerId ? (shops.find((s) => s._id === addBranchPartnerId) ?? null) : null),
    [shops, addBranchPartnerId],
  );

  function openAddBranch(shop: Shop) {
    setAddBranchPartnerId(shop._id);
    setAddBranchOpen(true);
  }

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const STATUS_TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All partners', count: shops.length },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'trial', label: 'On trial', count: trialCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
  ];

  function selectTab(next: StatusTab) {
    setStatusTab(next);
    setSelectedId(null);
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Partner network</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Partners (Laundry Shops)
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Manage laundry shop partners, subscriptions, performance, and reviews.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/branches" className="btn-outline btn-sm">
              Branch network
            </Link>
            <Link href="/partners/new" className="btn-primary btn-sm">
              + Add New Partner
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}
      {loading && !items ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading partners…
        </div>
      ) : null}

      {items ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile
              label="Total Partners"
              value={shops.length.toLocaleString()}
              tone="primary"
              onClick={() => selectTab('all')}
              active={statusTab === 'all'}
            />
            <StatTile
              label="Active Partners"
              value={String(activeCount)}
              tone="accent"
              onClick={() => selectTab('active')}
              active={statusTab === 'active'}
            />
            <StatTile
              label="On Trial"
              value={String(trialCount)}
              tone={trialCount > 0 ? 'amber' : 'secondary'}
              onClick={() => selectTab('trial')}
              active={statusTab === 'trial'}
            />
            <StatTile
              label="Inactive / Suspended"
              value={String(inactiveCount)}
              tone={inactiveCount > 0 ? 'amber' : 'secondary'}
              onClick={() => selectTab('inactive')}
              active={statusTab === 'inactive'}
            />
            <StatTile
              label="Revenue (30d)"
              value={formatPesoWhole(totalRevenue30d)}
              sub={`${totalOrders.toLocaleString()} lifetime orders`}
              tone="secondary"
            />
          </div>

          <div className="space-y-4">
            <section className="dc-panel min-w-0">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Partner status"
              >
                <div className="flex min-w-max gap-1">
                  {STATUS_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={statusTab === t.id}
                      onClick={() => selectTab(t.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        statusTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                        {t.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-1">
                <ListControls
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search partners by name, owner, or location…"
                  limit={limit}
                  onLimitChange={setLimit}
                  total={tabFiltered.length}
                  filtered={filteredShops.length}
                />
              </div>

              {filteredShops.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">
                    {search || statusTab !== 'all' ? 'No partners match' : 'No partner accounts yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {search || statusTab !== 'all'
                      ? 'Try another filter or search term.'
                      : 'Invite a partner to get started.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[860px]">
                    <caption className="sr-only">Partner shop accounts</caption>
                    <thead>
                      <tr>
                        <th scope="col">Partner</th>
                        <th scope="col">Location</th>
                        <th scope="col">Status</th>
                        <th scope="col">Subscription</th>
                        <th scope="col" className="text-right">
                          Orders (30d)
                        </th>
                        <th scope="col" className="text-right">
                          Revenue (30d)
                        </th>
                        <th scope="col">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShops.map((s) => {
                        const isSelected = selectedId === s._id;
                        return (
                          <tr
                            key={s._id}
                            onClick={() => setSelectedId((prev) => (prev === s._id ? null : s._id))}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${
                              isSelected ? 'bg-primary/5 hover:bg-primary/5' : !s.isActive ? 'opacity-70' : ''
                            }`}
                          >
                            <td>
                              <div className="flex items-center gap-2.5">
                                <Avatar shop={s} />
                                <div className="min-w-0">
                                  <p
                                    className="max-w-[10rem] truncate font-medium text-slate-900"
                                    title={s.ownerName ?? s.email ?? s._id}
                                  >
                                    {s.ownerName ?? s.email ?? s._id}
                                  </p>
                                  <p className="text-code text-xs text-muted">ID: {s._id.slice(-8).toUpperCase()}</p>
                                </div>
                              </div>
                            </td>
                            <td className="max-w-[10rem] truncate text-muted" title={s.branchNames.join(', ')}>
                              {s.branchNames.length > 0 ? branchSummary(s) : '—'}
                            </td>
                            <td>
                              <span className={s.isActive ? 'badge-accent' : 'badge-neutral'}>
                                {s.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <span className={PLAN_BADGE[s.subscriptionPlan]}>{PLAN_LABEL[s.subscriptionPlan]}</span>
                              <p className="mt-0.5 text-xs text-muted">
                                {isTrial(s)
                                  ? `Ends ${formatDate(s.trialEndsAt)}`
                                  : `Renews ${formatDate(s.planRenewsAt)}`}
                              </p>
                            </td>
                            <td className="text-right tabular-nums">{s.orders30d.toLocaleString()}</td>
                            <td className="text-right tabular-nums">{formatPesoWhole(s.revenue30d)}</td>
                            <td>
                              <Stars rating={s.rating} count={s.reviewCount} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <PartnerDetailsDrawer
            open={!!selected}
            shop={selected}
            onClose={() => setSelectedId(null)}
            onAddBranch={openAddBranch}
            onChanged={reload}
          />
        </div>
      ) : null}

      <AddBranchDrawer
        open={addBranchOpen}
        partner={addBranchPartner}
        parentBranches={parentBranches}
        onClose={() => setAddBranchOpen(false)}
        onCreated={reload}
      />
    </div>
  );
}
