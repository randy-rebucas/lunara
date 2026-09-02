'use client';

import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../../components/data-page-status';
import { adminFetch } from '../../../lib/admin-api';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface PartnerLeadTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  destructive: string;
}

interface PartnerLeadManifest {
  appName: string;
  slug: string;
  iosBundleId: string;
  androidPackage: string;
  easProjectId: string;
  splashBackgroundColor: string;
}

interface PartnerLead {
  _id: string;
  brandName: string;
  contactName: string;
  email: string;
  phone?: string;
  region?: string;
  message?: string;
  logoUrl: string;
  colors: PartnerLeadTheme;
  manifest?: PartnerLeadManifest;
  status: 'new' | 'contacted' | 'archived';
  createdAt: string;
}

function buildManifestJson(lead: PartnerLead): string {
  if (!lead.manifest) return '{}';
  return JSON.stringify(
    {
      appName: lead.manifest.appName,
      slug: lead.manifest.slug,
      iosBundleId: lead.manifest.iosBundleId,
      androidPackage: lead.manifest.androidPackage,
      easProjectId: lead.manifest.easProjectId,
      splashBackgroundColor: lead.manifest.splashBackgroundColor,
      theme: {
        appDisplayName: lead.brandName,
        colors: lead.colors,
        fonts: { sans: 'Inter, system-ui, sans-serif' },
      },
    },
    null,
    2,
  );
}

const STATUS_BADGE: Record<PartnerLead['status'], string> = {
  new: 'badge-primary',
  contacted: 'badge-accent',
  archived: 'badge-neutral',
};

const STATUS_LABEL: Record<PartnerLead['status'], string> = {
  new: 'New',
  contacted: 'Contacted',
  archived: 'Archived',
};

export default function PartnerLeadsPage() {
  const load = useCallback(() => adminFetch<PartnerLead[]>('/admin/leads'), []);
  const { data: leads, loading, error, reload } = useAdminQuery(load, []);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopyManifest(lead: PartnerLead) {
    await navigator.clipboard.writeText(buildManifestJson(lead));
    setCopiedId(lead._id);
    setTimeout(() => setCopiedId((id) => (id === lead._id ? null : id)), 2000);
  }

  async function handleStatusChange(id: string, status: PartnerLead['status']) {
    setUpdatingId(id);
    try {
      await adminFetch(`/admin/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await reload();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Partners</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Partner brand leads
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Prospects who previewed a branded app on the customer site and submitted interest.
            </p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading leads…" />

      {leads && (
        <section className="dc-panel">
          <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Leads</h2>
              <p className="text-xs text-muted">
                {leads.length} submission{leads.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {leads.length === 0 ? (
            <div className="dc-panel-empty text-center">
              <p className="font-medium text-slate-900">No leads yet</p>
              <p className="mt-1 text-sm text-muted">
                Submissions from the partner-preview page will show up here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {leads.map((lead) => (
                <div key={lead._id} className="flex items-start gap-4 px-3.5 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lead.logoUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border/60"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{lead.brandName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {lead.contactName} · <span className="text-code">{lead.email}</span>
                      {lead.phone ? <> · {lead.phone}</> : null}
                      {lead.region ? <> · {lead.region}</> : null}
                    </p>
                    {lead.message ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{lead.message}</p>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {[
                        lead.colors.primary,
                        lead.colors.secondary,
                        lead.colors.accent,
                        lead.colors.background,
                        lead.colors.foreground,
                        lead.colors.border,
                      ].map((c, i) => (
                        <span
                          key={i}
                          className="h-3.5 w-3.5 rounded-full ring-1 ring-border/60"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {lead.manifest ? (
                      <p className="mt-1 truncate text-[11px] text-code text-muted-foreground">
                        {lead.manifest.slug} · {lead.manifest.iosBundleId}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={STATUS_BADGE[lead.status]}>{STATUS_LABEL[lead.status]}</span>
                    <select
                      className="input-field w-32 py-1 text-xs"
                      value={lead.status}
                      disabled={updatingId === lead._id}
                      onChange={(e) => void handleStatusChange(lead._id, e.target.value as PartnerLead['status'])}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="archived">Archived</option>
                    </select>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => void handleCopyManifest(lead)}
                      disabled={!lead.manifest}
                    >
                      {copiedId === lead._id ? 'Copied!' : 'Copy manifest.json'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
