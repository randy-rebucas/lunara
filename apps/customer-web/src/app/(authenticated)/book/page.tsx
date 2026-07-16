'use client';

import { useSearchParams } from 'next/navigation';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { AuthLoading } from '../../../components/auth-loading';
import { PageShell } from '../../../components/page-shell';
import { BookingWizard } from '../../../components/booking/booking-wizard';
import { PageHeader } from '../../../components/ui/page-header';

export default function BookPage() {
  const searchParams = useSearchParams();
  const initialCouponCode = searchParams.get('code') ?? undefined;
  const reorderOrderId = searchParams.get('reorder') ?? undefined;
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });

  if (isLoading || !ready) {
    return <AuthLoading message="Loading booking…" />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Book laundry"
        description="Schedule pickup, check partner coverage for your area, and get a price estimate"
      />
      <BookingWizard initialCouponCode={initialCouponCode} reorderOrderId={reorderOrderId} />
    </PageShell>
  );
}
