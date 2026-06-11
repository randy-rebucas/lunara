'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShellWide } from '../../../../components/auth-shell';
import { OnboardingProgress } from '../../../../components/onboarding-progress';
import { AuthLoading } from '../../../../components/auth-loading';
import { Input } from '../../../../components/ui/input';

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

  if (isLoading || !isAuthenticated) return <AuthLoading message="Loading…" />;

  return (
    <AuthShellWide>
      <div className="card-elevated">
        <div className="card-body">
          <OnboardingProgress current="address" />
          <h1 className="mt-8 text-2xl font-bold tracking-tight">Add your address</h1>
          <p className="mt-1 text-sm text-muted">We need a pickup and delivery location for laundry services</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              placeholder="Label (e.g. Home, Office)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <Input
              placeholder="Street address"
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
              required
            />
            <Input
              placeholder="Unit / building (optional)"
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              />
              <Input
                placeholder="Province"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                required
              />
            </div>
            <Input
              placeholder="Postal code"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              required
            />
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'Saving…' : 'Finish setup'}
            </Button>
          </form>
        </div>
      </div>
    </AuthShellWide>
  );
}
