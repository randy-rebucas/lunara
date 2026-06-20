'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-api';

interface PartnerBrandSummary {
  _id: string;
  legalName: string;
  slug: string;
  isActive: boolean;
  brandConfig: {
    domain?: string;
    appDisplayName: string;
    status: 'draft' | 'pending_review' | 'live';
  };
}

export default function PartnerBrandingListPage() {
  const [partners, setPartners] = useState<PartnerBrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<PartnerBrandSummary[]>('/admin/partners')
      .then(setPartners)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load partners'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">White-label branding</h1>
          <p className="mt-1 text-sm text-muted">
            Manage each partner&apos;s branded customer app — colors, fonts, domain, and store
            listing assets.
          </p>
        </div>
        <Link href="/partners/branding/new" className="btn-primary btn-sm shrink-0">
          New brand
        </Link>
      </div>

      {error ? <div className="alert-error mb-4" role="alert">{error}</div> : null}

      <div className="section-panel">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Partner brands</h2>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <p className="px-6 py-8 text-sm text-muted">Loading…</p>
          ) : partners.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">
              No partner brands yet. Create one to start white-labeling a partner&apos;s app.
            </p>
          ) : (
            partners.map((p) => (
              <Link
                key={p._id}
                href={`/partners/branding/${p._id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.legalName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {p.brandConfig.domain ?? 'No domain set'} · {p.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {p.brandConfig.status}
                  </span>
                  {!p.isActive && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                      Inactive
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
