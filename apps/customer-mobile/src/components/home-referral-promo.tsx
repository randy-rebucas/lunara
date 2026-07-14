import { useEffect, useState } from 'react';
import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildAppSharePayload, buildReferralSharePayload } from '@lunara/utils';
import { useAuthStore } from '../store/auth';
import { ShareInviteCard } from './social-share-buttons';

export function HomeReferralPromo() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ referralCode: string }>('/rewards/me/referral-code')
      .then((res) => {
        if (!cancelled) setReferralCode(res.referralCode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const payload = referralCode
    ? buildReferralSharePayload(referralCode, getShareWebsiteUrl(), appConfig.name)
    : buildAppSharePayload(getShareWebsiteUrl(), appConfig.name);

  return (
    <ShareInviteCard
      payload={payload}
      title="Referral program"
      description={
        referralCode
          ? `Share your code ${referralCode} — you both earn 100 loyalty points when they complete their first order.`
          : 'Invite friends and earn 100 loyalty points per referral when they complete their first order.'
      }
    />
  );
}
