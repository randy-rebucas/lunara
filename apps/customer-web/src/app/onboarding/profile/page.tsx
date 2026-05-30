'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { OnboardingProgress } from '../../../components/onboarding-progress';

export default function OnboardingProfilePage() {
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/signup');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOnboardingStatus(api).then((status) => {
      if (!status.needsProfile && status.needsAddress) router.replace('/onboarding/address');
      if (status.isComplete) router.replace('/dashboard');
    });
  }, [isAuthenticated, api, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.patch('/customers/me', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      const status = await fetchOnboardingStatus(api);
      router.push(getOnboardingPath(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <OnboardingProgress current="profile" />
      <h1 className="mt-8 text-2xl font-bold">Complete your profile</h1>
      <p className="mt-2 text-sm text-slate-500">Tell us your name so we can personalize your orders</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            className="rounded-lg border px-4 py-2"
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <input
            className="rounded-lg border px-4 py-2"
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>
        <input
          className="w-full rounded-lg border px-4 py-2"
          placeholder="Email (optional)"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </main>
  );
}
