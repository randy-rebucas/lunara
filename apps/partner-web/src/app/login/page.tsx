'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-primary">Lunara Partner</h1>
        <p className="mt-2 text-sm text-slate-600">
          Laundry shop login — manage orders, staff, inventory, and revenue.
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-700">Email</label>
        <input
          className="mt-1 w-full rounded-lg border px-4 py-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input
          className="mt-1 w-full rounded-lg border px-4 py-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Login'}
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          Partner: partner@lunara.dev · Staff: staff@lunara.dev / password123
        </p>
      </form>
    </div>
  );
}
