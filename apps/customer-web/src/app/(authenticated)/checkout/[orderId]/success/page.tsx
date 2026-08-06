'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { PaymentStatus } from '@lunara/types';
import { AuthLoading } from '../../../../../components/auth-loading';
import { ButtonLink } from '../../../../../components/ui/button-link';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import {
  PaymentReceipt,
  type PaymentReceiptData,
} from '../../../../../components/payment/payment-receipt';
import { PageShell } from '../../../../../components/page-shell';
import { useProtectedPage } from '../../../../../hooks/use-protected-page';

export default function PaymentSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [payment, setPayment] = useState<PaymentReceiptData | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!ready || !paymentId) return;
    api
      .post(`/payments/${paymentId}/sync`, {})
      .catch(() => undefined)
      .then(() =>
        api.get<{ payment: PaymentReceiptData; order: { total: number } | null }>(
          `/payments/${paymentId}`,
        ),
      )
      .then((res) => {
        setPayment(res.data.payment);
        setOrderTotal(res.data.order?.total ?? res.data.payment.amount);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load receipt'));
  }, [ready, api, paymentId]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading receipt…" />;
  }

  const isPaid = payment?.status === PaymentStatus.PAID;
  const isCashPending = payment?.method === 'cash' && payment?.status === PaymentStatus.PENDING;

  return (
    <PageShell narrow className="text-center">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
          isPaid ? 'bg-accent text-white' : 'bg-primary text-white'
        }`}
      >
        {isPaid ? <Check className="h-7 w-7" aria-hidden /> : <Clock className="h-7 w-7" aria-hidden />}
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        {isPaid ? 'Payment successful' : isCashPending ? 'Booking confirmed' : 'Payment'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {isPaid
          ? 'Your payment was processed and your receipt is ready.'
          : isCashPending
            ? 'Pay cash on pickup or delivery. Your receipt reference is below.'
            : 'Review your payment details below.'}
      </p>

      {loadError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {payment && (
        <div className="mt-8 text-left">
          <PaymentReceipt payment={payment} orderTotal={orderTotal} />
        </div>
      )}

      <div className="mt-8 btn-row btn-row-responsive sm:justify-center">
        <ButtonLink href={`/orders/${orderId}?booked=1`} size="lg" layout="responsive">
          Track order
        </ButtonLink>
        <ButtonLink href="/orders" variant="outline" size="lg" layout="responsive">
          My orders
        </ButtonLink>
      </div>
    </PageShell>
  );
}
