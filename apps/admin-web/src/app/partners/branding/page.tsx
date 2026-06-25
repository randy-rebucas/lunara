'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-api';
import { PageHeader } from '../../../components/ui/page-header';

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

const STATUS_BADGE: Record<PartnerBrandSummary['brandConfig']['status'], string> = {
  live: 'badge-accent',
  pending_review: 'badge-warning',
  draft: 'badge-neutral',
};

const STATUS_LABEL: Record<PartnerBrandSummary['brandConfig']['status'], string> = {
  live: 'Live',
  pending_review: 'Pending review',
  draft: 'Draft',
};

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
      <PageHeader
        title="White-label branding"
        description="Manage each partner's branded customer app — colors, fonts, domain, and store listing assets."
        actions={
          <Link href="/partners/branding/new" className="btn-primary btn-sm">
            New brand
          </Link>
        }
      />

      {error ? <div className="alert-error mb-6" role="alert">{error}</div> : null}

      <div className="section-panel">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Partner brands</h2>
          {!loading && partners.length > 0 && (
            <p className="mt-0.5 text-xs text-muted">{partners.length} brand{partners.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            <p className="px-6 py-8 text-sm text-muted">Loading…</p>
          ) : partners.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No partner brands yet</p>
              <p className="mt-1 text-xs text-muted">
                Create one to start white-labeling a partner&apos;s app.
              </p>
              <Link href="/partners/branding/new" className="btn-primary btn-sm mt-4 inline-flex">
                New brand
              </Link>
            </div>
          ) : (
            partners.map((p) => (
              <Link
                key={p._id}
                href={`/partners/branding/${p._id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{p.legalName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {p.brandConfig.appDisplayName}
                    {p.brandConfig.domain ? (
                      <> · <span className="text-code">{p.brandConfig.domain}</span></>
                    ) : (
                      <> · <span className="italic">no domain</span></>
                    )}
                    {' · '}
                    <span className="text-code">{p.slug}</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className={STATUS_BADGE[p.brandConfig.status]}>
                    {STATUS_LABEL[p.brandConfig.status]}
                  </span>
                  {!p.isActive && (
                    <span className="badge-warning">Inactive</span>
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
