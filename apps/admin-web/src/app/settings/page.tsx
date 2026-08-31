'use client';

import Link from 'next/link';
import { resolveApiV1BaseUrl } from '@lunara/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import {
  loadAdminSettings,
  saveAdminSettings,
  type AdminAppSettings,
} from '../../lib/admin-settings';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

// ── Server-side settings shapes ────────────────────────────────────────────
interface DeliveryFeeSettings {
  deliveryFee: number;
  deliveryBaseDistanceKm: number;
  deliveryPerKmRate: number;
  maxDeliveryRadiusKm: number;
}

interface AutomationSettings {
  autoDispatchOrders: boolean;
  autoAssignPickupRider: boolean;
  autoAssignDeliveryRider: boolean;
  autoGenerateInvoices: boolean;
  autoApproveRefunds: boolean;
  autoApproveRefundsThreshold: number;
  autoApproveWithdrawals: boolean;
  autoApproveWithdrawalsThreshold: number;
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

interface CollectionStat {
  collection: string;
  count: number;
}

interface AllSettings {
  deliveryFee: DeliveryFeeSettings;
  automation: AutomationSettings;
  riderFees: RiderFeeSettings;
  appVersion: AppVersionSettings;
  branches: BranchCoverageRow[];
}

// ── Tabs ───────────────────────────────────────────────────────────────────
type TabId = 'general' | 'operations' | 'payments' | 'riders' | 'shops' | 'apps';

function TabIcon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  );
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'general',
    label: 'General',
    icon: <TabIcon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  },
  {
    id: 'operations',
    label: 'Orders & operations',
    icon: <TabIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: <TabIcon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  },
  {
    id: 'riders',
    label: 'Riders',
    icon: <TabIcon d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
  },
  {
    id: 'shops',
    label: 'Laundry shops',
    icon: <TabIcon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  },
  {
    id: 'apps',
    label: 'Mobile apps',
    icon: <TabIcon d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />,
  },
];

