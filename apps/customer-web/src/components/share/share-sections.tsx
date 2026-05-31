'use client';

import { useCallback } from 'react';
import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import type { Deal } from '@lunara/types';
import { buildAppSharePayload, buildDealSharePayload, formatDealDiscount, formatDealMinimum } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { Card, CardBody } from '../ui/card';
import { SocialSharePanel } from '../share/social-share-panel';
import { useCustomerQuery } from '../../lib/use-customer-query';

function shareBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return getShareWebsiteUrl();
}

export function DashboardDeals() {
  const { api, isAuthenticated } = useAuthContext();

  const load = useCallback(async () => {
    if (!isAuthenticated) return [] as Deal[];
    const res = await api.get<Deal[]>('/deals');
    return res.data;
  }, [api, isAuthenticated]);

  const { data: deals, loading, error } = useCustomerQuery(load, [api, isAuthenticated]);

  if (loading || error || !deals?.length) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Deals for you</h2>
          <p className="mt-1 text-sm text-muted">Share a promo code with friends</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {deals.map((deal) => {
          const payload = buildDealSharePayload(deal, shareBaseUrl(), appConfig.name);
          const minimum = formatDealMinimum(deal);
          return (
            <Card key={deal._id} className="overflow-hidden border-primary/20 bg-gradient-to-br from-indigo-50 to-white">
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-extrabold text-primary">{formatDealDiscount(deal)}</p>
                    <p className="mt-1 font-semibold text-slate-900">{deal.title}</p>
                    {deal.description ? (
                      <p className="mt-1 text-sm text-muted">{deal.description}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold tracking-wide text-primary ring-1 ring-primary/20">
                    {deal.code}
                  </span>
                </div>
                {minimum ? <p className="text-xs text-muted">{minimum}</p> : null}
                <SocialSharePanel payload={payload} compact />
              </CardBody>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

interface ShareInviteCardProps {
  title?: string;
  description?: string;
}

export function ShareInviteCard({
  title = 'Share Lunara',
  description = 'Tell friends about pickup & delivery laundry in Metro Manila.',
}: ShareInviteCardProps) {
  const payload = buildAppSharePayload(shareBaseUrl(), appConfig.name);

  return (
    <Card className="mt-10 border-secondary/20 bg-cyan-50/40">
      <CardBody className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <SocialSharePanel payload={payload} />
      </CardBody>
    </Card>
  );
}
