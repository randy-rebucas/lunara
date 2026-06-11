'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PaymentMethod } from '@lunara/types';
import { Button } from '@lunara/ui';
import {
  formatCashTimingLabel,
  formatCurrency,
  isRefundablePaymentMethod,
} from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../../../components/auth-loading';
import { PageShell } from '../../../../../components/page-shell';
import { Card, CardBody } from '../../../../../components/ui/card';
import { FormLabel } from '../../../../../components/ui/input';
import { useProtectedPage } from '../../../../../hooks/use-protected-page';

export default function RequestRefundPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [reason, setReason] = useState('');
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [cashBlocked, setCashBlocked] = useState(false);
  const [cashLabel, setCashLabel] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id || !ready) return;
    api
      .get<{
        order: { total: number };
        payment: { method: string; cashTiming?: 'pickup' | 'delivery' } | null;
      }>(`/payments/orders/${id}`)
      .then((res) => {
        setOrderTotal(res.data.order?.total ?? null);
        const payment = res.data.payment;
        if (
          !payment ||
          payment.method === PaymentMethod.CASH ||
          !isRefundablePaymentMethod(payment.method as PaymentMethod)
        ) {
          setCashBlocked(true);
          if (payment?.method === PaymentMethod.CASH) {
            setCashLabel(formatCashTimingLabel(payment.cashTiming));
          }
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load order'));
  }, [api, id, ready]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading…" />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cashBlocked) return;
    if (!id || reason.trim().length < 10) {
      setError('Please explain your refund request (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post<{ _id: string }>('/refunds', {
        orderId: id,
        reason: reason.trim(),
      });
      router.push(`/refunds/${res.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell narrow>
      <Link href={`/orders/${id}`} className="text-sm text-muted transition-colors hover:text-primary">
        ← Back to order
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">Request a refund</h1>
      <p className="mt-2 text-sm text-muted">
        Wallet and online payments can be refunded to your Lunara wallet after admin review. Cash on
        pickup or delivery is not eligible for wallet refunds.
      </p>
      {loadError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {cashBlocked && !loadError && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {cashLabel
            ? `This order uses ${cashLabel.toLowerCase()} and cannot be refunded to your wallet. Contact support if you need help.`
            : 'This order is not eligible for a wallet refund. Only wallet and online payments qualify.'}
        </div>
      )}
      {orderTotal != null && !cashBlocked && (
        <p className="mt-2 text-sm font-medium">Order total: {formatCurrency(orderTotal)}</p>
      )}

      {!cashBlocked && (
        <Card className="mt-8">
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <FormLabel>Reason for refund</FormLabel>
                <textarea
                  className="input-field min-h-[120px] resize-y"
                  rows={5}
                  placeholder="Explain why you are requesting a refund…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit refund request'}
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </PageShell>
  );
}
