'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { DataPageStatus } from '../../../components/data-page-status';
import { adminFetch } from '../../../lib/admin-api';
import { useAdminQuery } from '../../../lib/use-admin-query';

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
  const load = useCallback(() => adminFetch<PartnerBrandSummary[]>('/admin/partners'), []);
  const { data: partners, loading, error, reload } = useAdminQuery(load, []);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Partners</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              White-label branding
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Manage each partner&apos;s branded customer app — colors, fonts, domain, and store listing assets.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/partners/branding/new" className="btn-primary btn-sm">
              New brand
            </Link>
          </div>
        </div>
      </header>

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading partner brands…" />

      {partners && (
        <section className="dc-panel">
          <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Partner brands</h2>
              <p className="text-xs text-muted">
                {partners.length} brand{partners.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {partners.length === 0 ? (
            <div className="dc-panel-empty text-center">
              <p className="font-medium text-slate-900">No partner brands yet</p>
              <p className="mt-1 text-sm text-muted">Create one to start white-labeling a partner&apos;s app.</p>
              <Link href="/partners/branding/new" className="btn-primary btn-sm mt-4 inline-flex">
                New brand
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {partners.map((p) => (
                <Link
                  key={p._id}
                  href={`/partners/branding/${p._id}`}
                  className="flex items-center justify-between gap-4 px-3.5 py-3 transition-colors hover:bg-slate-50"
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
                    {!p.isActive && <span className="badge-neutral">Inactive</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
