'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';

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
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Sign In</h1>
      <div className="mt-4 flex gap-2">
        <Button variant={mode === 'password' ? 'default' : 'outline'} onClick={() => setMode('password')}>
          Email
        </Button>
        <Button variant={mode === 'otp' ? 'default' : 'outline'} onClick={() => setMode('otp')}>
          Phone OTP
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === 'password' ? (
          <>
            <input
              className="w-full rounded-lg border px-4 py-2"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="w-full rounded-lg border px-4 py-2"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <input
              className="w-full rounded-lg border px-4 py-2"
              placeholder="Phone (+639...)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border px-4 py-2"
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              <Button type="button" variant="outline" onClick={handleRequestOtp}>
                Send OTP
              </Button>
            </div>
            {devOtp && <p className="text-sm text-accent">Dev OTP: {devOtp}</p>}
          </>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        No account? <Link href="/signup" className="text-primary">Sign up</Link>
      </p>
    </main>
  );
}
