'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserRole } from '@lunara/types';
import brandIcon from '@lunara/brand/icon';
import Image from 'next/image';
import { Icon, ICONS } from '../../components/ui/icon';
import { getPartnerToken, getPortalUser, staffLogin } from '../../lib/partner-api';

const DEV_EMAIL = 'partner@lunara.dev';
const DEV_PASSWORD = 'password123';
const isDev = process.env.NODE_ENV === 'development';

const MAIL_ICON = 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75';
const LOCK_ICON = 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z';
const SHIELD_ICON = 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.286z';

const BUBBLES = [
  { left: '4%', size: 24, duration: 16, delay: 0, drift: 16 },
  { left: '14%', size: 46, duration: 22, delay: 3, drift: -18 },
  { left: '26%', size: 16, duration: 12, delay: 6, drift: 12 },
  { left: '36%', size: 60, duration: 26, delay: 1, drift: 24 },
  { left: '48%', size: 20, duration: 14, delay: 8, drift: -14 },
  { left: '58%', size: 38, duration: 20, delay: 4, drift: 18 },
  { left: '70%', size: 14, duration: 11, delay: 2, drift: -10 },
  { left: '80%', size: 52, duration: 24, delay: 7, drift: 20 },
  { left: '90%', size: 22, duration: 15, delay: 5, drift: -16 },
] as const;

const FORM_BUBBLES = [
  { left: '3%', size: 20, duration: 17, delay: 1, drift: 12 },
  { left: '15%', size: 40, duration: 23, delay: 5, drift: -16 },
  { left: '30%', size: 14, duration: 12, delay: 8, drift: 10 },
  { left: '44%', size: 50, duration: 25, delay: 2, drift: 20 },
  { left: '58%', size: 18, duration: 14, delay: 6, drift: -12 },
  { left: '70%', size: 34, duration: 19, delay: 0, drift: 16 },
  { left: '84%', size: 16, duration: 13, delay: 4, drift: -10 },
  { left: '94%', size: 44, duration: 21, delay: 7, drift: 18 },
] as const;

function BubbleField({ bubbles, className }: { bubbles: readonly { left: string; size: number; duration: number; delay: number; drift: number }[]; className: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className={className}
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            ['--bubble-drift' as string]: `${b.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

const FEATURES = [
  {
    icon: ICONS.receipt,
    title: 'Order Management',
    description: 'Accept, process, and hand off orders from one queue',
  },
  {
    icon: ICONS.users,
    title: 'Staff & Inventory',
    description: 'Coordinate your team and track stock in real time',
  },
  {
    icon: ICONS.scale,
    title: 'Revenue & Settlements',
    description: 'See earnings and payouts as soon as orders complete',
  },
];

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(isDev ? DEV_EMAIL : '');
  const [password, setPassword] = useState(isDev ? DEV_PASSWORD : '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getPartnerToken()) return;
    const user = getPortalUser();
    router.replace(user?.role === UserRole.STAFF ? '/orders' : '/');
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await staffLogin(email.trim(), password);
      router.replace(user.role === UserRole.STAFF ? '/orders' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#04142e] bg-cover bg-center px-12 py-12 text-white lg:flex"
        style={{ backgroundImage: "url('/images/background.png')" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(7,33,66,0.55), rgba(6,24,54,0.6) 45%, rgba(3,12,30,0.78)), radial-gradient(60% 50% at 30% 20%, rgba(37,99,235,0.35), transparent), radial-gradient(50% 40% at 80% 80%, rgba(6,182,212,0.28), transparent)',
          }}
          aria-hidden
        />

        <BubbleField bubbles={BUBBLES} className="login-bubble" />

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
            <p className="text-xs text-slate-400">Partner Portal</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Run Your Shop
            <br />
            <span className="text-sky-300">Without the Guesswork</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm text-slate-300">
            Everything you need to manage orders, staff, inventory, and revenue for your laundry
            shop — in one place.
          </p>

          <ul className="mt-8 space-y-5">
            {FEATURES.map(({ icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-200 ring-1 ring-white/10">
                  <Icon d={icon} className="h-5 w-5" />
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

      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-surface px-6 py-12 sm:px-12">
        <BubbleField bubbles={FORM_BUBBLES} className="login-bubble-light" />

        <form onSubmit={handleSubmit} className="relative w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage orders, staff, inventory, and revenue for your shop.
          </p>

          <label htmlFor="portal-email" className="form-label mt-8">
            Email
          </label>
          <div className="relative">
            <Icon
              d={MAIL_ICON}
              className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="portal-email"
              className="input-field pl-11"
              type="email"
              placeholder="you@shop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <label htmlFor="portal-password" className="form-label mt-4">
            Password
          </label>
          <div className="relative">
            <Icon
              d={LOCK_ICON}
              className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="portal-password"
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
              {showPassword ? (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <div className="alert-error mt-4" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full gap-2 py-3">
            <Icon d={LOCK_ICON} className="h-4 w-4" />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mt-6 rounded-lg bg-surface-muted px-4 py-3 ring-1 ring-border/60">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon d={SHIELD_ICON} className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Secure Partner Access</p>
                <p className="text-xs text-muted-foreground">
                  Your shop data is protected with enterprise-grade encryption and security.
                </p>
              </div>
            </div>
          </div>

          {isDev && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Partner: partner@lunara.dev · Staff: staff@lunara.dev / password123
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
