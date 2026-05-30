'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { OnboardingProgress } from '../../../components/onboarding-progress';

export default function OnboardingAddressPage() {
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();
  const [form, setForm] = useState({
    label: 'Home',
    line1: '',
    line2: '',
    city: 'Manila',
    province: 'Metro Manila',
    postalCode: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/signup');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOnboardingStatus(api).then((status) => {
      if (status.needsProfile) router.replace('/onboarding/profile');
      if (status.isComplete) router.replace('/dashboard');
    });
  }, [isAuthenticated, api, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/addresses', { ...form, isDefault: true });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save address');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <OnboardingProgress current="address" />
      <h1 className="mt-8 text-2xl font-bold">Add your address</h1>
      <p className="mt-2 text-sm text-slate-500">We need a pickup and delivery location for laundry services</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded-lg border px-4 py-2"
          placeholder="Label (e.g. Home, Office)"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          required
        />
        <input
          className="w-full rounded-lg border px-4 py-2"
          placeholder="Street address"
          value={form.line1}
          onChange={(e) => setForm({ ...form, line1: e.target.value })}
          required
        />
        <input
          className="w-full rounded-lg border px-4 py-2"
          placeholder="Unit / building (optional)"
          value={form.line2}
          onChange={(e) => setForm({ ...form, line2: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            className="rounded-lg border px-4 py-2"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
          <input
            className="rounded-lg border px-4 py-2"
            placeholder="Province"
            value={form.province}
            onChange={(e) => setForm({ ...form, province: e.target.value })}
            required
          />
        </div>
        <input
          className="w-full rounded-lg border px-4 py-2"
          placeholder="Postal code"
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Finish setup'}
        </Button>
      </form>
    </main>
  );
}
