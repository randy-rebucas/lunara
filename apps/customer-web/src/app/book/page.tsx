'use client';

import Link from 'next/link';
import { useRequireOnboardingComplete } from '../../hooks/use-require-onboarding';
import { CustomerNav } from '../../components/customer-nav';
import { BookingWizard } from '../../components/booking/booking-wizard';

export default function BookPage() {
  const { isLoading, ready } = useRequireOnboardingComplete();

  if (isLoading || !ready) return null;

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-6 py-10">
        <div className="mb-2">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-primary">
            ← Back to home
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Book laundry</h1>
        <p className="mt-1 text-sm text-slate-500">Schedule pickup and get a price estimate</p>
        <div className="mt-8">
          <BookingWizard />
        </div>
      </main>
    </>
  );
}
