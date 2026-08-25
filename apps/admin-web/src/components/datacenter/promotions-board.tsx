'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface Promotion {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  isActive: boolean;
  audience?: 'all' | 'new_customers';
  kind?: 'standard' | 'signup_template';
  maxUsesPerCustomer?: number;
  newCustomerWithinDays?: number;
  startsAt?: string;
  endsAt?: string;
  redemptions: number;
  discountGiven: number;
  revenueImpact: number;
  partnerUserId?: string;
  fundedBy?: 'platform' | 'partner';
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  adminNote?: string;
}

type PromoState = 'nominal' | 'attention';
type StatusTab = 'all' | 'active' | 'inactive';

const promoCopy: Record<PromoState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'Promotions live',
    detail: 'At least one promo code is active for customer checkout.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'No active promotions',
    detail: 'Create or re-enable a code — customers apply promos at checkout.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

function formatDiscount(p: Promotion) {
  return p.discountType === 'percent' ? `${p.discountValue}% off` : `${formatPeso(p.discountValue)} off`;
}

function isPromoExpired(p: Promotion, now = new Date()) {
  return Boolean(p.endsAt && new Date(p.endsAt) < now);
}

function formatValidity(p: Promotion) {
  if (!p.startsAt && !p.endsAt) return 'No expiry';
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${p.startsAt ? fmt(p.startsAt) : 'Now'} – ${p.endsAt ? fmt(p.endsAt) : 'Open'}`;
}

function formatAudience(p: Promotion) {
  if (p.kind === 'signup_template') return 'Signup template';
  if (p.audience === 'new_customers') return 'New customers';
  return 'All customers';
}

function formatUsesPerCustomer(p: Promotion) {
  return p.maxUsesPerCustomer != null && p.maxUsesPerCustomer > 0
    ? `${p.maxUsesPerCustomer}×`
    : 'Unlimited';
}

function derivePromoState(items: Promotion[]): PromoState {
  const now = new Date();
  return items.some((p) => p.isActive && !isPromoExpired(p, now)) ? 'nominal' : 'attention';
}

// ── Small blocks ───────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  onClick?: () => void;
  active?: boolean;
}) {
  const cls = `rounded-xl p-4 text-left ring-1 transition-all ${TILE_TONES[tone]} ${
    active ? 'ring-2 ring-primary/40' : ''
  }`;
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function ShareBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

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

export function PromotionsBoard() {
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Create form state
  const [code, setCode]                             = useState('');
  const [title, setTitle]                           = useState('');
  const [discountType, setDiscountType]             = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue]           = useState('10');
  const [minOrderAmount, setMinOrderAmount]         = useState('0');
  const [audience, setAudience]                     = useState<'all' | 'new_customers'>('all');
  const [kind, setKind]                             = useState<'standard' | 'signup_template'>('standard');
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState('');
  const [newCustomerWithinDays, setNewCustomerWithinDays] = useState('');
  const [startsAt, setStartsAt]                     = useState('');
  const [endsAt, setEndsAt]                         = useState('');
  const [saving, setSaving]                         = useState(false);
  const [actionError, setActionError]               = useState('');

  const load = useCallback(async () => {
    const data = await adminFetch<Promotion[]>('/admin/promotions');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data: items, loading, error, reload } = useAdminQuery(load, []);

  const promos = useMemo(() => items ?? [], [items]);
  const now = new Date();
  const activeCount = promos.filter((p) => p.isActive && !isPromoExpired(p, now)).length;
  const inactiveCount = promos.length - activeCount;
  const totalRedemptions = promos.reduce((s, p) => s + p.redemptions, 0);
  const totalDiscountGiven = promos.reduce((s, p) => s + p.discountGiven, 0);
  const totalRevenueImpact = promos.reduce((s, p) => s + p.revenueImpact, 0);
  const maxRedemptions = Math.max(1, ...promos.map((p) => p.redemptions));

  const tabFiltered = useMemo(() => {
    if (statusTab === 'active') return promos.filter((p) => p.isActive && !isPromoExpired(p, now));
    if (statusTab === 'inactive') return promos.filter((p) => !p.isActive || isPromoExpired(p, now));
    return promos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promos, statusTab]);

  const filteredPromos = useMemo(
    () => filterBySearch(tabFiltered, search, [(p) => p.code, (p) => p.title, (p) => p.description]).slice(0, limit),
    [tabFiltered, search, limit],
  );

  const selected = useMemo(
    () => (selectedId ? (promos.find((p) => p._id === selectedId) ?? null) : null),
    [promos, selectedId],
  );

  const promoState = derivePromoState(promos);
  const copy = promoCopy[promoState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const STATUS_TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All promotions', count: promos.length },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
  ];

  function selectTab(next: StatusTab) {
    setStatusTab(next);
    setSelectedId(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      await adminFetch('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          discountType,
          discountValue: Number(discountValue),
          minOrderAmount: Number(minOrderAmount) || 0,
          isActive: true,
          audience,
          kind,
          ...(maxUsesPerCustomer    ? { maxUsesPerCustomer: Number(maxUsesPerCustomer) }       : {}),
          ...(newCustomerWithinDays ? { newCustomerWithinDays: Number(newCustomerWithinDays) } : {}),
          ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
          ...(endsAt   ? { endsAt:   new Date(endsAt).toISOString()   } : {}),
        }),
      });
      setCode(''); setTitle(''); setDiscountValue('10'); setDiscountType('percent');
      setMinOrderAmount('0'); setAudience('all'); setKind('standard');
      setMaxUsesPerCustomer(''); setNewCustomerWithinDays(''); setStartsAt(''); setEndsAt('');
      setShowCreate(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create promotion');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Promotion) {
    setActionError('');
    setTogglingId(p._id);
    try {
      await adminFetch(`/admin/promotions/${p._id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !p.isActive }) });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update promotion');
    } finally {
      setTogglingId(null);
    }
  }

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  async function reviewPartnerPromo(p: Promotion, action: 'approve' | 'reject') {
    setActionError('');
    setReviewingId(p._id);
    try {
      await adminFetch(`/admin/promotions/${p._id}/review`, { method: 'POST', body: JSON.stringify({ action }) });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to review promotion');
    } finally {
      setReviewingId(null);
    }
  }

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ id: string; message: string } | null>(null);
  async function resetSpamUsage(p: Promotion) {
    setActionError('');
    setResetResult(null);
    setResettingId(p._id);
    try {
      const result = await adminFetch<{
        removedUsageCounters: number;
        removedRedemptions: number;
        removedCustomerPromos: number;
      }>(`/admin/promotions/${p._id}/reset-usage`, { method: 'POST' });
      const total = result.removedUsageCounters + result.removedRedemptions + result.removedCustomerPromos;
      setResetResult({
        id: p._id,
        message:
          total > 0
            ? `Cleared ${total} orphaned record${total === 1 ? '' : 's'} from deleted accounts.`
            : 'No orphaned usage found for this promo — nothing to clear.',
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset promo usage');
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Marketing</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Promotions
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Promo codes for customer checkout — percent or fixed discounts, with real redemption
              and revenue tracking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dc-sublabel tabular-nums" title="Last data refresh">Updated {updatedLabel}</span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                setShowCreate((v) => !v);
                setSelectedId(null);
              }}
            >
              {showCreate ? 'Close form' : 'New promotion'}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}
      {actionError && <div className="alert-error mb-4" role="alert">{actionError}</div>}

      {loading && !items && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Loading promotions…
        </div>
      )}

      {items && (
        <div className="space-y-4">
          {/* State banner */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {activeCount > 0 ? <span className="badge-accent px-3 py-1 text-xs font-semibold">{activeCount} active</span> : null}
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Total promotions"
              value={promos.length.toLocaleString()}
              tone="primary"
              onClick={() => selectTab('all')}
              active={statusTab === 'all'}
            />
            <StatTile
              label="Active"
              value={String(activeCount)}
              tone={activeCount > 0 ? 'accent' : 'rose'}
              onClick={() => selectTab('active')}
              active={statusTab === 'active'}
            />
            <StatTile
              label="Inactive"
              value={String(inactiveCount)}
              tone="secondary"
              onClick={() => selectTab('inactive')}
              active={statusTab === 'inactive'}
            />
            <StatTile
              label="Total redemptions"
              value={totalRedemptions.toLocaleString()}
              sub="completed orders"
              tone="violet"
            />
            <StatTile
              label="Discount given"
              value={formatPeso(totalDiscountGiven, true)}
              sub="all time"
              tone="amber"
            />
            <StatTile
              label="Revenue impact"
              value={formatPeso(totalRevenueImpact, true)}
              sub="orders using a code"
              tone="accent"
            />
          </div>

          {showCreate ? (
            <section className="dc-panel ring-2 ring-primary/30">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Create promotion</h2>
                <p className="text-xs text-muted">New code — active immediately after create</p>
              </div>
              <form onSubmit={create} className="dc-panel-body">
                <div className="dc-form-grid">
                  <div>
                    <label htmlFor="promo-code" className="form-label">Code</label>
                    <input id="promo-code" className="input-field text-code uppercase" placeholder="SUMMER20"
                      value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" />
                  </div>
                  <div>
                    <label htmlFor="promo-title" className="form-label">Title</label>
                    <input id="promo-title" className="input-field" placeholder="Summer discount"
                      value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="promo-type" className="form-label">Discount type</label>
                    <select id="promo-type" className="input-field" value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}>
                      <option value="percent">Percent</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="promo-value" className="form-label">Value</label>
                    <input id="promo-value" className="input-field" type="number" min={0}
                      value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="promo-min" className="form-label">Min order (₱)</label>
                    <input id="promo-min" className="input-field" type="number" min={0}
                      value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="promo-audience" className="form-label">Audience</label>
                    <select id="promo-audience" className="input-field" value={audience}
                      onChange={(e) => setAudience(e.target.value as 'all' | 'new_customers')}>
                      <option value="all">All customers</option>
                      <option value="new_customers">New customers only</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="promo-kind" className="form-label">Kind</label>
                    <select id="promo-kind" className="input-field" value={kind}
                      onChange={(e) => setKind(e.target.value as 'standard' | 'signup_template')}>
                      <option value="standard">Standard (shareable code)</option>
                      <option value="signup_template">Signup template (personal codes)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="promo-max-uses" className="form-label">Max uses / customer</label>
                    <input id="promo-max-uses" className="input-field" type="number" min={1} placeholder="Unlimited"
                      value={maxUsesPerCustomer} onChange={(e) => setMaxUsesPerCustomer(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="promo-new-days" className="form-label">New customer window (days)</label>
                    <input id="promo-new-days" className="input-field" type="number" min={1} placeholder="No limit"
                      value={newCustomerWithinDays} onChange={(e) => setNewCustomerWithinDays(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="promo-starts" className="form-label">Starts at</label>
                    <input id="promo-starts" className="input-field" type="datetime-local"
                      value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="promo-ends" className="form-label">Ends at</label>
                    <input id="promo-ends" className="input-field" type="datetime-local"
                      value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  </div>
                </div>
                <div className="dc-form-actions mt-4">
                  <button type="submit" disabled={saving} className="btn-primary btn-sm">
                    {saving ? 'Creating…' : 'Create promotion'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Promo catalog ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Promotion status"
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
                  searchPlaceholder="Code, title, description…"
                  limit={limit}
                  onLimitChange={setLimit}
                  total={tabFiltered.length}
                  filtered={filteredPromos.length}
                />
              </div>

              {filteredPromos.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">
                    {search || statusTab !== 'all' ? 'No promotions match' : 'No promotions yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {search || statusTab !== 'all' ? 'Try another filter or search term.' : 'Create a code for customers to apply at checkout.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[760px]">
                    <caption className="sr-only">Promotion codes catalog</caption>
                    <thead>
                      <tr>
                        <th scope="col">Code</th>
                        <th scope="col">Source</th>
                        <th scope="col">Discount</th>
                        <th scope="col">Redemptions</th>
                        <th scope="col" className="text-right">Discount given</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPromos.map((p) => {
                        const expired = isPromoExpired(p, now);
                        const isSelected = selectedId === p._id;
                        return (
                          <tr
                            key={p._id}
                            onClick={() => setSelectedId((prev) => (prev === p._id ? null : p._id))}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : !p.isActive ? 'opacity-70' : ''}`}
                          >
                            <td>
                              <span className="text-code font-bold text-primary">{p.code}</span>
                              <p className="max-w-[12rem] truncate text-xs text-muted" title={p.title}>{p.title}</p>
                            </td>
                            <td>
                              {p.partnerUserId ? (
                                <span className="badge-secondary">Partner</span>
                              ) : (
                                <span className="badge-neutral">Platform</span>
                              )}
                              {p.approvalStatus === 'pending' ? (
                                <span className="badge-warning ml-1">Pending review</span>
                              ) : p.approvalStatus === 'rejected' ? (
                                <span className="badge-danger ml-1">Rejected</span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap tabular-nums text-sm">{formatDiscount(p)}</td>
                            <td>
                              <p className="text-sm font-medium tabular-nums">{p.redemptions.toLocaleString()}</p>
                              <ShareBar value={p.redemptions} max={maxRedemptions} />
                            </td>
                            <td className="text-right text-sm font-medium tabular-nums">
                              {formatPeso(p.discountGiven)}
                            </td>
                            <td>
                              {expired
                                ? <span className="badge-neutral">Expired</span>
                                : <span className={p.isActive ? 'badge-accent' : 'badge-neutral'}>{p.isActive ? 'Active' : 'Inactive'}</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Detail rail ── */}
            <div className="xl:col-span-4">
              {!selected ? (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Promotion detail</h2>
                  </div>
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Select a promotion row to preview it here.
                  </p>
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-code text-sm font-bold text-primary">{selected.code}</p>
                      <p className="truncate text-sm font-medium text-slate-900" title={selected.title}>
                        {selected.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {isPromoExpired(selected, now) ? (
                          <span className="badge-neutral">Expired</span>
                        ) : (
                          <span className={selected.isActive ? 'badge-accent' : 'badge-neutral'}>
                            {selected.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                        <span className="badge-secondary capitalize">{selected.discountType}</span>
                        {selected.partnerUserId ? (
                          <span className="badge-secondary">Partner-created</span>
                        ) : (
                          <span className="badge-neutral">Platform</span>
                        )}
                        {selected.approvalStatus === 'pending' ? (
                          <span className="badge-warning">Pending review</span>
                        ) : selected.approvalStatus === 'rejected' ? (
                          <span className="badge-danger">Rejected</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm shrink-0"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {selected.description ? (
                    <RailSection title="Description">
                      <p className="text-sm leading-relaxed text-slate-700">{selected.description}</p>
                    </RailSection>
                  ) : null}

                  <RailSection title="Rules">
                    <RailRow label="Discount" value={formatDiscount(selected)} />
                    <RailRow label="Min order" value={selected.minOrderAmount > 0 ? formatPeso(selected.minOrderAmount) : 'None'} />
                    <RailRow label="Audience" value={formatAudience(selected)} />
                    <RailRow label="Uses / customer" value={formatUsesPerCustomer(selected)} />
                    <RailRow label="Validity" value={formatValidity(selected)} />
                    <RailRow
                      label="Funded by"
                      value={selected.fundedBy === 'partner' ? "Partner's own payout" : 'Lunara (platform)'}
                    />
                    {selected.partnerUserId ? (
                      <RailRow label="Scope" value="This partner's branches only" />
                    ) : null}
                  </RailSection>

                  {selected.partnerUserId && selected.approvalStatus === 'pending' ? (
                    <RailSection title="Review">
                      <p className="mb-2 text-xs text-muted">
                        Partner-created promo, awaiting approval before it&apos;s usable at checkout.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary btn-sm flex-1"
                          disabled={reviewingId === selected._id}
                          onClick={() => void reviewPartnerPromo(selected, 'approve')}
                        >
                          {reviewingId === selected._id ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-sm flex-1"
                          disabled={reviewingId === selected._id}
                          onClick={() => void reviewPartnerPromo(selected, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    </RailSection>
                  ) : null}

                  <RailSection title="Performance">
                    <RailRow label="Redemptions" value={selected.redemptions.toLocaleString()} />
                    <RailRow label="Discount given" value={formatPeso(selected.discountGiven)} />
                    <RailRow label="Revenue impact" value={formatPeso(selected.revenueImpact)} />
                  </RailSection>

                  <RailSection title="Spam cleanup">
                    <p className="text-xs leading-relaxed text-muted">
                      Clears usage caps and claim records left behind by spam accounts that have
                      since been deleted — doesn&apos;t touch real customers&apos; own usage.
                    </p>
                    <button
                      type="button"
                      className="btn-outline btn-sm mt-2 w-full"
                      disabled={resettingId === selected._id}
                      onClick={() => void resetSpamUsage(selected)}
                    >
                      {resettingId === selected._id ? 'Resetting…' : 'Reset orphaned usage'}
                    </button>
                    {resetResult?.id === selected._id ? (
                      <p className="mt-2 text-xs text-emerald-600">{resetResult.message}</p>
                    ) : null}
                  </RailSection>

                  <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
                    <button
                      type="button"
                      className="btn-outline btn-sm flex-1"
                      disabled={togglingId === selected._id}
                      onClick={() => void toggleActive(selected)}
                    >
                      {togglingId === selected._id ? 'Saving…' : selected.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <Link
                      href={`/orders?search=${encodeURIComponent(selected.code)}`}
                      className="btn-primary btn-sm flex-1 text-center"
                    >
                      View orders
                    </Link>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
