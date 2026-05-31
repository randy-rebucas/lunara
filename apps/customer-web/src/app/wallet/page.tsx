'use client';

import { useCallback, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { formatCurrency } from '@lunara/utils';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageShell } from '../../components/page-shell';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface WalletData {
  balance: number;
  transactions: { type: string; amount: number; description: string; createdAt: string }[];
}

export default function WalletPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [topUpError, setTopUpError] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return { balance: 0, transactions: [] } as WalletData;
    const [walletRes, txRes] = await Promise.all([
      api.get<{ balance: number }>('/wallets/me'),
      api.get<WalletData['transactions']>('/wallets/me/transactions'),
    ]);
    return { balance: walletRes.data.balance, transactions: txRes.data };
  }, [ready, api]);

  const { data, loading, error, reload, setData } = useCustomerQuery(load, [ready, api]);

  async function topUp() {
    setTopUpLoading(true);
    setTopUpError('');
    try {
      const res = await api.post<{ balance: number }>('/wallets/topup', { amount: 500 });
      setData((prev) =>
        prev ? { ...prev, balance: res.data.balance } : { balance: res.data.balance, transactions: [] },
      );
      await reload();
    } catch (e) {
      setTopUpError(e instanceof Error ? e.message : 'Top-up failed');
    } finally {
      setTopUpLoading(false);
    }
  }

  if (isLoading || !ready) {
    return <AuthLoading message="Loading wallet…" />;
  }

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  return (
    <PageShell>
      <PageHeader title="Wallet" description="Top up and view your transaction history." />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading wallet…" />

      <Card className="mt-6">
        <CardBody>
          <p className="text-sm font-medium text-muted">Available balance</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-primary">{formatCurrency(balance)}</p>
          <Button className="mt-6" size="lg" onClick={topUp} disabled={topUpLoading || loading}>
            {topUpLoading ? 'Processing…' : 'Top Up ₱500'}
          </Button>
          {topUpError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {topUpError}
            </div>
          )}
        </CardBody>
      </Card>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Transactions</h2>
        <div className="mt-4 list-stack">
          {transactions.map((t, i) => (
            <Card key={`${t.createdAt}-${i}`}>
              <CardBody className="flex justify-between py-3 text-sm">
                <span>{t.description}</span>
                <span className={t.type === 'credit' ? 'font-medium text-accent' : 'font-medium text-red-500'}>
                  {t.type === 'credit' ? '+' : '-'}
                  {formatCurrency(t.amount)}
                </span>
              </CardBody>
            </Card>
          ))}
          {!loading && !error && transactions.length === 0 && (
            <p className="text-sm text-muted">No transactions yet.</p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
