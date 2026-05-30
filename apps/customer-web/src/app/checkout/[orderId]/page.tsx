'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CustomerNav } from '../../../components/customer-nav';
import { PaymentCheckout } from '../../../components/payment/payment-checkout';
import { useRequireOnboardingComplete } from '../../../hooks/use-require-onboarding';

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { isLoading, ready } = useRequireOnboardingComplete();

  if (isLoading || !ready) return null;

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-6 py-10">
        <Link href="/orders" className="text-sm text-slate-500 hover:text-primary">
          ← My orders
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Checkout</h1>
        <p className="mt-1 text-sm text-slate-500">Choose how you want to pay for this order</p>
        <div className="mt-8">
          <PaymentCheckout orderId={orderId} />
        </div>
      </main>
    </>
  );
}
