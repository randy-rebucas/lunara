'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { resolveApiV1BaseUrl } from '@lunara/utils';
import { Icon } from '../../components/ui/icon';
import { parseApiError } from '../../lib/api-error';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
const CHECK_ICON = 'M4.5 12.75l6 6 9-13.5';
const CROSS_ICON = 'M6 18L18 6M6 6l12 12';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing verification link. Please use the link from your email.');
      return;
    }
    fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!body.success) throw new Error(parseApiError(body, 'Verification failed'));
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'The link may be expired.');
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-md text-center">
        {status === 'verifying' && (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verifying your email…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Just a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon d={CHECK_ICON} className="h-7 w-7" />
            </span>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">Email verified</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You can now sign in to your partner account.
            </p>
            <Link href="/login" className="btn-primary mt-8 inline-flex w-full justify-center py-3">
              Sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Icon d={CROSS_ICON} className="h-7 w-7" />
            </span>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
              Link expired or invalid
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Link href="/login" className="link-primary mt-6 inline-block text-sm">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
