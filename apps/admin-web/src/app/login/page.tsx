'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from '../../components/ui/brand-mark';
import { adminLogin, getAdminToken } from '../../lib/admin-api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getAdminToken()) {
      router.replace('/');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await adminLogin(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <BrandMark />
      </div>

      <form onSubmit={handleSubmit} className="card-elevated w-full max-w-md">
        <div className="card-body">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Platform management — operate orders, riders, shops, and support.
          </p>

          <label htmlFor="admin-email" className="form-label mt-6">
            Email
          </label>
          <input
            id="admin-email"
            className="input-field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="admin-password" className="form-label mt-4">
            Password
          </label>
          <input
            id="admin-password"
            className="input-field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error ? (
            <div className="alert-error mt-4" role="alert">
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {process.env.NODE_ENV === 'development' ? (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Dev: seed the API first, then use admin@lunara.dev / password123
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
