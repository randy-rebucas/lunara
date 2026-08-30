'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { formatPhone, isValidPhilippineMobile } from '@lunara/utils';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShellWide } from '../../../components/auth-shell';
import { FormError } from '../../../components/marketing/marketing-design';
import { OnboardingProgress } from '../../../components/onboarding-progress';
import { Input } from '../../../components/ui/input';
import { getFriendlyErrorMessage } from '../../../lib/format-error';
import { getRecaptchaToken } from '../../../lib/recaptcha';

type Step = 'phone' | 'otp';

export default function SignUpPage() {
  const { signupWithOtp, requestOtp, api, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOnboardingStatus(api)
      .then((status) => router.replace(getOnboardingPath(status)))
      .catch(() => {});
  }, [isAuthenticated, api, router]);

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    if (!isValidPhilippineMobile(phone)) {
      setError('Enter a valid Philippine mobile number (e.g. +639171234567).');
      return;
    }
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('otp_request');
      const result = await requestOtp(phone, recaptchaToken);
      setVerifiedPhone(result.phone);
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to send OTP. Check your number and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const targetPhone = verifiedPhone || formatPhone(phone);
      await signupWithOtp(targetPhone, otp);
      const status = await fetchOnboardingStatus(api);
      router.replace(getOnboardingPath(status));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Invalid or expired OTP. Request a new code.'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleChangeNumber() {
    setStep('phone');
    setOtp('');
    setVerifiedPhone('');
    setError('');
  }

  return (
    <AuthShellWide>
      <div className="card-elevated">
        <div className="card-body">
          <OnboardingProgress current={step === 'phone' ? 'phone' : 'profile'} />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-muted">Sign up with your mobile number</p>

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
              <Input
                placeholder="Mobile number (+639...)"
                aria-label="Mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                inputMode="tel"
              />
              {error && <FormError>{error}</FormError>}
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <p className="text-sm text-muted">
                Code sent to{' '}
                <span className="font-medium text-slate-900">{verifiedPhone || formatPhone(phone)}</span>
              </p>
              <Input
                placeholder="6-digit OTP"
                aria-label="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              {error && <FormError>{error}</FormError>}
              <Button type="submit" className="w-full" size="lg" disabled={submitting || otp.length < 6}>
                {submitting ? 'Verifying…' : 'Verify & Create Account'}
              </Button>
              <button
                type="button"
                className="w-full text-sm link-primary"
                disabled={submitting}
                onClick={() => void handleSendOtp()}
              >
                Resend code
              </button>
              <button type="button" className="w-full text-sm text-muted" onClick={handleChangeNumber}>
                Change number
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href="/login" className="link-primary">
              Sign in
            </Link>
            {' · '}
            <Link href="/register" className="link-primary">
              Email register
            </Link>
          </p>
        </div>
      </div>
    </AuthShellWide>
  );
}
