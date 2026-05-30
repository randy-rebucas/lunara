'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminLogin } from '../../lib/admin-api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@lunara.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8 text-white shadow-lg"
      >
        <h1 className="text-2xl font-bold text-indigo-400">Lunara Admin</h1>
        <p className="mt-2 text-sm text-slate-400">
          Platform management — operate the entire ecosystem.
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-300">Email</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="mt-4 block text-sm font-medium text-slate-300">Password</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Login'}
        </button>

        <p className="mt-6 text-center text-xs text-slate-500">
          Dev: admin@lunara.dev / password123 (run API seed first)
        </p>
      </form>
    </div>
  );
}
