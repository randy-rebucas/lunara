'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminFetch, adminUpload } from '../../../../lib/admin-api';

interface PartnerBrandConfig {
  domain?: string;
  customDomainVerified: boolean;
  appDisplayName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
    destructive: string;
  };
  fonts: { sans: string; heading?: string };
  logoUrl?: string;
  iconUrl?: string;
  splashUrl?: string;
  faviconUrl?: string;
  status: 'draft' | 'pending_review' | 'live';
}

interface PartnerRecord {
  _id: string;
  legalName: string;
  slug: string;
  isActive: boolean;
  brandConfig: PartnerBrandConfig;
}

const ASSET_FIELDS = [
  { key: 'logoUrl', label: 'Logo' },
  { key: 'iconUrl', label: 'App icon' },
  { key: 'splashUrl', label: 'Splash image' },
  { key: 'faviconUrl', label: 'Favicon' },
] as const;

const COLOR_FIELDS = [
  'primary',
  'secondary',
  'accent',
  'background',
  'foreground',
  'muted',
  'border',
  'destructive',
] as const;

export default function PartnerBrandingDetailPage() {
  const params = useParams<{ id: string }>();
  const [partner, setPartner] = useState<PartnerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<PartnerRecord>(`/admin/partners/${params.id}`);
      setPartner(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBranding(update: Partial<PartnerBrandConfig>) {
    if (!partner) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await adminFetch<PartnerRecord>(`/admin/partners/${partner._id}/branding`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      setPartner(updated);
      setSuccess('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!partner) return;
    setSaving(true);
    try {
      const updated = await adminFetch<PartnerRecord>(`/admin/partners/${partner._id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !partner.isActive }),
      });
      setPartner(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(field: (typeof ASSET_FIELDS)[number]['key'], file: File) {
    if (!partner) return;
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('asset', file);
      const updated = await adminUpload<PartnerRecord>(
        `/admin/partners/${partner._id}/branding/assets/${field}`,
        formData,
      );
      setPartner(updated);
      setSuccess('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload asset');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!partner) return <div className="alert-error">{error || 'Partner not found'}</div>;

  const brand = partner.brandConfig;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/partners/branding" className="text-xs text-muted hover:text-primary">
            ← Branding
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{partner.legalName}</h1>
          <p className="mt-1 text-sm text-muted">{partner.slug}</p>
        </div>
        <button type="button" className="btn-outline btn-sm" onClick={toggleActive} disabled={saving}>
          {partner.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {error ? <div className="alert-error mb-4" role="alert">{error}</div> : null}
      {success ? <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{success}</div> : null}

      {/* App identity */}
      <section className="section-panel mb-8">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">App identity</h2>
          <p className="mt-0.5 text-xs text-muted">Domain, display name, and rollout status.</p>
        </div>
        <div className="p-6">
          <div className="dc-form-grid">
            <div>
              <label className="form-label">Domain</label>
              <input
                className="input-field"
                defaultValue={brand.domain ?? ''}
                placeholder="partnerx.lunara.app"
                onBlur={(e) => saveBranding({ domain: e.target.value.trim() || undefined })}
              />
            </div>
            <div>
              <label className="form-label">App display name</label>
              <input
                className="input-field"
                defaultValue={brand.appDisplayName}
                onBlur={(e) => saveBranding({ appDisplayName: e.target.value.trim() })}
              />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="input-field"
                defaultValue={brand.status}
                onChange={(e) => saveBranding({ status: e.target.value as PartnerBrandConfig['status'] })}
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending review</option>
                <option value="live">Live</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Colors */}
      <section className="section-panel mb-8">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Colors</h2>
          <p className="mt-0.5 text-xs text-muted">Applied as CSS variables on the partner&apos;s customer-web domain.</p>
        </div>
        <div className="p-6">
          <div className="dc-form-grid">
            {COLOR_FIELDS.map((key) => (
              <div key={key}>
                <label className="form-label capitalize">{key}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-9 shrink-0 rounded border border-border"
                    defaultValue={brand.colors[key]}
                    onBlur={(e) => saveBranding({ colors: { ...brand.colors, [key]: e.target.value } })}
                  />
                  <input
                    className="input-field"
                    defaultValue={brand.colors[key]}
                    onBlur={(e) => saveBranding({ colors: { ...brand.colors, [key]: e.target.value } })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fonts */}
      <section className="section-panel mb-8">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Fonts</h2>
        </div>
        <div className="p-6">
          <div className="dc-form-grid">
            <div>
              <label className="form-label">Sans (body)</label>
              <input
                className="input-field"
                defaultValue={brand.fonts.sans}
                onBlur={(e) => saveBranding({ fonts: { ...brand.fonts, sans: e.target.value } })}
              />
            </div>
            <div>
              <label className="form-label">Heading <span className="font-normal text-muted">(optional)</span></label>
              <input
                className="input-field"
                defaultValue={brand.fonts.heading ?? ''}
                onBlur={(e) => saveBranding({ fonts: { ...brand.fonts, heading: e.target.value || undefined } })}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Assets */}
      <section className="section-panel mb-8">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Assets</h2>
          <p className="mt-0.5 text-xs text-muted">
            Logo, app icon, splash image, and favicon. Also used as the customer-mobile EAS build
            source — see partner-brands/&lt;slug&gt;/ in the repo.
          </p>
        </div>
        <div className="p-6">
          <div className="dc-form-grid">
            {ASSET_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="form-label">{label}</label>
                <div className="flex items-center gap-3">
                  {brand[key] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand[key]} alt="" className="h-10 w-10 rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg border border-dashed border-border" />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="text-xs"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAsset(key, file);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
