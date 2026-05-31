'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BrandMark } from '../../components/ui/brand-mark';
import { staffLogin } from '../../lib/partner-api';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('partner@lunara.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await staffLogin(email.trim(), password);
      router.replace(user.role === 'staff' ? '/orders' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <BrandMark partner />
      </div>

      <form onSubmit={handleSubmit} className="card-elevated w-full max-w-md">
        <div className="card-body">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Laundry shop login — manage orders, staff, inventory, and revenue.
          </p>

          <label className="form-label mt-6">Email</label>
          <input
            className="input-field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label className="form-label mt-4">Password</label>
          <input
            className="input-field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && <div className="alert-error mt-4">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Partner: partner@lunara.dev · Staff: staff@lunara.dev / password123
          </p>
        </div>
      </form>
    </div>
  );
}
