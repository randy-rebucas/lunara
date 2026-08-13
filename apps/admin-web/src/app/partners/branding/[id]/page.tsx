'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminFetch, adminUpload } from '../../../../lib/admin-api';
import { useAdminQuery } from '../../../../lib/use-admin-query';
import { TerritoryMapEditor, type LngLat } from '../../../../components/datacenter/territory-map-editor';

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

interface PartnerTerritory {
  _id: string;
  partnerId: string;
  name: string;
  slug: string;
  boundaryType: 'radius' | 'polygon';
  center?: { type: string; coordinates: [number, number] };
  radiusKm?: number;
  boundary?: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  isExclusive: boolean;
  status: 'active' | 'pending' | 'suspended';
  primaryContactName?: string;
  primaryContactPhone?: string;
  opsNotes?: string;
}

const TERRITORY_STATUS_OPTIONS = ['active', 'pending', 'suspended'] as const;

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

interface TerritoryFormState {
  name: string;
  slug: string;
  boundaryType: 'radius' | 'polygon';
  latitude: string;
  longitude: string;
  radiusKm: string;
  polygonPath: LngLat[] | null;
  isExclusive: boolean;
  status: PartnerTerritory['status'];
  primaryContactName: string;
  primaryContactPhone: string;
  opsNotes: string;
}

/** Metro Manila — same default used elsewhere in admin-web (branches-board) when no location is set yet. */
const DEFAULT_TERRITORY_CENTER = { latitude: 14.5995, longitude: 120.9842 };

const EMPTY_TERRITORY_FORM: TerritoryFormState = {
  name: '',
  slug: '',
  boundaryType: 'radius',
  latitude: String(DEFAULT_TERRITORY_CENTER.latitude),
  longitude: String(DEFAULT_TERRITORY_CENTER.longitude),
  radiusKm: '15',
  polygonPath: null,
  isExclusive: true,
  status: 'active',
  primaryContactName: '',
  primaryContactPhone: '',
  opsNotes: '',
};

function polygonCentroid(ring: LngLat[]): { latitude: number; longitude: number } {
  const pts = ring.slice(0, -1);
  const sum = pts.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), { lng: 0, lat: 0 });
  return { latitude: sum.lat / pts.length, longitude: sum.lng / pts.length };
}

function toTerritoryForm(t: PartnerTerritory): TerritoryFormState {
  const polygonPath =
    t.boundaryType === 'polygon' && t.boundary
      ? ((t.boundary.type === 'Polygon'
          ? (t.boundary.coordinates as LngLat[][])[0]
          : (t.boundary.coordinates as LngLat[][][])[0][0]) ?? null)
      : null;
  const centroid = polygonPath ? polygonCentroid(polygonPath) : null;
  return {
    name: t.name,
    slug: t.slug,
    boundaryType: t.boundaryType,
    latitude: t.center ? String(t.center.coordinates[1]) : centroid ? String(centroid.latitude) : String(DEFAULT_TERRITORY_CENTER.latitude),
    longitude: t.center ? String(t.center.coordinates[0]) : centroid ? String(centroid.longitude) : String(DEFAULT_TERRITORY_CENTER.longitude),
    radiusKm: t.radiusKm != null ? String(t.radiusKm) : '15',
    polygonPath,
    isExclusive: t.isExclusive,
    status: t.status,
    primaryContactName: t.primaryContactName ?? '',
    primaryContactPhone: t.primaryContactPhone ?? '',
    opsNotes: t.opsNotes ?? '',
  };
}

