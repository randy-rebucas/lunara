'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { CustomerNav } from '../../../../components/customer-nav';

export default function ReportLostItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api, isAuthenticated, isLoading } = useAuthContext();
  const [description, setDescription] = useState('');
  const [missingItems, setMissingItems] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && !isAuthenticated) {
    router.replace('/login');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || description.trim().length < 10) {
      setError('Please describe the missing item (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post<{ _id: string }>('/support/lost-items', {
        orderId: id,
        description: description.trim(),
        missingItems: missingItems
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      router.push(`/support/${res.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report');
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
        <h1 className="mt-4 text-2xl font-bold text-primary">Report a missing item</h1>
        <p className="mt-2 text-sm text-slate-600">
          We will open a support ticket, investigate with pickup/delivery photos and shop logs,
          and contact you with an outcome. Compensation may be credited to your wallet if approved.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border bg-white p-6">
          <div>
            <label className="text-sm font-medium text-slate-700">What is missing?</label>
            <input
              className="mt-1 w-full rounded-lg border px-4 py-2 text-sm"
              placeholder="e.g. White dress shirt, blue jeans"
              value={missingItems}
              onChange={(e) => setMissingItems(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Comma-separated list (optional)</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Details</label>
            <textarea
              className="mt-1 w-full rounded-lg border px-4 py-2 text-sm"
              rows={5}
              placeholder="Describe what was in your order, when you noticed the item missing, and any tag or receipt details…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit complaint & create ticket'}
          </Button>
        </form>
      </main>
    </>
  );
}
