'use client';

import Link from 'next/link';
import { resolveApiV1BaseUrl } from '@lunara/utils';
import { useEffect, useState } from 'react';
import { Card, CardBody, SectionPanel } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
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
