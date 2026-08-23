'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import { PageHeader } from '../ui/page-header';
import { Card, CardBody, SectionPanel } from '../ui/card';

interface FlaggedShop {
  partnerId: string;
  shopName: string;
  avgRating: number;
  reviewCount: number;
}

interface FlaggedRider {
  riderId: string;
  riderEmail: string;
  avgRating: number;
  reviewCount: number;
}

interface QualityAlertsData {
  threshold: number;
  minReviews: number;
  shops: FlaggedShop[];
  riders: FlaggedRider[];
}

function EmptyRow({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted">{label}</p>;
}

export function QualityAlertsBoard() {
  const load = useCallback(() => adminFetch<QualityAlertsData>('/admin/quality-alerts'), []);
  const { data, loading, error } = useAdminQuery(load, []);

  return (
    <div>
      <PageHeader
        title="Quality alerts"
        description={
          data
            ? `Shops or riders averaging below ${data.threshold} stars, with at least ${data.minReviews} reviews.`
            : 'Shops or riders whose rating has dropped below a healthy threshold.'
        }
      />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionPanel title="Shops below threshold" description="Ranked lowest rating first">
            {data.shops.length === 0 ? (
              <EmptyRow label="No shops currently flagged." />
            ) : (
              <div className="list-stack mt-4">
                {data.shops.map((s) => (
                  <Link key={s.partnerId} href={`/partners/${s.partnerId}/command-center`}>
                    <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                      <CardBody className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{s.shopName}</p>
                          <p className="text-xs text-muted-foreground">{s.reviewCount} reviews</p>
                        </div>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                          {s.avgRating.toFixed(1)} ★
                        </span>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </SectionPanel>

          <SectionPanel title="Riders below threshold" description="Ranked lowest rating first">
            {data.riders.length === 0 ? (
              <EmptyRow label="No riders currently flagged." />
            ) : (
              <div className="list-stack mt-4">
                {data.riders.map((r) => (
                  <Link key={r.riderId} href={`/riders/${r.riderId}`}>
                    <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                      <CardBody className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{r.riderEmail}</p>
                          <p className="text-xs text-muted-foreground">{r.reviewCount} reviews</p>
                        </div>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                          {r.avgRating.toFixed(1)} ★
                        </span>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </SectionPanel>
        </div>
      )}
    </div>
  );
}
