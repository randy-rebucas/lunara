'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PaymentStatus } from '@lunara/types';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { CustomerNav } from '../../../../components/customer-nav';
import {
  PaymentReceipt,
  type PaymentReceiptData,
} from '../../../../components/payment/payment-receipt';
import { useRequireOnboardingComplete } from '../../../../hooks/use-require-onboarding';

export default function PaymentSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const { api } = useAuthContext();
  const { isLoading, ready } = useRequireOnboardingComplete();
  const [payment, setPayment] = useState<PaymentReceiptData | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!ready || !paymentId) return;
    api
      .get<{ payment: PaymentReceiptData; order: { total: number } | null }>(
        `/payments/${paymentId}`,
      )
      .then((res) => {
        setPayment(res.data.payment);
        setOrderTotal(res.data.order?.total ?? res.data.payment.amount);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load receipt'));
  }, [ready, api, paymentId]);

  if (isLoading || !ready) return null;

  const isPaid = payment?.status === PaymentStatus.PAID;
  const isCashPending = payment?.method === 'cash' && payment?.status === PaymentStatus.PENDING;

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-6 py-10 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl ${
            isPaid ? 'bg-accent text-white' : 'bg-primary text-white'
          }`}
        >
          {isPaid ? '✓' : '₱'}
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {isPaid ? 'Payment successful' : isCashPending ? 'Booking confirmed' : 'Payment'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isPaid
            ? 'Your payment was processed and your receipt is ready.'
            : isCashPending
              ? 'Pay cash on pickup or delivery. Your receipt reference is below.'
              : 'Review your payment details below.'}
        </p>

        {loadError && <p className="mt-4 text-sm text-red-500">{loadError}</p>}

        {payment && (
          <div className="mt-8 text-left">
            <PaymentReceipt payment={payment} orderTotal={orderTotal} />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/orders/${orderId}?booked=1`}>
            <Button className="w-full sm:w-auto">Track order</Button>
          </Link>
          <Link href="/orders">
            <Button variant="outline" className="w-full sm:w-auto">
              My orders
            </Button>
          </Link>
        </div>
      </main>
    </>
  );
}
