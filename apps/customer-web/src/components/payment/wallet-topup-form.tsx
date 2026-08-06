'use client';

import { useState } from 'react';
import { PaymentMethod } from '@lunara/types';
import { Button } from '@lunara/ui';
import { CUSTOMER_PAYMENT_OPTIONS, formatCurrency } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';

const TOP_UP_AMOUNTS = [500, 1000, 2000] as const;

const PAYMONGO_OPTIONS = CUSTOMER_PAYMENT_OPTIONS.filter((o) => o.channel === 'paymongo');

export function WalletTopupForm() {
  const { api } = useAuthContext();
  const [amount, setAmount] = useState<number>(500);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTopUp() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{
        checkoutUrl?: string;
        payment?: { checkoutUrl?: string };
      }>('/payments/wallet-topup/intent', {
        amount,
        method,
        clientOrigin: window.location.origin,
      });

      const checkoutUrl = res.data.checkoutUrl ?? res.data.payment?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      setError('Could not start PayMongo checkout');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Top up via PayMongo</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pay with GCash, Maya, or card. Funds are added after payment confirms.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOP_UP_AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAmount(value)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
              amount === value
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            {formatCurrency(value)}
          </button>
        ))}
      </div>

      <div className="list-stack-sm">
        {PAYMONGO_OPTIONS.map((opt) => (
          <button
            key={opt.method}
            type="button"
            onClick={() => setMethod(opt.method)}
            className={`selectable-item ${method === opt.method ? 'selectable-item-active' : ''}`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="text-sm text-slate-500">{opt.description}</p>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button className="w-full" size="lg" disabled={loading} onClick={() => void handleTopUp()}>
        {loading ? 'Redirecting…' : `Top up ${formatCurrency(amount)} with PayMongo`}
      </Button>
    </div>
  );
}
