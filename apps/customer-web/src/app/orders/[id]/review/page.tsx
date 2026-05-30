'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { CustomerNav } from '../../../../components/customer-nav';
import { ReviewForm } from '../../../../components/review/review-form';
import { StarRating } from '../../../../components/review/star-rating';
import { useRequireOnboardingComplete } from '../../../../hooks/use-require-onboarding';

interface ReviewData {
  _id: string;
  rating: number;
  comment?: string;
  publishedAt: string;
}

interface ReviewStatus {
  canReview: boolean;
  review: ReviewData | null;
  orderStatus: string;
}

export default function OrderReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuthContext();
  const { isLoading, ready } = useRequireOnboardingComplete();
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState<ReviewData | null>(null);

  useEffect(() => {
    if (!ready || !id) return;
    api
      .get<ReviewStatus>(`/reviews/orders/${id}`)
      .then((res) => {
        setStatus(res.data);
        if (res.data.review) setPublished(res.data.review);
        api
          .get<{ _id: string; read: boolean; data?: { orderId?: string } }[]>(
            '/notifications/me?limit=10',
          )
          .then((nRes) => {
            const unread = nRes.data.find((n) => !n.read && n.data?.orderId === id);
            if (unread) api.patch(`/notifications/${unread._id}/read`, {}).catch(() => {});
          })
          .catch(() => {});
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load review'));
  }, [ready, api, id]);

  async function handleSubmit(rating: number, comment: string) {
    setSubmitting(true);
    try {
      const res = await api.post<{ review: ReviewData }>('/reviews', {
        orderId: id,
        rating,
        comment: comment || undefined,
      });
      setPublished(res.data.review);
      setStatus((s) => (s ? { ...s, canReview: false, review: res.data.review } : s));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !ready) return null;

  const showForm = status?.canReview && !published;
  const showPublished = published ?? status?.review;

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-6 py-10">
        <Link href={`/orders/${id}`} className="text-sm text-slate-500 hover:text-primary">
          ← Back to order
        </Link>

        <h1 className="mt-4 text-2xl font-bold">Rate your experience</h1>
        <p className="mt-1 text-sm text-slate-500">
          Help us improve by reviewing your completed laundry order
        </p>

        {loadError && <p className="mt-4 text-sm text-red-500">{loadError}</p>}

        {status && !status.canReview && !showPublished && (
          <div className="mt-8 rounded-lg border bg-slate-50 p-5 text-sm text-slate-600">
            Reviews are available after your order is completed.
            <p className="mt-1 capitalize">Current status: {status.orderStatus.replace(/_/g, ' ')}</p>
            <Link href={`/orders/${id}`} className="mt-3 inline-block text-primary">
              View order →
            </Link>
          </div>
        )}

        {showForm && (
          <div className="mt-8 rounded-xl border bg-white p-6">
            <ReviewForm onSubmit={handleSubmit} loading={submitting} />
          </div>
        )}

        {showPublished && (
          <div className="mt-8 rounded-xl border border-accent/30 bg-green-50/50 p-6">
            <p className="text-center text-sm font-semibold text-accent">Review published</p>
            <p className="mt-2 text-center text-xs text-slate-500">
              Published{' '}
              {new Date(showPublished.publishedAt).toLocaleString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            <div className="mt-4 flex justify-center">
              <StarRating value={showPublished.rating} readOnly />
            </div>
            {showPublished.comment && (
              <p className="mt-4 text-center text-sm text-slate-700">&ldquo;{showPublished.comment}&rdquo;</p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href={`/orders/${id}`}>
                <Button variant="outline" className="w-full sm:w-auto">
                  Track order
                </Button>
              </Link>
              <Button className="w-full sm:w-auto" onClick={() => router.push('/orders')}>
                My orders
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
