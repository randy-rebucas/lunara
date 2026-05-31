'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthShell } from '../../components/auth-shell';
import { Input } from '../../components/ui/input';

export default function LoginPage() {
  const { login, loginWithOtp, requestOtp, api } = useAuthContext();
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'password') {
        await login(email, password);
      } else {
        await loginWithOtp(phone, otp);
      }
      const status = await fetchOnboardingStatus(api);
      router.push(getOnboardingPath(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function handleRequestOtp() {
    setError('');
    try {
      const result = await requestOtp(phone);
      if (result.devOtp) setDevOtp(result.devOtp);
    } catch {
      setError('Failed to send OTP');
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back to your laundry hub</p>

      <div className="mt-6 flex gap-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'password' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-slate-900'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMode('otp')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'otp' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-slate-900'
          }`}
        >
          Phone OTP
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === 'password' ? (
          <>
            <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <Input placeholder="Phone (+639...)" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} required className="min-w-0 flex-1" />
              <Button type="button" variant="outline" size="default" className="w-full shrink-0 sm:w-auto" onClick={handleRequestOtp}>
                Send OTP
              </Button>
            </div>
            {devOtp && <p className="badge-accent">Dev OTP: {devOtp}</p>}
          </>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <Button type="submit" className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        No account?{' '}
        <Link href="/signup" className="link-primary">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
