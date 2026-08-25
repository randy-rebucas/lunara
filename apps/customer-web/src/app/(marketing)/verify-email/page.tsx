'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShell } from '../../../components/auth-shell';
import { Input } from '../../../components/ui/input';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const { verifyEmail, resendVerification, api } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing verification link. Please use the link from your email.');
      return;
    }
    verifyEmail(token)
      .then(async () => {
        setStatus('success');
        const onboardingStatus = await fetchOnboardingStatus(api);
        router.replace(getOnboardingPath(onboardingStatus));
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResending(true);
    try {
      await resendVerification(resendEmail);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell>
      {status === 'verifying' && (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verifying your email…</h1>
          <p className="mt-1 text-sm text-muted">Just a moment.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email verified</h1>
          <p className="mt-1 text-sm text-muted">Signing you in…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Link expired or invalid</h1>
          <p className="mt-1 text-sm text-muted">{error}</p>

          {resent ? (
            <p className="mt-6 text-sm text-muted">
              If that email is registered and unverified, a new link is on its way.
            </p>
          ) : (
            <form onSubmit={handleResend} className="mt-6 space-y-4">
              <Input
                type="email"
                required
                placeholder="Your email"
                aria-label="Your email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              <Button type="submit" className="w-full" size="lg" disabled={resending}>
                {resending ? 'Sending…' : 'Resend verification email'}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/login" className="link-primary">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
