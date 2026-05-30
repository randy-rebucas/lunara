'use client';

import { useCallback, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { formatCurrency } from '@lunara/utils';
import { CustomerNav } from '../../components/customer-nav';
import { DataPageStatus } from '../../components/data-page-status';
import { useRequireOnboardingComplete } from '../../hooks/use-require-onboarding';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface WalletData {
  balance: number;
  transactions: { type: string; amount: number; description: string; createdAt: string }[];
}

export default function WalletPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useRequireOnboardingComplete();
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

  if (isLoading || !ready) return null;

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-bold">Wallet</h1>

        <div className="mt-4">
          <DataPageStatus loading={loading} error={error} loadingMessage="Loading wallet…" />
        </div>

        <p className="mt-4 text-4xl font-bold text-primary">{formatCurrency(balance)}</p>
        <Button className="mt-6" onClick={topUp} disabled={topUpLoading || loading}>
          {topUpLoading ? 'Processing…' : 'Top Up ₱500'}
        </Button>
        {topUpError && <p className="mt-2 text-sm text-red-500">{topUpError}</p>}

        <h2 className="mt-8 font-semibold">Transactions</h2>
        <div className="mt-4 space-y-2">
          {transactions.map((t, i) => (
            <div key={i} className="flex justify-between rounded border p-3 text-sm">
              <span>{t.description}</span>
              <span className={t.type === 'credit' ? 'text-accent' : 'text-red-500'}>
                {t.type === 'credit' ? '+' : '-'}
                {formatCurrency(t.amount)}
              </span>
            </div>
          ))}
          {!loading && !error && transactions.length === 0 && (
            <p className="text-sm text-slate-500">No transactions yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
