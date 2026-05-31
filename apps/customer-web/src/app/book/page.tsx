'use client';

import { useRequireOnboardingComplete } from '../../hooks/use-protected-page';
import { AuthLoading } from '../../components/auth-loading';
import { PageShell } from '../../components/page-shell';
import { BookingWizard } from '../../components/booking/booking-wizard';
import { PageHeader } from '../../components/ui/page-header';

export default function BookPage() {
  const { isLoading, ready } = useRequireOnboardingComplete();

  if (isLoading || !ready) {
    return <AuthLoading message="Loading booking…" />;
  }

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
