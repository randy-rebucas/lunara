'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
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
}

type PromoState = 'nominal' | 'attention';

const QUICK_ACTIONS = [
  { href: '/',        label: 'Ops center' },
  { href: '/orders',  label: 'Orders' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/reports', label: 'Reports' },
  { href: '/shops',   label: 'Shops' },
] as const;

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

const STATUS_FILTER_OPTIONS = [
  { value: '',         label: 'All statuses' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

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

export function PromotionsBoard() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [limit, setLimit]               = useState(50);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);

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

  const promos      = useMemo(() => items ?? [], [items]);
  const now         = new Date();
  const activeCount   = promos.filter((p) => p.isActive && !isPromoExpired(p, now)).length;
  const inactiveCount = promos.length - activeCount;
  const percentCount  = promos.filter((p) => p.discountType === 'percent').length;
  const fixedCount    = promos.filter((p) => p.discountType === 'fixed').length;

  const filteredPromos = useMemo(() => {
    let list = promos;
    if (statusFilter === 'active')   list = list.filter((p) => p.isActive && !isPromoExpired(p, now));
    if (statusFilter === 'inactive') list = list.filter((p) => !p.isActive || isPromoExpired(p, now));
    return filterBySearch(list, search, [(p) => p.code, (p) => p.title, (p) => p.description]).slice(0, limit);
  }, [promos, statusFilter, search, limit, now]);

  const promoState = derivePromoState(promos);
  const copy       = promoCopy[promoState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

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
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create promotion');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Promotion) {
    setActionError('');
    try {
      await adminFetch(`/admin/promotions/${p._id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !p.isActive }) });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update promotion');
    }
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Growth</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Promotions
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Promo codes for customer checkout — percent or fixed discounts. Toggle active state without deleting codes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-neutral">Polling</span>
            <span className="dc-sublabel tabular-nums" title="Last data refresh">Updated {updatedLabel}</span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <a href="#promo-create" className="btn-primary btn-sm">New promotion</a>
          </div>
        </div>
      </header>

      {error       && <div className="alert-error mb-4" role="alert">{error}</div>}
      {actionError && <div className="alert-error mb-4" role="alert">{actionError}</div>}

      {loading && !items && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Loading promotions…
        </div>
      )}

      {items && (
        <div className="space-y-3">

          {/* ── State banner ─────────────────────────────────────── */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {activeCount > 0   && <span className="badge-accent px-3 py-1 text-xs font-semibold">{activeCount} active</span>}
            {inactiveCount > 0 && <span className="badge-neutral px-3 py-1 text-xs font-semibold">{inactiveCount} inactive</span>}
          </div>

          {/* ── Metric row ───────────────────────────────────────── */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell label="Active codes"  value={activeCount}   highlight={activeCount > 0 ? 'accent' : 'warning'} />
            <MetricCell label="Inactive"      value={inactiveCount} />
            <MetricCell label="Percent off"   value={percentCount}  sub="discount type" />
            <MetricCell label="Fixed amount"  value={fixedCount}    sub="discount type" />
          </div>

          {/* ── Quick actions ────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="dc-chip rounded-md border border-border/80 bg-surface px-3 py-1.5 transition-colors hover:border-primary/40 hover:text-primary">
                {a.label}
              </Link>
            ))}
          </div>

          {/* ── List controls ────────────────────────────────────── */}
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Code, title, description…"
            limit={limit}
            onLimitChange={setLimit}
            total={promos.length}
            filtered={filteredPromos.length}
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterOptions={STATUS_FILTER_OPTIONS}
            filterLabel="Status"
          />

          {/* ── Promo catalog ────────────────────────────────────── */}
          <section className="dc-panel" id="promo-catalog">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Promo catalog</h2>
                <p className="text-xs text-muted">
                  Showing {filteredPromos.length} of {promos.length} codes
                  {statusFilter ? ` · ${STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter}` : ''}
                </p>
              </div>
              <a href="#promo-create" className="link-primary text-xs font-medium">New promotion →</a>
            </div>

            {filteredPromos.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">
                  {search || statusFilter ? 'No promotions match' : 'No promotions yet'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {search || statusFilter ? 'Try another filter or search term.' : 'Create a code below for customers to apply at checkout.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1080px]">
                  <caption className="sr-only">Promotion codes catalog</caption>
                  <thead>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col">Title</th>
                      <th scope="col">Discount</th>
                      <th scope="col">Min order</th>
                      <th scope="col">Audience</th>
                      <th scope="col">Validity</th>
                      <th scope="col">Uses / customer</th>
                      <th scope="col">Status</th>
                      <th scope="col"><span className="sr-only">Toggle</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPromos.map((p) => (
                      <tr key={p._id} className={!p.isActive ? 'opacity-75' : ''}>
                        <td className="text-code font-bold text-primary">{p.code}</td>
                        <td className="max-w-[14rem]">
                          <p className="font-medium text-slate-900">{p.title}</p>
                          {p.description && (
                            <p className="truncate text-xs text-muted" title={p.description}>{p.description}</p>
                          )}
                        </td>
                        <td className="tabular-nums">{formatDiscount(p)}</td>
                        <td className="tabular-nums text-muted">{p.minOrderAmount > 0 ? formatPeso(p.minOrderAmount) : '—'}</td>
                        <td className="text-sm text-muted">{formatAudience(p)}</td>
                        <td className="text-sm text-muted">{formatValidity(p)}</td>
                        <td className="text-sm text-muted">{formatUsesPerCustomer(p)}</td>
                        <td>
                          {isPromoExpired(p, now)
                            ? <span className="badge-neutral">Expired</span>
                            : <span className={p.isActive ? 'badge-accent' : 'badge-neutral'}>{p.isActive ? 'Active' : 'Inactive'}</span>
                          }
                        </td>
                        <td>
                          <button type="button" className="link-primary text-xs font-medium" onClick={() => void toggleActive(p)}>
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

          {/* ── Create + guide ───────────────────────────────────── */}
          <div className="grid gap-4 xl:grid-cols-2" id="promo-create">

            <section className="dc-panel flex h-full flex-col">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Create promotion</h2>
                <p className="text-xs text-muted">New code — active immediately after create</p>
              </div>
              <form onSubmit={create} className="dc-panel-body flex flex-1 flex-col">
                <div className="dc-form-grid flex-1">
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

            <section className="dc-panel flex h-full flex-col">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">How promos work</h2>
                <p className="text-xs text-muted">Customer-facing checkout behavior</p>
              </div>
              <div className="dc-panel-body flex flex-1 flex-col">
                <ol className="space-y-4 text-sm">
                  {[
                    { step: 1, title: 'Admin creates code',          desc: 'Set percent or fixed discount. Code is stored uppercase.' },
                    { step: 2, title: 'Customer applies at checkout', desc: 'Only active codes are accepted. Min order rules apply when set.' },
                    { step: 3, title: 'Toggle without deleting',      desc: 'Deactivate seasonal codes to pause them — re-enable when the campaign returns.' },
                  ].map(({ step, title: t, desc }) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {step}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">{t}</p>
                        <p className="mt-0.5 text-muted">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
