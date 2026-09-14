'use client';

import { useEffect } from 'react';
import { Icon } from '../../components/ui/icon';

const OFFLINE_ICON = 'M18.364 5.636a9 9 0 010 12.728m0 0l-4.243-4.243m4.243 4.243L21 21M3 3l3.59 3.59m0 0a9 9 0 00-.475 10.815M9 9a5 5 0 006.978 6.978M9 9l3 3';

export default function OfflinePage() {
  // The service worker (public/sw.js) only serves this page on a failed navigation, not on an
  // 'online' event — reload automatically once connectivity actually returns so a partner isn't
  // stuck here after their connection recovers.
  useEffect(() => {
    const handleOnline = () => window.location.reload();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <div className="portal-bg flex min-h-[50vh] items-center justify-center p-6">
      <div className="card-elevated w-full max-w-md text-center">
        <div className="card-body space-y-4">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon d={OFFLINE_ICON} className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">You&apos;re offline</h1>
          <p className="text-sm text-muted">
            Lunara Partner can&apos;t reach the network right now. Check your connection — this page will
            reload automatically once you&apos;re back online.
          </p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Retry now
          </button>
        </div>
      </div>
    </div>
  );
}
