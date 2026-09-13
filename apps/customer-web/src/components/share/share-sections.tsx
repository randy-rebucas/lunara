'use client';

import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildAppSharePayload, buildReferralSharePayload } from '@lunara/utils';
import { Card, CardBody } from '../ui/card';
import { SocialSharePanel } from '../share/social-share-panel';

function shareBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return getShareWebsiteUrl();
}

interface ShareInviteCardProps {
  title?: string;
  description?: string;
  referralCode?: string | null;
  className?: string;
}

export function ShareInviteCard({
  title = 'Share Lunara',
  description = 'Tell friends about pickup & delivery laundry in Metro Manila.',
  referralCode,
  className = 'mt-10',
}: ShareInviteCardProps) {
  const payload = referralCode
    ? buildReferralSharePayload(referralCode, shareBaseUrl(), appConfig.name)
    : buildAppSharePayload(shareBaseUrl(), appConfig.name);

  return (
    <Card className={`border-secondary/20 bg-cyan-50/40 ${className}`.trim()}>
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
