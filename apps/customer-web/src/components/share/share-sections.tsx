'use client';

import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildAppSharePayload } from '@lunara/utils';
import { Card, CardBody } from '../ui/card';
import { SocialSharePanel } from '../share/social-share-panel';

/** @deprecated Use DealsCarousel — kept for backwards compatibility */
export { DealsCarousel as DashboardDeals } from '../deals/deals-carousel';

function shareBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return getShareWebsiteUrl();
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
