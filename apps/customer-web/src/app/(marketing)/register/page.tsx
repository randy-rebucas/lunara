'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShell } from '../../../components/auth-shell';
import { FormError } from '../../../components/marketing/marketing-design';
import { Input } from '../../../components/ui/input';
import { getRecaptchaToken } from '../../../lib/recaptcha';

export default function RegisterPage() {
  const { register, api, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') ?? undefined;
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOnboardingStatus(api)
      .then((status) => router.replace(getOnboardingPath(status)))
      .catch(() => {});
  }, [isAuthenticated, api, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Enter an email address or phone number so you can sign in later.');
      return;
    }
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('register');
      const result = await register({ ...form, referralCode, recaptchaToken });
      if (result.requiresEmailVerification) {
        setPendingVerificationEmail(result.email ?? form.email);
        return;
      }
      const status = await fetchOnboardingStatus(api);
      router.push(getOnboardingPath(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingVerificationEmail) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check your email</h1>
        <p className="mt-3 text-sm text-muted">
          We&apos;ve sent a verification link to{' '}
          <span className="font-medium text-slate-900">{pendingVerificationEmail}</span>. Click it to
          activate your account and sign in.
        </p>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="link-primary">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create account</h1>
      <p className="mt-1 text-sm text-muted">Register with your details to get started</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="First name"
            aria-label="First name"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <Input
            placeholder="Last name"
            aria-label="Last name"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>
        <Input
          placeholder="Email"
          type="email"
          aria-label="Email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          placeholder="Phone"
          aria-label="Phone"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          placeholder="Password"
          type="password"
          aria-label="Password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <FormError>{error}</FormError>}
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="link-primary">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
