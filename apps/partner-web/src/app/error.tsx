'use client';

import { useEffect } from 'react';

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
      <body className="portal-bg flex min-h-screen items-center justify-center p-6">
        <div className="card-elevated w-full max-w-md text-center">
          <div className="card-body space-y-4">
            <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
            <p className="text-sm text-muted">
              {error.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary" onClick={reset}>
                Try again
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Go to portal
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
