'use client';

import { useParams } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { PaymentCheckout } from '../../../components/payment/payment-checkout';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequireOnboardingComplete } from '../../../hooks/use-require-onboarding';

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { isLoading, ready } = useRequireOnboardingComplete();

  if (isLoading || !ready) return null;

  return (
    <PageShell narrow>
      <PageHeader
        title="Checkout"
        description="Choose how you want to pay for this order"
        backHref="/orders"
        backLabel="My orders"
      />
      <PaymentCheckout orderId={orderId} />
    </PageShell>
  );
}
