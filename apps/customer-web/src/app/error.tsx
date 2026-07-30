'use client';

import { useEffect } from 'react';
import { Button } from '@lunara/ui';
import { buttonResponsiveClass } from '../components/ui/button-layout';
import { reportClientError } from '../lib/report-client-error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <div className="laundry-bg flex min-h-[50vh] items-center justify-center p-6">
      <div className="card-elevated page-content-narrow text-center">
        <div className="card-body space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="text-sm text-muted" role="alert">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <div className="btn-row btn-row-responsive sm:justify-center">
            <Button size="lg" className={buttonResponsiveClass('lg')} onClick={reset}>
              Try again
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={buttonResponsiveClass('lg')}
              onClick={() => (window.location.href = '/dashboard')}
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
