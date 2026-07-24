'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Package,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import brandIcon from '@lunara/brand/icon';
import { adminLogin, getAdminToken } from '../../lib/admin-api';

const features = [
  {
    icon: Package,
    title: 'Real-time Order Tracking',
    description: 'Monitor orders from pickup to delivery',
  },
  {
    icon: BarChart3,
    title: 'Business Insights',
    description: 'Track performance and grow your business',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Reliable',
    description: 'Enterprise-grade security for your data',
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rawRedirect = searchParams.get('redirect');
  const redirectTo =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  useEffect(() => {
    if (getAdminToken()) {
      router.replace(redirectTo);
    }
  }, [router, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await adminLogin(email.trim(), password);
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Welcome Back!
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to your Lunara Admin Dashboard
      </p>

      <label htmlFor="admin-email" className="form-label mt-8">
        Email Address
      </label>
      <div className="relative">
        <Mail
          className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="admin-email"
          className="input-field pl-11"
          type="email"
          placeholder="admin@lunara.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <label htmlFor="admin-password" className="form-label mb-0">
          Password
        </label>
        <a href="#" className="link-primary text-sm">
          Forgot Password?
        </a>
      </div>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="admin-password"
          className="input-field pl-11 pr-11"
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
          />
          Remember me
        </label>
        <span className="text-sm text-muted-foreground">
          Need help? <a href="#" className="link-primary">Contact Support</a>
        </span>
      </div>

      {error ? (
        <div className="alert-error mt-4" role="alert">
          {error}
        </div>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary mt-6 w-full gap-2 py-3">
        <Lock className="h-4 w-4" aria-hidden />
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      <div className="mt-6 rounded-lg bg-surface-muted px-4 py-3 ring-1 ring-border/60">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Secure Admin Access</p>
            <p className="text-xs text-muted-foreground">
              Your data is protected with enterprise-grade encryption and security.
            </p>
          </div>
        </div>
      </div>

      {process.env.NODE_ENV === 'development' ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dev: seed the API first, then use admin@lunara.dev / password123
        </p>
      ) : null}
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0b1030] px-12 py-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 20%, rgba(79,70,229,0.35), transparent), radial-gradient(50% 40% at 80% 80%, rgba(6,182,212,0.2), transparent)',
          }}
          aria-hidden
        />

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
            <p className="text-xs text-slate-400">Laundry Pickup &amp; Delivery</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Smart Laundry
            <br />
            <span className="text-indigo-300">Management</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm text-slate-300">
            Manage your laundry business, riders, orders, and customers in one powerful
            platform.
          </p>

          <ul className="mt-8 space-y-5">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-indigo-200 ring-1 ring-white/10">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-sm text-slate-400">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} Lunara. All rights reserved.
        </p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-surface px-6 py-12 sm:px-12">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
