'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShellWide } from '../../components/auth-shell';
import { OnboardingProgress } from '../../components/onboarding-progress';
import { Input } from '../../components/ui/input';

type Step = 'phone' | 'otp';

export default function SignUpPage() {
  const { loginWithOtp, requestOtp, api } = useAuthContext();
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await requestOtp(phone);
      if (result.devOtp) setDevOtp(result.devOtp);
      setStep('otp');
    } catch {
      setError('Failed to send OTP. Check your number and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginWithOtp(phone, otp);
      const status = await fetchOnboardingStatus(api);
      router.push(getOnboardingPath(status));
    } catch {
      setError('Invalid or expired OTP. Request a new code.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShellWide>
      <div className="card-elevated">
        <div className="card-body">
          <OnboardingProgress current={step === 'phone' ? 'phone' : 'profile'} />
          <h1 className="mt-8 text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted">Sign up with your mobile number</p>

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
              <Input
                placeholder="Mobile number (+639...)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <p className="text-sm text-muted">
                Code sent to <span className="font-medium text-slate-900">{phone}</span>
              </p>
              <Input
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                required
              />
              {devOtp && <p className="badge-accent">Dev OTP: {devOtp}</p>}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify & Continue'}
              </Button>
              <button
                type="button"
                className="w-full text-sm link-primary"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
              >
                Change number
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href="/login" className="link-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthShellWide>
  );
}
