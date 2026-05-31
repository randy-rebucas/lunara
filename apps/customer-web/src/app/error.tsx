'use client';

import { useEffect } from 'react';
import { Button } from '@lunara/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="laundry-bg flex min-h-screen items-center justify-center p-6">
        <div className="card-elevated page-content-narrow text-center">
          <div className="card-body space-y-4">
            <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
            <p className="text-sm text-muted">
              {error.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="btn-row sm:justify-center">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
                Go to dashboard
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