function TerritorySection({ partnerId, defaultName }: { partnerId: string; defaultName: string }) {
  const [territory, setTerritory] = useState<PartnerTerritory | null | undefined>(undefined);
  const [form, setForm] = useState<TerritoryFormState>(EMPTY_TERRITORY_FORM);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');

  const loadTerritory = useCallback(async () => {
    setLoadError('');
    try {
      const res = await adminFetch<PartnerTerritory | null>(`/admin/partners/${partnerId}/territory`);
      setTerritory(res);
      setForm(res ? toTerritoryForm(res) : { ...EMPTY_TERRITORY_FORM, name: `${defaultName} territory` });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load territory');
    }
  }, [partnerId, defaultName]);

  useEffect(() => {
    void loadTerritory();
  }, [loadTerritory]);

  function update<K extends keyof TerritoryFormState>(key: K, value: TerritoryFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSuccess('');
    try {
      if (!form.name.trim() || !form.slug.trim()) throw new Error('Name and slug are required');

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        boundaryType: form.boundaryType,
        isExclusive: form.isExclusive,
        status: form.status,
        primaryContactName: form.primaryContactName.trim() || undefined,
        primaryContactPhone: form.primaryContactPhone.trim() || undefined,
        opsNotes: form.opsNotes.trim() || undefined,
      };

      if (form.boundaryType === 'radius') {
        const lat = Number(form.latitude);
        const lng = Number(form.longitude);
        const radius = Number(form.radiusKm);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Valid latitude and longitude are required');
        if (!Number.isFinite(radius) || radius <= 0) throw new Error('A radius in km is required');
        body.center = { latitude: lat, longitude: lng };
        body.radiusKm = radius;
      } else {
        if (!form.polygonPath || form.polygonPath.length < 4) {
          throw new Error('Draw a boundary with at least 3 points');
        }
        body.boundary = { type: 'Polygon', coordinates: [form.polygonPath] };
      }

      const res = await adminFetch<PartnerTerritory>(`/admin/partners/${partnerId}/territory`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setTerritory(res);
      setForm(toTerritoryForm(res));
      setSuccess('Saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save territory');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section-panel mb-8">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Territory</h2>
        <p className="mt-0.5 text-xs text-muted">
          This partner&apos;s service area and dispatch exclusivity. Bookings outside this radius fail
          checkout instead of falling back to the shared admin queue; exclusive territories block other
          partners from being dispatched inside them.
        </p>
      </div>
      <div className="p-6">
        {loadError ? <div className="alert-error mb-4" role="alert">{loadError}</div> : null}
        {territory === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {!territory ? (
              <p className="text-xs text-muted">No territory configured yet — this partner can currently be dispatched to from anywhere.</p>
            ) : null}
            {saveError ? <div className="alert-error" role="alert">{saveError}</div> : null}
            {success ? <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{success}</div> : null}

            <div className="dc-form-grid">
              <div>
                <label className="form-label">Territory name</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g. 3D Laundry Hub — Metro Cebu"
                />
              </div>
              <div>
                <label className="form-label">Slug</label>
                <input
                  className="input-field"
                  value={form.slug}
                  onChange={(e) => update('slug', e.target.value)}
                  placeholder="3d-laundry-hub-cebu"
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  className="input-field"
                  value={form.status}
                  onChange={(e) => update('status', e.target.value as PartnerTerritory['status'])}
                >
                  {TERRITORY_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Boundary type</label>
                <select
                  className="input-field"
                  value={form.boundaryType}
                  onChange={(e) => update('boundaryType', e.target.value as 'radius' | 'polygon')}
                >
                  <option value="radius">Radius (circle)</option>
                  <option value="polygon">Polygon (drawn boundary)</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-slate-900">
                  <input
                    type="checkbox"
                    checked={form.isExclusive}
                    onChange={(e) => update('isExclusive', e.target.checked)}
                  />
                  Exclusive (block other partners inside this area)
                </label>
              </div>
            </div>

            {form.boundaryType === 'radius' ? (
              <div className="dc-form-grid">
                <div>
                  <label className="form-label">Center latitude</label>
                  <input
                    className="input-field"
                    value={form.latitude}
                    onChange={(e) => update('latitude', e.target.value)}
                    placeholder="10.3157"
                  />
                </div>
                <div>
                  <label className="form-label">Center longitude</label>
                  <input
                    className="input-field"
                    value={form.longitude}
                    onChange={(e) => update('longitude', e.target.value)}
                    placeholder="123.8854"
                  />
                </div>
                <div>
                  <label className="form-label">Radius (km)</label>
                  <input
                    className="input-field"
                    value={form.radiusKm}
                    onChange={(e) => update('radiusKm', e.target.value)}
                    placeholder="15"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">
                {form.polygonPath ? `${form.polygonPath.length - 1} boundary points.` : 'No boundary drawn yet.'}
              </p>
            )}

            <div>
              <label className="form-label">Boundary map</label>
              <TerritoryMapEditor
                boundaryType={form.boundaryType}
                center={{
                  lat: Number(form.latitude) || DEFAULT_TERRITORY_CENTER.latitude,
                  lng: Number(form.longitude) || DEFAULT_TERRITORY_CENTER.longitude,
                }}
                radiusKm={Number(form.radiusKm) || 1}
                onRadiusChange={(center, radiusKm) => {
                  setForm((f) => ({
                    ...f,
                    latitude: String(center.lat),
                    longitude: String(center.lng),
                    radiusKm: String(radiusKm),
                  }));
                }}
                polygonPath={form.polygonPath}
                onPolygonChange={(path) => update('polygonPath', path)}
              />
            </div>

            <div className="dc-form-grid">
              <div>
                <label className="form-label">Primary contact name</label>
                <input
                  className="input-field"
                  value={form.primaryContactName}
                  onChange={(e) => update('primaryContactName', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Primary contact phone</label>
                <input
                  className="input-field"
                  value={form.primaryContactPhone}
                  onChange={(e) => update('primaryContactPhone', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Ops notes</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.opsNotes}
                onChange={(e) => update('opsNotes', e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : territory ? 'Save territory' : 'Create territory'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function PartnerBrandingDetailPage() {
  const params = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(() => adminFetch<PartnerRecord>(`/admin/partners/${params.id}`), [params.id]);
  const { data: partner, loading, error, setData } = useAdminQuery(load, [params.id]);

  async function saveBranding(update: Partial<PartnerBrandConfig>) {
    if (!partner) return;
    setSaving(true);
    setActionError('');
    setSuccess('');
    try {
      const updated = await adminFetch<PartnerRecord>(`/admin/partners/${partner._id}/branding`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      setData(updated);
      setSuccess('Saved');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!partner) return;
    if (
      partner.isActive &&
      !window.confirm(
        `Deactivate ${partner.legalName}'s brand? Their custom domain will immediately stop resolving to this branding and fall back to the default Lunara app.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const updated = await adminFetch<PartnerRecord>(`/admin/partners/${partner._id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !partner.isActive }),
      });
      setData(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(field: (typeof ASSET_FIELDS)[number]['key'], file: File) {
    if (!partner) return;
    setSaving(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('asset', file);
      const updated = await adminUpload<PartnerRecord>(
        `/admin/partners/${partner._id}/branding/assets/${field}`,
        formData,
      );
      setData(updated);
      setSuccess('Saved');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to upload asset');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !partner) return <p className="text-sm text-muted">Loading…</p>;
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

      {actionError ? <div className="alert-error mb-4" role="alert">{actionError}</div> : null}
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

      <TerritorySection partnerId={partner._id} defaultName={partner.legalName} />

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
