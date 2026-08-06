'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { ShareInviteCard } from '../../../components/share/share-sections';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';

interface RewardsCatalogItem {
  id: string;
  title: string;
  description: string;
  points: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
}

interface RewardsTransaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
}

interface RewardsData {
  balance: number;
  tier: string;
  nextTier: string | null;
  pointsToNextTier: number;
  transactions: RewardsTransaction[];
  catalog: RewardsCatalogItem[];
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

export default function RewardsPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemMessage, setRedeemMessage] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api
      .get<{ referralCode: string }>('/rewards/me/referral-code')
      .then((res) => {
        if (!cancelled) setReferralCode(res.data.referralCode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, api]);

  const load = useCallback(async () => {
    if (!ready) {
      return { balance: 0, tier: 'Moon', nextTier: null, pointsToNextTier: 0, transactions: [], catalog: [] } as RewardsData;
    }
    const [meRes, catalogRes] = await Promise.all([
      api.get<Omit<RewardsData, 'catalog'>>('/rewards/me'),
      api.get<RewardsCatalogItem[]>('/rewards/catalog'),
    ]);
    return { ...meRes.data, catalog: catalogRes.data };
  }, [ready, api]);

  const { data, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  async function redeem(item: RewardsCatalogItem) {
    setRedeemError('');
    setRedeemMessage('');
    setRedeemingId(item.id);
    try {
      const res = await api.post<{ voucher: { code: string }; balance: number }>('/rewards/redeem', {
        catalogItemId: item.id,
      });
      setRedeemMessage(
        `Reward redeemed! Use code ${res.data.voucher.code} on your next order to get "${item.title}".`,
      );
      await reload();
    } catch (e) {
      setRedeemError(e instanceof Error ? e.message : 'Could not redeem this reward');
    } finally {
      setRedeemingId(null);
    }
  }

  if (isLoading || !ready) {
    return <AuthLoading message="Loading rewards…" />;
  }

  const balance = data?.balance ?? 0;
  const tier = data?.tier ?? 'Moon';
  const nextTier = data?.nextTier ?? null;
  const pointsToNextTier = data?.pointsToNextTier ?? 0;
  const transactions = data?.transactions ?? [];
  const catalog = data?.catalog ?? [];
  const progress = nextTier ? Math.min(1, Math.max(0, balance / (balance + pointsToNextTier))) : 1;

  return (
    <PageShell>
      <PageHeader
        title="Rewards"
        description="Earn points from completed orders and referrals, then redeem them for perks."
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading rewards…" />

      {error && (
        <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11" onClick={() => void reload()}>
          Try again
        </Button>
      )}

      {!loading && !error && (
        <>
          <Card className="mt-6 overflow-hidden border-primary/15 bg-gradient-to-br from-indigo-50 via-white to-cyan-50/40">
            <CardBody className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                Loyalty points
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-primary sm:text-5xl">{balance}</p>
              <p className="mt-3 text-sm font-medium text-slate-700">Tier: {tier}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {nextTier
                  ? `Earn ${pointsToNextTier} more points to reach ${nextTier} tier`
                  : "You've reached the highest tier"}
              </p>
              <div className="mx-auto mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </CardBody>
          </Card>

          <ShareInviteCard
            title="Referral program"
            description={
              referralCode
                ? `Share your code ${referralCode} — you both earn 100 loyalty points when they complete their first order.`
                : 'Invite friends and earn 100 loyalty points per referral when they complete their first order.'
            }
            referralCode={referralCode}
          />

          {redeemMessage && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {redeemMessage}
            </div>
          )}
          {redeemError && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {redeemError}
            </div>
          )}

          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">Rewards catalog</h2>
            <div className="list-stack">
              {catalog.map((item) => {
                const canRedeem = balance >= item.points;
                return (
                  <Card key={item.id}>
                    <CardBody className="flex items-center gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
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
                        {redeemingId === item.id ? 'Redeeming…' : canRedeem ? 'Redeem' : `${item.points - balance} to go`}
                      </Button>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
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
