'use client';

import { useCallback } from 'react';
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

function formatDiscount(promo: PartnerPromotion) {
  return promo.discountType === 'percent' ? `${promo.discountValue}% off` : `₱${promo.discountValue} off`;
}

function formatDateRange(promo: PartnerPromotion) {
  if (!promo.startsAt && !promo.endsAt) return 'Ongoing';
  const start = promo.startsAt ? new Date(promo.startsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null;
  const end = promo.endsAt ? new Date(promo.endsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null;
  if (start && end) return `${start} – ${end}`;
  if (end) return `Until ${end}`;
  return `From ${start}`;
}

export default function PromotionsPage() {
  const { ready } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });

  const load = useCallback(async () => {
    return partnerFetch<PartnerPromotion[]>('/partner/promotions');
  }, []);

  const { data: promotions, loading, error } = usePartnerQuery(load, []);

  if (!ready) {
    return <AuthLoading message="Loading promotions…" />;
  }

  const list = promotions ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Promotions"
        description="Active platform-wide promotions customers may apply to orders at your shop. Managed by Lunara — view only."
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading promotions…" />

      <div className="mt-6 space-y-3">
        {!loading && !error && list.length === 0 && (
          <div className="card p-6 text-center text-sm text-muted">No active promotions right now.</div>
        )}
        {list.map((promo) => (
          <div key={promo._id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{promo.title}</p>
                {promo.description && <p className="mt-1 text-sm text-muted">{promo.description}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {formatDiscount(promo)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono uppercase">{promo.code}</span>
              <span>{formatDateRange(promo)}</span>
              {promo.minOrderAmount != null && <span>Min. order ₱{promo.minOrderAmount}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
