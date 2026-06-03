import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildAppSharePayload } from '@lunara/utils';
import { ShareInviteCard } from './social-share-buttons';

export function HomeReferralPromo() {
  const payload = buildAppSharePayload(getShareWebsiteUrl(), appConfig.name);

  return (
    <ShareInviteCard
      payload={payload}
      title="Referral program"
      description="Invite friends and earn 100 loyalty points per referral when they complete their first order."
    />
  );
}
