'use client';

import { useRequireOnboardingComplete } from '../../hooks/use-require-onboarding';
import { PageShell } from '../../components/page-shell';
import { BookingWizard } from '../../components/booking/booking-wizard';
import { PageHeader } from '../../components/ui/page-header';

export default function BookPage() {
  const { isLoading, ready } = useRequireOnboardingComplete();

  if (isLoading || !ready) return null;

  return (
    <PageShell>
      <PageHeader
        title="Book laundry"
        description="Schedule pickup and get a price estimate"
      />
      <BookingWizard />
    </PageShell>
  );
}
