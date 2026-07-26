'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import brandIcon from '@lunara/brand/icon';
import { getAuthToken, login, requestPasswordReset } from '../../lib/ai-agents-api';
import { AuroraOrb } from '../../components/aurora-orb';

const SECURITY_NOTES = [
  'JWT-secured sessions',
  'Role-based agent access',
  'Session auto-refresh',
];

function ForgotPassword({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-500/20">
        If an account exists for that email, a reset link is on its way.{' '}
        <button type="button" onClick={onDone} className="font-medium underline underline-offset-2">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
      <p className="text-sm font-medium text-white">Reset your password</p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@lunara.app"
        className="w-full rounded-lg bg-slate-900/60 px-3.5 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-lg bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send reset link'}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-slate-400 hover:text-slate-200">
          Cancel
        </button>
      </div>
    </form>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const rawRedirect = searchParams.get('redirect');
  const redirectTo =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  useEffect(() => {
    if (getAuthToken()) router.replace(redirectTo);
  }, [router, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password, remember);
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-slate-900/60 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:p-8">
      <div className="mb-6 flex justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/30">
          <ShieldCheck className="h-5.5 w-5.5" aria-hidden />
        </span>
      </div>

      <h1 className="text-center text-xl font-bold text-white">
        Sign in <span className="font-normal text-slate-400">to your account</span>
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              id="email"
              type="email"
              className="w-full rounded-lg bg-slate-950/50 py-2.5 pl-11 pr-4 text-sm text-white ring-1 ring-white/10 transition-shadow placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
              placeholder="you@lunara.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="w-full rounded-lg bg-slate-950/50 py-2.5 pl-11 pr-11 text-sm text-white ring-1 ring-white/10 transition-shadow placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-950/50 text-indigo-500 focus:ring-indigo-400/50"
            />
            Remember this device
          </label>
          <button
            type="button"
            onClick={() => setShowForgot((v) => !v)}
            className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
          >
            Forgot Password?
          </button>
        </div>

        {showForgot ? <ForgotPassword onDone={() => setShowForgot(false)} /> : null}

        {error ? (
          <div className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-300 ring-1 ring-red-500/20" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <a
            href={`/register${rawRedirect ? `?redirect=${encodeURIComponent(rawRedirect)}` : ''}`}
            className="font-medium text-indigo-300 hover:text-indigo-200"
          >
            Sign up
          </a>
        </p>
      </form>

      <div className="mt-6 rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-300" aria-hidden />
          Protected by Lunara AI Security
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {SECURITY_NOTES.map((note) => (
            <li key={note}>✓ {note}</li>
          ))}
        </ul>
      </div>

      {process.env.NODE_ENV === 'development' ? (
        <p className="mt-6 text-center text-xs text-slate-600">
          Dev: sign in with a STAFF, ADMIN, or CUSTOMER account
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-[#05070f]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: 'url(/images/backgrounds/bg-wave.png)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,7,15,0.35), rgba(5,7,15,0.9)), radial-gradient(55% 45% at 25% 15%, rgba(99,102,241,0.25), transparent), radial-gradient(45% 40% at 85% 85%, rgba(139,92,246,0.2), transparent)',
        }}
        aria-hidden
      />

      <div className="relative hidden w-1/2 flex-col justify-between px-12 py-12 text-white lg:flex">
        <div className="relative flex items-center gap-2.5">
          <Image
            src={brandIcon}
            alt=""
            width={40}
            height={40}
            className="shrink-0 rounded-xl shadow-lg"
            aria-hidden
            priority
          />
          <div>
            <p className="text-sm font-bold tracking-wide">LUNARA</p>
            <p className="text-xs text-slate-400">AI Team Command Center</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Welcome to
            <br />
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              Lunara AI
            </span>
          </h2>
          <p className="mt-3 max-w-sm text-sm text-slate-400">Your AI workforce is ready to assist.</p>

          <div className="mt-8">
            <AuroraOrb />
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3.5 ring-1 ring-indigo-400/20">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#05070f]" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Aurora AI — Online</p>
              <p className="text-xs text-slate-400">8 AI specialists available</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs italic text-slate-500">
          &ldquo;Smart AI. Seamless operations. Happy customers.&rdquo;
        </p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
