'use client';

import { useState } from 'react';
import { Button } from '@lunara/ui';
import { StarRating } from './star-rating';

export function ReviewForm({
  onSubmit,
  loading,
}: {
  onSubmit: (rating: number, comment: string) => Promise<void>;
  loading?: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (rating < 1) {
      setError('Please select a star rating');
      return;
    }
    try {
      await onSubmit(rating, comment.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit review');
    }
  }

  const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-700">Rate your experience</p>
        <div className="mt-3">
          <StarRating value={rating} onChange={setRating} />
        </div>
        {rating > 0 && (
          <p className="mt-2 text-sm text-primary">{labels[rating]}</p>
        )}
      </div>

      <div>
        <label htmlFor="review-comment" className="text-sm font-medium text-slate-700">
          Write a comment (optional)
        </label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={2000}
          placeholder="Tell us about pickup, wash quality, delivery…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="input-field mt-2 min-h-[100px] resize-y"
        />
        <p className="mt-1 text-xs text-slate-400">{comment.length}/2000</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={loading || rating < 1}>
        {loading ? 'Publishing…' : 'Submit review'}
      </Button>
    </form>
  );
}