// ── Building blocks ────────────────────────────────────────────────────────
function Switch({
  id,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
        aria-hidden
      />
    </button>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  threshold,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  threshold?: { value: number; onChange: (value: number) => void };
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4 last:border-0">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </label>
      <div className="flex shrink-0 items-center gap-3">
        {threshold ? (
          <span className="flex items-center gap-2">
            <span className="text-sm text-muted">Under ₱</span>
            <input
              type="number"
              min={0}
              className="input-field w-24"
              disabled={!checked}
              value={threshold.value}
              onChange={(e) => threshold.onChange(Number(e.target.value))}
              aria-label={`${label} threshold in pesos`}
            />
          </span>
        ) : null}
        <Switch id={id} checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-panel">
      <div className="section-panel-header">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function PesoField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">₱</span>
        <input
          type="number"
          min={0}
          className="input-field pl-7"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

function UnitField({
  label,
  hint,
  unit,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <div className="relative mt-1.5">
        <input
          type="number"
          min={0}
          className="input-field pr-12"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
          {unit}
        </span>
      </div>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

// Matches the backend's UpdateAppVersionSettingsDto pattern — dotted numeric segments only,
// since compareVersions (packages/utils/src/version.ts) silently parses anything else as 0.
const VERSION_PATTERN = /^\d+(\.\d+)*$/;

function TextField({
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        className={`input-field mt-1.5 ${error ? 'ring-1 ring-red-400' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function HealthRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <li className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden />
        {detail ?? (ok ? 'Online' : 'Unreachable')}
      </span>
    </li>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const [tab, setTab] = useState<TabId>('general');

  // Deep-link support: /settings#riders
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as TabId;
    if (TABS.some((t) => t.id === hash)) setTab(hash);
  }, []);

  function selectTab(next: TabId) {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  }

  // Server settings — loaded together, edited locally, saved per dirty slice.
  const load = useCallback(async (): Promise<AllSettings> => {
    const [deliveryFee, automation, riderFees, appVersion, branches] = await Promise.all([
      adminFetch<DeliveryFeeSettings>('/admin/settings/delivery-fee'),
      adminFetch<AutomationSettings>('/admin/settings/automation'),
      adminFetch<RiderFeeSettings>('/admin/settings/rider-fees'),
      adminFetch<AppVersionSettings>('/admin/settings/app-version'),
      adminFetch<BranchCoverageRow[]>('/admin/branches'),
    ]);
    return { deliveryFee, automation, riderFees, appVersion, branches };
  }, []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeeSettings | null>(null);
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [riderFees, setRiderFees] = useState<RiderFeeSettings | null>(null);
  const [appVersion, setAppVersion] = useState<AppVersionSettings | null>(null);

  useEffect(() => {
    if (!data) return;
    setDeliveryFee(data.deliveryFee);
    setAutomation(data.automation);
    setRiderFees(data.riderFees);
    setAppVersion(data.appVersion);
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return { any: false, deliveryFee: false, automation: false, riderFees: false, appVersion: false };
    const d = {
      deliveryFee: JSON.stringify(deliveryFee) !== JSON.stringify(data.deliveryFee),
      automation: JSON.stringify(automation) !== JSON.stringify(data.automation),
      riderFees: JSON.stringify(riderFees) !== JSON.stringify(data.riderFees),
      appVersion: JSON.stringify(appVersion) !== JSON.stringify(data.appVersion),
    };
    return { ...d, any: d.deliveryFee || d.automation || d.riderFees || d.appVersion };
  }, [data, deliveryFee, automation, riderFees, appVersion]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const appVersionValid = !appVersion || [
    appVersion.customerMinAppVersion,
    appVersion.customerLatestAppVersion,
    appVersion.riderMinAppVersion,
    appVersion.riderLatestAppVersion,
  ].every((v) => VERSION_PATTERN.test(v));

  async function saveAll() {
    if (!dirty.any || !appVersionValid) return;
    setSaving(true);
    setSaveError('');
    try {
      const patches: Promise<unknown>[] = [];
      if (dirty.deliveryFee && deliveryFee) {
        patches.push(adminFetch('/admin/settings/delivery-fee', { method: 'PATCH', body: JSON.stringify(deliveryFee) }));
      }
      if (dirty.automation && automation) {
        patches.push(adminFetch('/admin/settings/automation', { method: 'PATCH', body: JSON.stringify(automation) }));
      }
      if (dirty.riderFees && riderFees) {
        patches.push(adminFetch('/admin/settings/rider-fees', { method: 'PATCH', body: JSON.stringify(riderFees) }));
      }
      if (dirty.appVersion && appVersion) {
        patches.push(adminFetch('/admin/settings/app-version', { method: 'PATCH', body: JSON.stringify(appVersion) }));
      }
      await Promise.all(patches);
      await reload();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // Branch coverage — row-level save on blur (independent of global Save)
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [branchError, setBranchError] = useState('');

  async function updateRadius(branchId: string, serviceRadiusKm: number) {
    setSavingBranchId(branchId);
    setBranchError('');
    try {
      await adminFetch(`/admin/branches/${branchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ serviceRadiusKm }),
      });
      await reload();
    } catch (e) {
      setBranchError(e instanceof Error ? e.message : 'Failed to update service radius');
    } finally {
      setSavingBranchId(null);
    }
  }

  // Local (browser) preferences — saved instantly, not part of global Save
  const [localPrefs, setLocalPrefs] = useState<AdminAppSettings | undefined>(undefined);
  useEffect(() => {
    setLocalPrefs(loadAdminSettings());
    function onSettingsChange() {
      setLocalPrefs(loadAdminSettings());
    }
    window.addEventListener('lunara-admin-settings', onSettingsChange);
    return () => window.removeEventListener('lunara-admin-settings', onSettingsChange);
  }, []);

  function updateLocal(patch: Partial<AdminAppSettings>) {
    setLocalPrefs(saveAdminSettings(patch));
  }

  // System health (right rail) — real signals only
  const healthLoad = useCallback(() => adminFetch<CollectionStat[]>('/admin/maintenance/status'), []);
  const health = useAdminQuery(healthLoad, []);
  const totalDocs = health.data?.reduce((s, r) => s + r.count, 0) ?? 0;
  const [socketLive, setSocketLive] = useState(false);
  useEffect(() => {
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, []);

  const automationsOn = automation
    ? [
        automation.autoDispatchOrders,
        automation.autoAssignPickupRider,
        automation.autoAssignDeliveryRider,
        automation.autoGenerateInvoices,
        automation.autoApproveRefunds,
        automation.autoApproveWithdrawals,
      ].filter(Boolean).length
    : 0;

  const [copied, setCopied] = useState(false);
  async function copyApiUrl() {
    try {
      await navigator.clipboard.writeText(API_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore
    }
  }

  return (
    <div>
      <PageHeader
        title="System settings"
        description="Platform configuration, pricing, automation, and workspace preferences."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {saved ? <span className="badge-accent text-xs">Saved</span> : null}
            {dirty.any && !saved ? <span className="badge-warning text-xs">Unsaved changes</span> : null}
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={saving || !dirty.any || !appVersionValid}
              onClick={() => void saveAll()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      />

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}
      {saveError ? (
        <div className="alert-error mb-4" role="alert">
          {saveError}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading settings…
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
          <div className="min-w-0">
            {/* Tab bar */}
            <div className="mb-5 overflow-x-auto overflow-y-hidden border-b border-border/60" role="tablist" aria-label="Settings sections">
              <div className="flex min-w-max gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => selectTab(t.id)}
                    className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      tab === t.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted hover:text-slate-900'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── General ── */}
            {tab === 'general' ? (
              <div className="space-y-5">
                <SettingsCard
                  title="Workspace preferences"
                  description="Stored locally in this browser and applied immediately — not part of Save changes."
                >
                  {localPrefs ? (
                    <>
                      <div className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
                        <label htmlFor="pref-dense" className="min-w-0 flex-1 cursor-pointer">
                          <span className="block text-sm font-medium text-slate-900">Compact tables</span>
                          <span className="mt-0.5 block text-sm text-muted">
                            Tighter row spacing on datacenter tables and order lists.
                          </span>
                        </label>
                        <Switch
                          id="pref-dense"
                          checked={localPrefs.denseTables}
                          onChange={(denseTables) => updateLocal({ denseTables })}
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 px-5 py-4">
                        <label htmlFor="pref-sos" className="min-w-0 flex-1 cursor-pointer">
                          <span className="block text-sm font-medium text-slate-900">SOS alert sound</span>
                          <span className="mt-0.5 block text-sm text-muted">
                            Play a short sound when a new rider SOS incident arrives (if the browser allows audio).
                          </span>
                        </label>
                        <Switch
                          id="pref-sos"
                          checked={localPrefs.sosSoundAlerts}
                          onChange={(sosSoundAlerts) => updateLocal({ sosSoundAlerts })}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="px-5 py-4 text-sm text-muted">Loading…</p>
                  )}
                </SettingsCard>

                <SettingsCard title="Environment" description="Build-time configuration for this admin deployment.">
                  <div className="border-b border-border/60 px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">API base URL</p>
                    <p className="text-code mt-1.5 break-all text-slate-900">{API_URL}</p>
                    <p className="mt-1 text-xs text-muted">
                      Configured via NEXT_PUBLIC_API_URL at build time. Restart the dev server after changing env files.
                    </p>
                    <button
                      type="button"
                      className="link-primary mt-2 text-xs font-medium"
                      onClick={() => void copyApiUrl()}
                    >
                      {copied ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Application</p>
                    <p className="mt-1.5 text-sm text-slate-900">Lunara Admin (web)</p>
                  </div>
                </SettingsCard>
              </div>
            ) : null}

            {/* ── Orders & operations ── */}
            {tab === 'operations' && deliveryFee && automation ? (
              <div className="space-y-5">
                <SettingsCard
                  title="Order pricing"
                  description="Pickup + delivery fee = base fee + (distance beyond the base allowance x per-km rate)."
                >
                  <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
                    <PesoField
                      label="Base delivery fee"
                      hint="Covers the base distance allowance below."
                      value={deliveryFee.deliveryFee}
                      onChange={(v) => setDeliveryFee({ ...deliveryFee, deliveryFee: v })}
                    />
                    <UnitField
                      label="Base distance"
                      unit="km"
                      hint="Distance covered by the base fee before per-km charges apply."
                      value={deliveryFee.deliveryBaseDistanceKm}
                      onChange={(v) => setDeliveryFee({ ...deliveryFee, deliveryBaseDistanceKm: v })}
                    />
                    <UnitField
                      label="Per-km rate"
                      unit="₱/km"
                      hint="Charged per whole km beyond the base distance."
                      value={deliveryFee.deliveryPerKmRate}
                      onChange={(v) => setDeliveryFee({ ...deliveryFee, deliveryPerKmRate: v })}
                    />
                    <UnitField
                      label="Max delivery radius"
                      unit="km"
                      hint="Beyond a shop's own radius but within this, orders need admin approval before dispatch. Beyond this, checkout is blocked."
                      value={deliveryFee.maxDeliveryRadiusKm}
                      onChange={(v) => setDeliveryFee({ ...deliveryFee, maxDeliveryRadiusKm: v })}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Order-flow automation"
                  description="Each automation replaces a manual admin action. Off by default — enable only what you're ready to trust."
                >
                  <ToggleRow
                    id="auto-dispatch"
                    label="Auto-dispatch orders to shops"
                    description="Assign paid orders to the top-ranked partner branch automatically instead of waiting in the dispatch queue."
                    checked={automation.autoDispatchOrders}
                    onChange={(autoDispatchOrders) => setAutomation({ ...automation, autoDispatchOrders })}
                  />
                  <ToggleRow
                    id="auto-pickup-rider"
                    label="Auto-assign pickup riders"
                    description="Confirm the system-suggested pickup rider automatically once the shop accepts the order."
                    checked={automation.autoAssignPickupRider}
                    onChange={(autoAssignPickupRider) => setAutomation({ ...automation, autoAssignPickupRider })}
                  />
                  <ToggleRow
                    id="auto-delivery-rider"
                    label="Auto-assign delivery riders"
                    description="Confirm the system-suggested delivery rider automatically once an order is ready for delivery."
                    checked={automation.autoAssignDeliveryRider}
                    onChange={(autoAssignDeliveryRider) => setAutomation({ ...automation, autoAssignDeliveryRider })}
                  />
                </SettingsCard>
              </div>
            ) : null}

            {/* ── Payments ── */}
            {tab === 'payments' && automation ? (
              <div className="space-y-5">
                <SettingsCard
                  title="Financial automation"
                  description="Invoices, refunds, and rider withdrawals. Amounts over a threshold always go to manual review."
                >
                  <ToggleRow
                    id="auto-invoices"
                    label="Auto-generate partner invoices"
                    description="Run a weekly invoice for every partner branch with uninvoiced completed orders."
                    checked={automation.autoGenerateInvoices}
                    onChange={(autoGenerateInvoices) => setAutomation({ ...automation, autoGenerateInvoices })}
                  />
                  <ToggleRow
                    id="auto-refunds"
                    label="Auto-approve small refunds"
                    description="Approve refund requests with clean evidence automatically when under the threshold."
                    checked={automation.autoApproveRefunds}
                    onChange={(autoApproveRefunds) => setAutomation({ ...automation, autoApproveRefunds })}
                    threshold={{
                      value: automation.autoApproveRefundsThreshold,
                      onChange: (autoApproveRefundsThreshold) =>
                        setAutomation({ ...automation, autoApproveRefundsThreshold }),
                    }}
                  />
                  <ToggleRow
                    id="auto-withdrawals"
                    label="Auto-approve small rider withdrawals"
                    description="Approve rider cash-out requests automatically when under the threshold and wallet/KYC checks out."
                    checked={automation.autoApproveWithdrawals}
                    onChange={(autoApproveWithdrawals) => setAutomation({ ...automation, autoApproveWithdrawals })}
                    threshold={{
                      value: automation.autoApproveWithdrawalsThreshold,
                      onChange: (autoApproveWithdrawalsThreshold) =>
                        setAutomation({ ...automation, autoApproveWithdrawalsThreshold }),
                    }}
                  />
                </SettingsCard>

                <SettingsCard title="Related pages">
                  <ul className="space-y-2 px-5 py-4 text-sm">
                    <li>
                      <Link href="/partners/settlements" className="link-primary">Partner settlements</Link>
                      <span className="text-muted"> — review and release payouts</span>
                    </li>
                    <li>
                      <Link href="/refunds" className="link-primary">Refunds</Link>
                      <span className="text-muted"> — pending refund requests</span>
                    </li>
                  </ul>
                </SettingsCard>
              </div>
            ) : null}

            {/* ── Riders ── */}
            {tab === 'riders' && riderFees ? (
              <div className="space-y-5">
                <SettingsCard
                  title="Rider fees"
                  description="Flat fee paid to the rider who completes each leg of an order."
                >
                  <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                    <PesoField
                      label="Pickup fee"
                      hint="Paid for the customer → shop leg."
                      value={riderFees.riderPickupFee}
                      onChange={(riderPickupFee) => setRiderFees({ ...riderFees, riderPickupFee })}
                    />
                    <PesoField
                      label="Delivery fee"
                      hint="Paid for the shop → customer leg."
                      value={riderFees.riderDeliveryFee}
                      onChange={(riderDeliveryFee) => setRiderFees({ ...riderFees, riderDeliveryFee })}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard title="Related pages">
                  <ul className="space-y-2 px-5 py-4 text-sm">
                    <li>
                      <Link href="/riders" className="link-primary">Riders</Link>
                      <span className="text-muted"> — fleet roster, compliance, wallets</span>
                    </li>
                    <li>
                      <Link href="/dispatch" className="link-primary">Dispatch board</Link>
                      <span className="text-muted"> — assignment queue</span>
                    </li>
                  </ul>
                </SettingsCard>
              </div>
            ) : null}

            {/* ── Laundry shops ── */}
            {tab === 'shops' ? (
              <div className="space-y-5">
                <SettingsCard
                  title="Service coverage"
                  description="How far (km) each branch's pickup auto-detection reaches from its location. An address is bookable when it falls within at least one branch's radius. Changes save on blur."
                >
                  {branchError ? <p className="px-5 pt-3 text-sm text-destructive">{branchError}</p> : null}
                  {data.branches.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-muted">No branches yet.</p>
                  ) : (
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
                          {data.branches.map((b) => (
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
                                  disabled={savingBranchId === b._id}
                                  className="input-field w-24"
                                  aria-label={`Service radius for ${b.name} in kilometers`}
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
                  )}
                </SettingsCard>

                <SettingsCard title="Related pages">
                  <ul className="space-y-2 px-5 py-4 text-sm">
                    <li>
                      <Link href="/branches" className="link-primary">Branches</Link>
                      <span className="text-muted"> — locations, commission rates, addresses</span>
                    </li>
                    <li>
                      <Link href="/partners/branding" className="link-primary">Partner branding</Link>
                      <span className="text-muted"> — white-label colors and logos</span>
                    </li>
                    <li>
                      <Link href="/services" className="link-primary">Services & pricing</Link>
                      <span className="text-muted"> — laundry service catalog</span>
                    </li>
                  </ul>
                </SettingsCard>
              </div>
            ) : null}

            {/* ── Mobile apps ── */}
            {tab === 'apps' && appVersion ? (
              <div className="space-y-5">
                <SettingsCard
                  title="Customer app"
                  description="Force customers on outdated builds to update. Leave minimum version at 0.0.0 to disable enforcement."
                >
                  <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                    <TextField
                      label="Minimum required version"
                      placeholder="0.0.0"
                      value={appVersion.customerMinAppVersion}
                      onChange={(customerMinAppVersion) => setAppVersion({ ...appVersion, customerMinAppVersion })}
                      error={VERSION_PATTERN.test(appVersion.customerMinAppVersion) ? undefined : 'Must be a dotted numeric version, e.g. 1.2.10'}
                    />
                    <TextField
                      label="Latest version"
                      placeholder="1.1.5"
                      value={appVersion.customerLatestAppVersion}
                      onChange={(customerLatestAppVersion) => setAppVersion({ ...appVersion, customerLatestAppVersion })}
                      error={VERSION_PATTERN.test(appVersion.customerLatestAppVersion) ? undefined : 'Must be a dotted numeric version, e.g. 1.2.10'}
                    />
                    <TextField
                      label="iOS App Store URL"
                      placeholder="https://apps.apple.com/app/id..."
                      value={appVersion.customerIosStoreUrl}
                      onChange={(customerIosStoreUrl) => setAppVersion({ ...appVersion, customerIosStoreUrl })}
                    />
                    <TextField
                      label="Android Play Store URL"
                      placeholder="https://play.google.com/store/apps/details?id=..."
                      value={appVersion.customerAndroidStoreUrl}
                      onChange={(customerAndroidStoreUrl) => setAppVersion({ ...appVersion, customerAndroidStoreUrl })}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Rider app"
                  description="Force riders on outdated builds to update. Leave minimum version at 0.0.0 to disable enforcement."
                >
                  <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                    <TextField
                      label="Minimum required version"
                      placeholder="0.0.0"
                      value={appVersion.riderMinAppVersion}
                      onChange={(riderMinAppVersion) => setAppVersion({ ...appVersion, riderMinAppVersion })}
                      error={VERSION_PATTERN.test(appVersion.riderMinAppVersion) ? undefined : 'Must be a dotted numeric version, e.g. 1.2.10'}
                    />
                    <TextField
                      label="Latest version"
                      placeholder="1.1.5"
                      value={appVersion.riderLatestAppVersion}
                      onChange={(riderLatestAppVersion) => setAppVersion({ ...appVersion, riderLatestAppVersion })}
                      error={VERSION_PATTERN.test(appVersion.riderLatestAppVersion) ? undefined : 'Must be a dotted numeric version, e.g. 1.2.10'}
                    />
                    <TextField
                      label="iOS App Store URL"
                      placeholder="https://apps.apple.com/app/id..."
                      value={appVersion.riderIosStoreUrl}
                      onChange={(riderIosStoreUrl) => setAppVersion({ ...appVersion, riderIosStoreUrl })}
                    />
                    <TextField
                      label="Android Play Store URL"
                      placeholder="https://play.google.com/store/apps/details?id=..."
                      value={appVersion.riderAndroidStoreUrl}
                      onChange={(riderAndroidStoreUrl) => setAppVersion({ ...appVersion, riderAndroidStoreUrl })}
                    />
                  </div>
                </SettingsCard>
              </div>
            ) : null}
          </div>

          {/* ── Right rail ── */}
          <div className="space-y-5">
            <section className="section-panel">
              <div className="section-panel-header">
                <h3 className="text-sm font-semibold text-slate-900">Settings summary</h3>
              </div>
              <dl className="divide-y divide-border/40 text-sm">
                <div className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <dt className="text-muted">Delivery fee</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">₱{deliveryFee?.deliveryFee ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <dt className="text-muted">Rider fees (pickup / delivery)</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    ₱{riderFees?.riderPickupFee ?? '—'} / ₱{riderFees?.riderDeliveryFee ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <dt className="text-muted">Automations enabled</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{automationsOn} of 6</dd>
                </div>
                <div className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <dt className="text-muted">Customer app minimum</dt>
                  <dd className="text-code font-semibold text-slate-900">{appVersion?.customerMinAppVersion || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <dt className="text-muted">Rider app minimum</dt>
                  <dd className="text-code font-semibold text-slate-900">{appVersion?.riderMinAppVersion || '—'}</dd>
                </div>
              </dl>
              <div className="border-t border-border/60 px-5 py-3">
                <Link href="/audit-log" className="link-primary text-xs font-medium">
                  View change history →
                </Link>
              </div>
            </section>

            <section className="section-panel">
              <div className="section-panel-header">
                <h3 className="text-sm font-semibold text-slate-900">System health</h3>
              </div>
              <ul className="divide-y divide-border/40">
                <HealthRow label="API server" ok={!error} />
                <HealthRow
                  label="Database"
                  ok={!health.error && !!health.data}
                  detail={
                    health.error
                      ? 'Unreachable'
                      : health.data
                        ? `${totalDocs.toLocaleString()} documents`
                        : 'Checking…'
                  }
                />
                <HealthRow label="Realtime socket" ok={socketLive} detail={socketLive ? 'Connected' : 'Polling'} />
              </ul>
              <div className="border-t border-border/60 px-5 py-3">
                <Link href="/maintenance" className="link-primary text-xs font-medium">
                  Open maintenance tools →
                </Link>
              </div>
            </section>

            <section className="section-panel">
              <div className="section-panel-header">
                <h3 className="text-sm font-semibold text-slate-900">Shortcuts</h3>
              </div>
              <ul className="space-y-2 px-5 py-4 text-sm">
                <li>
                  <Link href="/profile" className="link-primary">Profile</Link>
                  <span className="text-muted"> — signed-in admin account</span>
                </li>
                <li>
                  <Link href="/setup" className="link-primary">Setup wizard</Link>
                  <span className="text-muted"> — first-time network setup</span>
                </li>
                <li>
                  <Link href="/automation-settings" className="link-primary">Automation settings</Link>
                  <span className="text-muted"> — full-page automation view</span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
