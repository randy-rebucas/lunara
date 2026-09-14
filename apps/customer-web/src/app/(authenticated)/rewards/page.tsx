'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown } from 'lucide-react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { ShareInviteCard } from '../../../components/share/share-sections';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useDebouncedCallback } from '../../../hooks/use-debounced-callback';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';

interface PartnerBalance {
  partnerUserId: string;
  partnerName: string;
  balance: number;
  tier: string;
  nextTier: string | null;
  pointsToNextTier: number;
  currentTierMin: number;
}

interface RewardsSummary {
  referralBalance: number;
  partners: PartnerBalance[];
}

interface RewardsCatalogItem {
  id: string;
  title: string;
  description?: string;
  points: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
}

interface RewardsTransaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
  partnerUserId?: string;
}

function formatTransactionDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDiscount(item: RewardsCatalogItem) {
  return item.discountType === 'percent' ? `${item.discountValue}% off` : `₱${item.discountValue} off`;
}

function ShopRewardsCard({
  shop,
  referralBalance,
  onRedeemed,
}: {
  shop: PartnerBalance;
  referralBalance: number;
  onRedeemed: () => void;
}) {
  const { api } = useAuthContext();
  const [expanded, setExpanded] = useState(false);
  const [catalog, setCatalog] = useState<RewardsCatalogItem[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemMessage, setRedeemMessage] = useState('');
  const [redeemError, setRedeemError] = useState('');

  const available = shop.balance + referralBalance;
  const nextTierMin = shop.balance + shop.pointsToNextTier;
  const progress = shop.nextTier
    ? Math.min(1, Math.max(0, (shop.balance - shop.currentTierMin) / (nextTierMin - shop.currentTierMin)))
    : 1;

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && !catalog) {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const res = await api.get<RewardsCatalogItem[]>(`/rewards/catalog?partnerId=${shop.partnerUserId}`);
        setCatalog(res.data);
      } catch (e) {
        setCatalogError(e instanceof Error ? e.message : 'Could not load this shop’s rewards');
      } finally {
        setCatalogLoading(false);
      }
    }
  }

  async function redeem(item: RewardsCatalogItem) {
    setRedeemError('');
    setRedeemMessage('');
    setRedeemingId(item.id);
    try {
      const res = await api.post<{ voucher: { code: string } }>('/rewards/redeem', {
        partnerId: shop.partnerUserId,
        catalogItemId: item.id,
      });
      setRedeemMessage(
        `Reward redeemed! Use code ${res.data.voucher.code} at ${shop.partnerName} to get "${item.title}".`,
      );
      onRedeemed();
    } catch (e) {
      setRedeemError(e instanceof Error ? e.message : 'Could not redeem this reward');
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardBody>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{shop.partnerName}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {shop.balance} pts · {shop.tier} tier
            </p>
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary"
            onClick={() => void toggleExpanded()}
          >
            {expanded ? 'Hide rewards' : 'View rewards'}
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {shop.nextTier
            ? `Earn ${shop.pointsToNextTier} more points at this shop to reach ${shop.nextTier} tier`
            : "You've reached the highest tier here"}
        </p>

        {expanded && (
          <div className="mt-4 border-t border-border pt-4">
            {redeemMessage && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                {redeemMessage}
              </div>
            )}
            {redeemError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {redeemError}
              </div>
            )}
            {catalogLoading && <p className="text-sm text-muted-foreground">Loading rewards…</p>}
            {catalogError && <p className="text-sm text-red-700">{catalogError}</p>}
            {catalog && catalog.length === 0 && (
              <p className="text-sm text-muted-foreground">This shop hasn&apos;t added any rewards yet.</p>
            )}
            {catalog && catalog.length > 0 && (
              <div className="space-y-2">
                {catalog.map((item) => {
                  const canRedeem = available >= item.points;
                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                        )}
                        <p className="mt-1 text-xs font-semibold text-primary">
                          {item.points} pts · {formatDiscount(item)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11 shrink-0"
                        disabled={!canRedeem || redeemingId !== null}
                        onClick={() => void redeem(item)}
                      >
                        {redeemingId === item.id ? 'Redeeming…' : canRedeem ? 'Redeem' : `${item.points - available} to go`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function RewardsPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<{ referredCount: number; pointsEarned: number } | null>(
    null,
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api
      .get<{ referralCode: string }>('/rewards/me/referral-code')
      .then((res) => {
        if (!cancelled) setReferralCode(res.data.referralCode);
      })
      .catch(() => {});
    api
      .get<{ referredCount: number; pointsEarned: number }>('/rewards/me/referral-stats')
      .then((res) => {
        if (!cancelled) setReferralStats(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, api]);

  const load = useCallback(async () => {
    if (!ready) {
      return { summary: { referralBalance: 0, partners: [] }, transactions: [] } as {
        summary: RewardsSummary;
        transactions: RewardsTransaction[];
      };
    }
    const [summaryRes, txRes] = await Promise.all([
      api.get<RewardsSummary>('/rewards/me'),
      api.get<RewardsTransaction[]>('/rewards/me/transactions'),
    ]);
    return { summary: summaryRes.data, transactions: txRes.data };
  }, [ready, api]);

  const { data, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  // Loyalty points are credited as a side effect of order completion (orderEvent 'completed'
  // over the /tracking socket) — without this, a customer sitting on this page when their
  // order completes would see stale balances until they manually reload.
  const scheduleReload = useDebouncedCallback(() => {
    reload().catch(() => {});
  }, 500);

  useEffect(() => {
    window.addEventListener('lunara-notifications-bump', scheduleReload);
    return () => window.removeEventListener('lunara-notifications-bump', scheduleReload);
  }, [scheduleReload]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading rewards…" />;
  }

  const referralBalance = data?.summary.referralBalance ?? 0;
  const partners = data?.summary.partners ?? [];
  const transactions = data?.transactions ?? [];

  return (
    <PageShell className="lg:max-w-6xl">
      <PageHeader
        title="Rewards"
        description="Each shop runs its own loyalty program — earn points from completed orders there, then redeem them for perks that shop offers."
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading rewards…" />

      {error && (
        <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11" onClick={() => void reload()}>
          Try again
        </Button>
      )}

      {!loading && !error && (
        <>
          <Card className="mt-6 overflow-hidden border-primary/15 bg-gradient-to-br from-primary/5 via-white to-secondary/10">
            <CardBody className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                Referral bonus balance
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-primary sm:text-5xl">{referralBalance}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Earned from referrals — usable as a top-up toward any shop&apos;s rewards below.
              </p>
            </CardBody>
          </Card>

          <ShareInviteCard
            title="Referral program"
            description={
              referralCode
                ? `Share your code ${referralCode} — you both earn 100 points when they complete their first order.`
                : 'Invite friends and earn 100 points per referral when they complete their first order.'
            }
            referralCode={referralCode}
          />

          {referralStats && (referralStats.referredCount > 0 || referralStats.pointsEarned > 0) && (
            <div className="mt-3 flex gap-3">
              <Card className="flex-1">
                <CardBody className="py-3 text-center">
                  <p className="text-2xl font-bold text-primary">{referralStats.referredCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {referralStats.referredCount === 1 ? 'friend joined' : 'friends joined'}
                  </p>
                </CardBody>
              </Card>
              <Card className="flex-1">
                <CardBody className="py-3 text-center">
                  <p className="text-2xl font-bold text-primary">{referralStats.pointsEarned}</p>
                  <p className="text-xs text-muted-foreground">pts from referrals</p>
                </CardBody>
              </Card>
            </div>
          )}

          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">Your shops</h2>
            {partners.length === 0 ? (
              <Card>
                <CardBody className="py-10 text-center">
                  <p className="font-medium text-slate-900">No shop points yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Complete an order at a shop running a rewards program to start earning.
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="list-stack">
                {partners.map((shop) => (
                  <ShopRewardsCard
                    key={shop.partnerUserId}
                    shop={shop}
                    referralBalance={referralBalance}
                    onRedeemed={() => void reload()}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Points history</h2>
              {transactions.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}
                </span>
              )}
            </div>

            {transactions.length === 0 ? (
              <Card>
                <CardBody className="py-10 text-center">
                  <p className="font-medium text-slate-900">No point activity yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Completed orders and referrals will appear here.
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="list-stack">
                {transactions.map((t, i) => {
                  const isCredit = t.type === 'credit';
                  return (
                    <Card key={`${t.createdAt}-${i}`}>
                      <CardBody className="flex items-center gap-4 py-4">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'
                          }`}
                          aria-hidden
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{t.description}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatTransactionDate(t.createdAt)}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 text-sm font-bold tabular-nums ${
                            isCredit ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {isCredit ? '+' : '−'}
                          {t.amount} pts
                        </p>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
