'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lunara/ui';
import { isValidPhilippineMobile } from '@lunara/utils';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShell } from '../../../components/auth-shell';
import { FormError } from '../../../components/marketing/marketing-design';
import { Input } from '../../../components/ui/input';

type OtpStep = 'phone' | 'code';

export default function LoginPage() {
  const { login, loginWithOtp, requestOtp, api } = useAuthContext();
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [otpStep, setOtpStep] = useState<OtpStep>('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      const status = await fetchOnboardingStatus(api);
      router.push(getOnboardingPath(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isValidPhilippineMobile(phone)) {
      setError('Enter a valid Philippine mobile number (e.g. +639171234567).');
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestOtp(phone);
      setVerifiedPhone(result.phone);
      setOtp('');
      setOtpStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginWithOtp(verifiedPhone || phone, otp);
      const status = await fetchOnboardingStatus(api);
      router.replace(getOnboardingPath(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: 'password' | 'otp') {
    setMode(next);
    setError('');
    setOtpStep('phone');
    setOtp('');
    setVerifiedPhone('');
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back to your laundry hub</p>

      <div className="mt-6 flex gap-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => switchMode('password')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'password' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-slate-900'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => switchMode('otp')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'otp' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-slate-900'
          }`}
        >
          Phone OTP
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <FormError>{error}</FormError>}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      ) : otpStep === 'phone' ? (
        <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
          <Input
            placeholder="Mobile number (+639...)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            required
          />
          {error && <FormError>{error}</FormError>}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send OTP'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
          <p className="text-sm text-muted">
            Code sent to <span className="font-medium text-slate-900">{verifiedPhone || phone}</span>
          </p>
          <Input
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
          {error && <FormError>{error}</FormError>}
          <Button type="submit" className="w-full" size="lg" disabled={submitting || otp.length < 6}>
            {submitting ? 'Verifying…' : 'Verify & sign in'}
          </Button>
          <button
            type="button"
            className="w-full text-sm link-primary"
            disabled={submitting}
            onClick={() => {
              void handleSendOtp({ preventDefault: () => {} } as React.FormEvent);
            }}
          >
            Resend code
          </button>
          <button
            type="button"
            className="w-full text-sm text-muted"
            onClick={() => {
              setOtpStep('phone');
              setOtp('');
              setError('');
            }}
          >
            Change number
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        No account?{' '}
        <Link href="/signup" className="link-primary">
          Sign up
        </Link>
        {' · '}
        <Link href="/register" className="link-primary">
          Register with email
        </Link>
      </p>
    </AuthShell>
  );
}
