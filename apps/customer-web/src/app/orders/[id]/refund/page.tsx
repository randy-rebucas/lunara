'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { CustomerNav } from '../../../../components/customer-nav';

export default function RequestRefundPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api, isAuthenticated, isLoading } = useAuthContext();
  const [reason, setReason] = useState('');
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    api
      .get<{ order: { total: number } }>(`/payments/orders/${id}`)
      .then((res) => setOrderTotal(res.data.order?.total ?? null))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load order'));
  }, [api, id, isAuthenticated]);

  if (!isLoading && !isAuthenticated) {
    router.replace('/login');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || reason.trim().length < 10) {
      setError('Please explain your refund request (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post<{ _id: string }>('/refunds', {
        orderId: id,
        reason: reason.trim(),
      });
      router.push(`/refunds/${res.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-4 py-8">
        <Link href={`/orders/${id}`} className="text-sm text-slate-500 hover:text-primary">
          ← Back to order
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-primary">Request a refund</h1>
        <p className="mt-2 text-sm text-slate-600">
          Submit your request for admin review. We will verify your order and payment, then approve
          or reject. Approved refunds are credited to your wallet.
        </p>
        {loadError && <p className="mt-2 text-sm text-red-500">{loadError}</p>}
        {orderTotal != null && (
          <p className="mt-2 text-sm font-medium">Order total: ₱{orderTotal}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border bg-white p-6">
          <div>
            <label className="text-sm font-medium text-slate-700">Reason for refund</label>
            <textarea
              className="mt-1 w-full rounded-lg border px-4 py-2 text-sm"
              rows={5}
              placeholder="Explain why you are requesting a refund…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit refund request'}
          </Button>
        </form>
      </main>
    </>
  );
}
