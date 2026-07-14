'use client';

import Link from 'next/link';
import { resolveApiV1BaseUrl } from '@lunara/utils';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, SectionPanel } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import {
  loadAdminSettings,
  saveAdminSettings,
  type AdminAppSettings,
} from '../../lib/admin-settings';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

const DEFAULT_SETTINGS: AdminAppSettings = {
  denseTables: false,
  sosSoundAlerts: true,
};

interface DeliveryFeeSettings {
  deliveryFee: number;
}

interface RiderFeeSettings {
  riderPickupFee: number;
  riderDeliveryFee: number;
}

interface AppVersionSettings {
  customerMinAppVersion: string;
  customerLatestAppVersion: string;
  customerIosStoreUrl: string;
  customerAndroidStoreUrl: string;
  riderMinAppVersion: string;
  riderLatestAppVersion: string;
  riderIosStoreUrl: string;
  riderAndroidStoreUrl: string;
}

interface BranchCoverageRow {
  _id: string;
  code: string;
  name: string;
  city: string;
  province: string;
  serviceRadiusKm: number;
}

function DeliveryFeeSection() {
  const load = useCallback(() => adminFetch<DeliveryFeeSettings>('/admin/settings/delivery-fee'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const [form, setForm] = useState<DeliveryFeeSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError('');
    try {
      await adminFetch('/admin/settings/delivery-fee', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      await reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save delivery fees');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionPanel
      title="Delivery fee"
      description="Flat pickup + delivery fee charged on every order, regardless of address."
    >
      <div className="border-b border-border/60 px-6 py-4 sm:px-8">
        {loading && !form ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {form ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Delivery fee</span>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm text-muted">₱</span>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={form.deliveryFee}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, deliveryFee: Number(e.target.value) } : f))
                  }
                />
              </div>
            </label>
          </div>
        ) : null}
        {saveError ? <p className="mt-3 text-sm text-destructive">{saveError}</p> : null}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={saving || !form}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save delivery fees'}
          </button>
          {saved ? <span className="badge-accent text-xs">Saved</span> : null}
        </div>
      </div>
    </SectionPanel>
  );
}

function RiderFeesSection() {
  const load = useCallback(() => adminFetch<RiderFeeSettings>('/admin/settings/rider-fees'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const [form, setForm] = useState<RiderFeeSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError('');
    try {
      await adminFetch('/admin/settings/rider-fees', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      await reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save rider fees');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionPanel
      title="Rider fees"
      description="Flat fee paid to the rider who completes each leg of an order."
    >
      <div className="border-b border-border/60 px-6 py-4 sm:px-8">
        {loading && !form ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {form ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Pickup fee</span>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm text-muted">₱</span>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={form.riderPickupFee}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, riderPickupFee: Number(e.target.value) } : f))
                  }
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Delivery fee</span>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm text-muted">₱</span>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={form.riderDeliveryFee}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, riderDeliveryFee: Number(e.target.value) } : f))
                  }
                />
              </div>
            </label>
          </div>
        ) : null}
        {saveError ? <p className="mt-3 text-sm text-destructive">{saveError}</p> : null}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={saving || !form}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save rider fees'}
          </button>
          {saved ? <span className="badge-accent text-xs">Saved</span> : null}
        </div>
      </div>
    </SectionPanel>
  );
}

function AppVersionSection() {
  const load = useCallback(() => adminFetch<AppVersionSettings>('/admin/settings/app-version'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const [form, setForm] = useState<AppVersionSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError('');
    try {
      await adminFetch('/admin/settings/app-version', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      await reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save app version settings');
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof AppVersionSettings, label: string, placeholder: string) {
    return (
      <label className="block">
        <span className="text-sm font-medium text-slate-900">{label}</span>
        <input
          type="text"
          placeholder={placeholder}
          className="input-field mt-1.5"
          value={form?.[key] ?? ''}
          onChange={(e) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f))}
        />
      </label>
    );
  }

  return (
    <SectionPanel
      title="Mobile app version"
      description="Force customers/riders on outdated app builds to update. Leave minimum version at 0.0.0 to disable enforcement for that app."
    >
      <div className="border-b border-border/60 px-6 py-4 sm:px-8">
        {loading && !form ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {form ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Customer app</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {field('customerMinAppVersion', 'Minimum required version', '0.0.0')}
                {field('customerLatestAppVersion', 'Latest version', '1.1.2')}
                {field('customerIosStoreUrl', 'iOS App Store URL', 'https://apps.apple.com/app/id...')}
                {field('customerAndroidStoreUrl', 'Android Play Store URL', 'https://play.google.com/store/apps/details?id=...')}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rider app</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {field('riderMinAppVersion', 'Minimum required version', '0.0.0')}
                {field('riderLatestAppVersion', 'Latest version', '1.1.2')}
                {field('riderIosStoreUrl', 'iOS App Store URL', 'https://apps.apple.com/app/id...')}
                {field('riderAndroidStoreUrl', 'Android Play Store URL', 'https://play.google.com/store/apps/details?id=...')}
              </div>
            </div>
          </div>
        ) : null}
        {saveError ? <p className="mt-3 text-sm text-destructive">{saveError}</p> : null}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={saving || !form}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save app version settings'}
          </button>
          {saved ? <span className="badge-accent text-xs">Saved</span> : null}
        </div>
      </div>
    </SectionPanel>
  );
}

function ServiceCoverageSection() {
  const load = useCallback(() => adminFetch<BranchCoverageRow[]>('/admin/branches'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState('');

  async function updateRadius(branchId: string, serviceRadiusKm: number) {
    setSavingId(branchId);
    setRowError('');
    try {
      await adminFetch(`/admin/branches/${branchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ serviceRadiusKm }),
      });
      await reload();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update service radius');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SectionPanel
      title="Service coverage"
      description="How far (km) each branch's pickup auto-detection reaches from its location. An address is bookable when it falls within at least one branch's radius."
    >
      <div className="px-6 py-4 sm:px-8">
        {loading && !data ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {rowError ? <p className="mb-3 text-sm text-destructive">{rowError}</p> : null}
        {data && data.length === 0 ? (
          <p className="text-sm text-muted">No branches yet.</p>
        ) : null}
        {data && data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[480px]">
              <caption className="sr-only">Branch service radius</caption>
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col">Location</th>
                  <th scope="col">Radius (km)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <span className="font-medium text-slate-900">{b.name}</span>
                      <p className="text-code text-muted">{b.code}</p>
                    </td>
                    <td className="text-muted">
                      {b.city}, {b.province}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        defaultValue={b.serviceRadiusKm}
                        disabled={savingId === b._id}
                        className="input-field w-24"
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (next > 0 && next !== b.serviceRadiusKm) void updateRadius(b._id, next);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </SectionPanel>
  );
}

function SettingToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 border-b border-border/60 px-6 py-4 last:border-0 sm:px-8"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function EnvField({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60 px-6 py-4 last:border-0 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-900">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminAppSettings | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSettings(loadAdminSettings());

    function onSettingsChange() {
      setSettings(loadAdminSettings());
    }

    window.addEventListener('lunara-admin-settings', onSettingsChange);
    return () => window.removeEventListener('lunara-admin-settings', onSettingsChange);
  }, []);

  function update(patch: Partial<AdminAppSettings>) {
    const next = saveAdminSettings(patch);
    setSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function resetDefaults() {
    update({ ...DEFAULT_SETTINGS });
  }

  async function copyApiUrl() {
    try {
      await navigator.clipboard.writeText(API_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore
    }
  }

  if (settings === undefined) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="App settings" description="Preferences for this browser session." />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="App settings"
        description="Workspace and display preferences stored locally on this device."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {saved ? <span className="badge-accent text-xs">Saved</span> : null}
            <Link href="/profile" className="btn-outline btn-sm">
              Profile
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
        <Card className="lg:sticky lg:top-6">
          <CardBody className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-900">This browser</p>
            <p className="mt-1 text-xs text-muted">Changes apply immediately and sync across admin tabs.</p>
            <div className="mt-4 space-y-2 text-left text-xs">
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted">Compact tables</span>
                <span className={settings.denseTables ? 'badge-accent' : 'badge-neutral'}>
                  {settings.denseTables ? 'On' : 'Off'}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted">SOS sound</span>
                <span className={settings.sosSoundAlerts ? 'badge-accent' : 'badge-neutral'}>
                  {settings.sosSoundAlerts ? 'On' : 'Off'}
                </span>
              </p>
            </div>
            <button type="button" className="btn-outline btn-sm mt-5 w-full" onClick={resetDefaults}>
              Reset defaults
            </button>
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-6">
          <SectionPanel
            title="Display"
            description="How lists and alerts behave in the admin console."
          >
            <SettingToggle
              id="dense-tables"
              label="Compact tables"
              description="Tighter row spacing on datacenter tables and order lists."
              checked={settings.denseTables}
              onChange={(denseTables) => update({ denseTables })}
            />
            <SettingToggle
              id="sos-sound"
              label="SOS alert sound"
              description="Play a short sound when a new rider SOS incident arrives (if the browser allows audio)."
              checked={settings.sosSoundAlerts}
              onChange={(sosSoundAlerts) => update({ sosSoundAlerts })}
            />
          </SectionPanel>

          <DeliveryFeeSection />

          <RiderFeesSection />

          <AppVersionSection />

          <ServiceCoverageSection />

          <SectionPanel
            title="Environment"
            description="Build-time configuration for this admin deployment."
          >
            <EnvField
              label="API base URL"
              value={<span className="text-code break-all">{API_URL}</span>}
              hint="Configured via NEXT_PUBLIC_API_URL at build time. Restart the dev server after changing env files."
              action={
                <button
                  type="button"
                  className="link-primary text-xs font-medium"
                  onClick={() => void copyApiUrl()}
                >
                  {copied ? 'Copied' : 'Copy URL'}
                </button>
              }
            />
            <EnvField label="Application" value="Lunara Admin (web)" />
            <EnvField
              label="Storage"
              value="Local preferences (localStorage)"
              hint="Not synced to your account — each browser keeps its own settings."
            />
          </SectionPanel>

          <Card>
            <CardBody className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Shortcuts</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/profile" className="link-primary">
                    Profile
                  </Link>
                  <span className="text-muted"> — signed-in admin account</span>
                </li>
                <li>
                  <Link href="/control-tower" className="link-primary">
                    Control tower
                  </Link>
                  <span className="text-muted"> — live ops overview</span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
