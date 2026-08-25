'use client';

import { useCallback, useState } from 'react';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface PartnerPromotion {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  startsAt?: string;
  endsAt?: string;
}

interface OwnPromotion extends PartnerPromotion {
  isActive: boolean;
  maxUsesPerCustomer?: number;
  fundedBy: 'platform' | 'partner';
  approvalStatus: 'approved' | 'pending' | 'rejected';
  adminNote?: string;
  createdAt: string;
}

const MAX_PERCENT_DISCOUNT = 50;
const MAX_FIXED_DISCOUNT = 300;

function formatDiscount(promo: { discountType: 'percent' | 'fixed'; discountValue: number }) {
  return promo.discountType === 'percent' ? `${promo.discountValue}% off` : `₱${promo.discountValue} off`;
}

function formatDateRange(promo: { startsAt?: string; endsAt?: string }) {
  if (!promo.startsAt && !promo.endsAt) return 'Ongoing';
  const start = promo.startsAt ? new Date(promo.startsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null;
  const end = promo.endsAt ? new Date(promo.endsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null;
  if (start && end) return `${start} – ${end}`;
  if (end) return `Until ${end}`;
  return `From ${start}`;
}

function approvalBadge(promo: OwnPromotion) {
  if (promo.approvalStatus === 'pending') {
    return <span className="badge-warning">Pending review</span>;
  }
  if (promo.approvalStatus === 'rejected') {
    return <span className="badge-danger">Rejected</span>;
  }
  return promo.isActive ? <span className="badge-accent">Active</span> : <span className="badge-neutral">Off</span>;
}

export default function PromotionsPage() {
  const { ready, user } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });
  // Only the PARTNER role owns promotions (backend scopes /promotions/mine, POST, and the
  // active-toggle to @Roles(PARTNER) only) — STAFF/ADMIN would get a 403 on all three, so they
  // only ever see the platform-wide list below.
  const canManageOwn = user?.role === UserRole.PARTNER;

  const loadPlatform = useCallback(async () => {
    return partnerFetch<PartnerPromotion[]>('/partner/promotions');
  }, []);
  const { data: platformPromotions, loading: platformLoading, error: platformError } = usePartnerQuery(loadPlatform, []);

  const loadOwn = useCallback(async () => {
    if (!canManageOwn) return [];
    return partnerFetch<OwnPromotion[]>('/partner/promotions/mine');
  }, [canManageOwn]);
  const { data: ownPromotions, loading: ownLoading, error: ownError, reload: reloadOwn } = usePartnerQuery(loadOwn, [canManageOwn]);

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState('');

  const discountCap = discountType === 'percent' ? MAX_PERCENT_DISCOUNT : MAX_FIXED_DISCOUNT;

  async function createPromotion(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await partnerFetch('/partner/promotions', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim() || undefined,
          discountType,
          discountValue: Number(discountValue),
          ...(minOrderAmount ? { minOrderAmount: Number(minOrderAmount) } : {}),
          ...(maxUsesPerCustomer ? { maxUsesPerCustomer: Number(maxUsesPerCustomer) } : {}),
          ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
          ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
        }),
      });
      setCode('');
      setTitle('');
      setDescription('');
      setDiscountType('percent');
      setDiscountValue('10');
      setMinOrderAmount('');
      setMaxUsesPerCustomer('');
      setStartsAt('');
      setEndsAt('');
      setShowForm(false);
      await reloadOwn();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create promotion');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: OwnPromotion) {
    setTogglingId(promo._id);
    setToggleError('');
    try {
      await partnerFetch(`/partner/promotions/${promo._id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      await reloadOwn();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update promo code');
    } finally {
      setTogglingId(null);
    }
  }

  if (!ready) {
    return <AuthLoading message="Loading promotions…" />;
  }

  const ownList = ownPromotions ?? [];
  const platformList = platformPromotions ?? [];

  return (
    <div>
      <PageHeader title="Promotions" description="Create your own promo codes for customers booking at your shop, and see what Lunara is running platform-wide." />

      {canManageOwn && (
      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Your promo codes</h2>
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close' : 'New promo code'}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          The discount comes out of your own payout, not Lunara&apos;s — it applies only to orders assigned to
          your shop, and needs a quick admin review before it goes live.
        </p>

        {toggleError && <div className="alert-error mt-3" role="alert">{toggleError}</div>}

        {showForm && (
          <form onSubmit={createPromotion} className="card mt-3 space-y-3 p-4">
            {formError && <div className="alert-error" role="alert">{formError}</div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="form-label" htmlFor="pp-code">Code</label>
                <input id="pp-code" className="input-field uppercase" placeholder="MYSHOP10" value={code}
                  onChange={(e) => setCode(e.target.value)} required autoComplete="off" />
              </div>
              <div>
                <label className="form-label" htmlFor="pp-title">Title</label>
                <input id="pp-title" className="input-field" placeholder="10% off at our shop" value={title}
                  onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <label className="form-label" htmlFor="pp-type">Discount type</label>
                <select id="pp-type" className="input-field" value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount (₱)</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="pp-value">
                  Value {discountType === 'percent' ? `(max ${discountCap}%)` : `(max ₱${discountCap})`}
                </label>
                <input id="pp-value" className="input-field" type="number" min={0} max={discountCap}
                  value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
              </div>
              <div>
                <label className="form-label" htmlFor="pp-min">Min order (₱, optional)</label>
                <input id="pp-min" className="input-field" type="number" min={0}
                  value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="pp-uses">Max uses / customer (optional)</label>
                <input id="pp-uses" className="input-field" type="number" min={1} placeholder="Unlimited"
                  value={maxUsesPerCustomer} onChange={(e) => setMaxUsesPerCustomer(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="pp-starts">Starts at (optional)</label>
                <input id="pp-starts" className="input-field" type="datetime-local"
                  value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="pp-ends">Ends at (optional)</label>
                <input id="pp-ends" className="input-field" type="datetime-local"
                  value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="form-label" htmlFor="pp-desc">Description (optional)</label>
                <input id="pp-desc" className="input-field" value={description}
                  onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary btn-sm">
              {saving ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        )}

        <DataPageStatus loading={ownLoading} error={ownError} loadingMessage="Loading your promo codes…" />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!ownLoading && !ownError && ownList.length === 0 && (
            <div className="card p-6 text-center text-sm text-muted sm:col-span-2 lg:col-span-3">You haven&apos;t created any promo codes yet.</div>
          )}
          {ownList.map((promo) => (
            <div key={promo._id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{promo.title}</p>
                  {promo.description && <p className="mt-1 text-sm text-muted">{promo.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {approvalBadge(promo)}
                  <span className="badge-primary">{formatDiscount(promo)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono uppercase">{promo.code}</span>
                <span>{formatDateRange(promo)}</span>
                {promo.minOrderAmount ? <span>Min. order ₱{promo.minOrderAmount}</span> : null}
              </div>
              {promo.adminNote && (
                <p className="mt-2 text-xs text-muted">Admin note: {promo.adminNote}</p>
              )}
              {promo.approvalStatus !== 'rejected' && (
                <button
                  type="button"
                  className="btn-outline btn-sm mt-3"
                  disabled={togglingId === promo._id}
                  onClick={() => void toggleActive(promo)}
                >
                  {togglingId === promo._id ? 'Saving…' : promo.isActive ? 'Turn off' : 'Turn on'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Platform-wide promotions</h2>
        <p className="mt-1 text-xs text-muted">Managed by Lunara — customers may apply these at any shop.</p>

        <DataPageStatus loading={platformLoading} error={platformError} loadingMessage="Loading promotions…" />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!platformLoading && !platformError && platformList.length === 0 && (
            <div className="card p-6 text-center text-sm text-muted sm:col-span-2 lg:col-span-3">No active promotions right now.</div>
          )}
          {platformList.map((promo) => (
            <div key={promo._id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{promo.title}</p>
                  {promo.description && <p className="mt-1 text-sm text-muted">{promo.description}</p>}
                </div>
                <span className="badge-primary shrink-0">{formatDiscount(promo)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono uppercase">{promo.code}</span>
                <span>{formatDateRange(promo)}</span>
                {promo.minOrderAmount != null && <span>Min. order ₱{promo.minOrderAmount}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
