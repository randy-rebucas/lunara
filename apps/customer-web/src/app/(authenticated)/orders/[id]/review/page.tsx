'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ButtonLink } from '../../../../../components/ui/button-link';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { PageShell } from '../../../../../components/page-shell';
import { ReviewForm } from '../../../../../components/review/review-form';
import { StarRating } from '../../../../../components/review/star-rating';
import { PageHeader } from '../../../../../components/ui/page-header';
import { useProtectedPage } from '../../../../../hooks/use-protected-page';
import { AuthLoading } from '../../../../../components/auth-loading';

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
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
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

  if (isLoading || !ready) {
    return <AuthLoading message="Loading review…" />;
  }

  const showForm = status?.canReview && !published;
  const showPublished = published ?? status?.review;

  return (
    <PageShell narrow>
      <PageHeader
        title="Rate your experience"
        description="Help us improve by reviewing your completed laundry order"
        backHref={`/orders/${id}`}
        backLabel="Back to order"
      />

        {loadError && <p className="text-sm text-red-500">{loadError}</p>}

        {status && !status.canReview && !showPublished && (
          <div className="panel mt-8 bg-slate-50 text-sm text-muted">
            Reviews are available after your order is completed.
            <p className="mt-1 capitalize">Current status: {status.orderStatus.replace(/_/g, ' ')}</p>
            <Link href={`/orders/${id}`} className="mt-3 inline-block text-primary">
              View order →
            </Link>
          </div>
        )}

        {showForm && (
          <div className="panel mt-8">
            <ReviewForm onSubmit={handleSubmit} loading={submitting} />
          </div>
        )}

        {showPublished && (
          <div className="panel mt-8 bg-accent/5 ring-1 ring-accent/20">
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
            <div className="mt-6 btn-row btn-row-responsive sm:justify-center">
              <ButtonLink href={`/orders/${id}`} variant="outline" size="lg" layout="responsive">
                Track order
              </ButtonLink>
              <ButtonLink href="/orders" size="lg" layout="responsive">
                My orders
              </ButtonLink>
            </div>
          </div>
        )}
    </PageShell>
  );
}
