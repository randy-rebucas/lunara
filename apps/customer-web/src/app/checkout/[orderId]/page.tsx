'use client';

import { useParams } from 'next/navigation';
import { AuthLoading } from '../../../components/auth-loading';
import { PageShell } from '../../../components/page-shell';
import { PaymentCheckout } from '../../../components/payment/payment-checkout';
import { PageHeader } from '../../../components/ui/page-header';
import { useProtectedPage } from '../../../hooks/use-protected-page';

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });

  if (isLoading || !ready) {
    return <AuthLoading message="Loading checkout…" />;
  }

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
