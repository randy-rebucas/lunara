'use client';

export default function OfflinePage() {
  return (
    <div className="portal-bg flex min-h-[50vh] items-center justify-center p-6">
      <div className="card-elevated w-full max-w-md text-center">
        <div className="card-body space-y-4">
          <h1 className="text-xl font-bold text-slate-900">You&apos;re offline</h1>
          <p className="text-sm text-muted">
            Lunara Partner can&apos;t reach the network right now. Check your connection and try again.
          </p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
