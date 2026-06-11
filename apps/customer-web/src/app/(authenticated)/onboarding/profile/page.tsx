'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShellWide } from '../../../../components/auth-shell';
import { OnboardingProgress } from '../../../../components/onboarding-progress';
import { AuthLoading } from '../../../../components/auth-loading';
import { Input } from '../../../../components/ui/input';

export default function OnboardingProfilePage() {
  const { isAuthenticated, isLoading, api, user } = useAuthContext();
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '' });
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

  if (isLoading || !isAuthenticated) return <AuthLoading message="Loading…" />;

  return (
    <AuthShellWide>
      <div className="card-elevated">
        <div className="card-body">
          <OnboardingProgress current="profile" />
          <h1 className="mt-8 text-2xl font-bold tracking-tight">Complete your profile</h1>
          <p className="mt-1 text-sm text-muted">Tell us your name so we can personalize your orders</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="First name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
              <Input
                placeholder="Last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            {user?.email && (
              <div>
                <p className="form-label">Email</p>
                <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-muted">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Email is tied to your account and cannot be changed here.
                </p>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </div>
      </div>
    </AuthShellWide>
  );
}
