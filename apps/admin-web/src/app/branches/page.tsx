'use client';

import { Suspense } from 'react';
import { BranchesBoard } from '../../components/datacenter/branches-board';

export default function BranchNetworkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading branch network…
        </div>
      }
    >
      <BranchesBoard />
    </Suspense>
  );
}
