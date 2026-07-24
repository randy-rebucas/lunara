'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { formatCurrency } from '@lunara/utils';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { WalletTopupForm } from '../../../components/payment/wallet-topup-form';
import { PageShell } from '../../../components/page-shell';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';

interface WalletTransaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  transactions: WalletTransaction[];
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

export default function WalletPage() {
  const { api } = useAuthContext();
  const searchParams = useSearchParams();
  const topupPaymentId = searchParams.get('topupPaymentId');
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [topUpSuccess, setTopUpSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return { balance: 0, transactions: [] } as WalletData;
    const [walletRes, txRes] = await Promise.all([
      api.get<{ balance: number }>('/wallets/me'),
      api.get<WalletTransaction[]>('/wallets/me/transactions'),
    ]);
    return { balance: walletRes.data.balance, transactions: txRes.data };
  }, [ready, api]);

  const { data, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  useEffect(() => {
    if (!topUpSuccess) return;
    const t = window.setTimeout(() => setTopUpSuccess(''), 5000);
    return () => window.clearTimeout(t);
  }, [topUpSuccess]);

  useEffect(() => {
    if (!ready || !topupPaymentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post<{ status: string }>(`/payments/${topupPaymentId}/sync`, {});
        if (cancelled) return;
        if (res.data.status === 'paid') {
          setTopUpSuccess('Top-up confirmed. Your wallet balance has been updated.');
        } else if (res.data.status === 'failed') {
          setTopUpSuccess('Payment did not go through. No funds were added — please try again.');
        } else {
          setTopUpSuccess("We haven't received confirmation yet — this can take a moment. Refresh if your balance doesn't update.");
        }
        await reload();
        window.history.replaceState({}, '', '/wallet');
      } catch {
        if (!cancelled) {
          setTopUpSuccess("Couldn't confirm your payment right now — refreshing your balance. If it doesn't update, check back in a few minutes.");
          await reload();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, topupPaymentId, api, reload]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  if (isLoading || !ready) {
    return <AuthLoading message="Loading wallet…" />;
  }

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];
  const lowBalance = balance > 0 && balance < 500;

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Wallet"
          description="Pay for laundry with your balance. Top up anytime before checkout."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={loading || refreshing}
          onClick={() => void handleRefresh()}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <DataPageStatus loading={loading && !refreshing} error={error} loadingMessage="Loading wallet…" />

      {error && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>
          Try again
        </Button>
      )}

      {!loading && !error && (
        <>
          <Card className="mt-6 overflow-hidden border-primary/15 bg-gradient-to-br from-indigo-50 via-white to-cyan-50/40">
            <CardBody className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                Available balance
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                {formatCurrency(balance)}
              </p>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                Use Lunara Wallet at checkout for faster payment. Top up securely via PayMongo
                (GCash, Maya, or card).
              </p>
              {lowBalance && (
                <p className="mt-3 text-sm font-medium text-amber-800">
                  Balance is below a typical order — consider topping up before you book.
                </p>
              )}
            </CardBody>
          </Card>

          {topUpSuccess && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {topUpSuccess}
            </div>
          )}

          <Card className="mt-6">
            <CardBody>
              <WalletTopupForm />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Need to pay for an order?{' '}
                <Link href="/book" className="link-primary">
                  Book laundry
                </Link>
              </p>
            </CardBody>
          </Card>

          <section className="mt-8">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Transaction history
              </h2>
              {transactions.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}
                </span>
              )}
            </div>

            {transactions.length === 0 ? (
              <Card>
                <CardBody className="py-10 text-center">
                  <p className="font-medium text-slate-900">No transactions yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Top-ups and order payments will appear here.
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
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            isCredit
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-50 text-red-600'
                          }`}
                          aria-hidden
                        >
                          {isCredit ? '+' : '−'}
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
                          {formatCurrency(t.amount)}
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
