'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../../../components/auth-loading';
import { PageShell } from '../../../../../components/page-shell';
import { Card, CardBody } from '../../../../../components/ui/card';
import { FormLabel, Input } from '../../../../../components/ui/input';
import { useProtectedPage } from '../../../../../hooks/use-protected-page';

export default function ReportLostItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [description, setDescription] = useState('');
  const [missingItems, setMissingItems] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading…" />;
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
    <PageShell narrow>
      <Link href={`/orders/${id}`} className="text-sm text-muted transition-colors hover:text-primary">
        ← Back to order
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">Report a missing item</h1>
      <p className="mt-2 text-sm text-muted">
        We will open a support ticket, investigate with pickup/delivery photos and shop logs,
        and contact you with an outcome. Compensation may be credited to your wallet if approved.
      </p>

      <Card className="mt-8">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <FormLabel>What is missing?</FormLabel>
              <Input
                placeholder="e.g. White dress shirt, blue jeans"
                value={missingItems}
                onChange={(e) => setMissingItems(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Comma-separated list (optional)</p>
            </div>

            <div>
              <FormLabel>Details</FormLabel>
              <textarea
                className="input-field min-h-[120px] resize-y"
                rows={5}
                placeholder="Describe what was in your order, when you noticed the item missing, and any tag or receipt details…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit complaint & create ticket'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageShell>
  );
}
