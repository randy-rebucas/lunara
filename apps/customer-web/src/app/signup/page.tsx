'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { OnboardingProgress } from '../../components/onboarding-progress';

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
    <main className="mx-auto max-w-md px-6 py-12">
      <OnboardingProgress current={step === 'phone' ? 'phone' : 'profile'} />
      <h1 className="mt-8 text-2xl font-bold">Create your account</h1>
      <p className="mt-2 text-sm text-slate-500">Sign up with your mobile number</p>

      {step === 'phone' ? (
        <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border px-4 py-2"
            placeholder="Mobile number (+639...)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send OTP'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
          <p className="text-sm text-slate-600">
            Code sent to <span className="font-medium">{phone}</span>
          </p>
          <input
            className="w-full rounded-lg border px-4 py-2"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputMode="numeric"
            required
          />
          {devOtp && <p className="text-sm text-accent">Dev OTP: {devOtp}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify & Continue'}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-primary"
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

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-primary">
          Sign in
        </Link>
      </p>
    </main>
  );
}
