'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { PageShell } from '../../../../components/page-shell';
import { Card, CardBody } from '../../../../components/ui/card';
import { FormLabel } from '../../../../components/ui/input';

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
    <PageShell narrow>
      <Link href={`/orders/${id}`} className="text-sm text-muted transition-colors hover:text-primary">
        ← Back to order
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">Request a refund</h1>
      <p className="mt-2 text-sm text-muted">
        Submit your request for admin review. We will verify your order and payment, then approve
        or reject. Approved refunds are credited to your wallet.
      </p>
      {loadError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {orderTotal != null && (
        <p className="mt-2 text-sm font-medium">Order total: ₱{orderTotal}</p>
      )}

      <Card className="mt-8">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <FormLabel>Reason for refund</FormLabel>
              <textarea
                className="input-field min-h-[120px] resize-y"
                rows={5}
                placeholder="Explain why you are requesting a refund…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit refund request'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageShell>
  );
}
