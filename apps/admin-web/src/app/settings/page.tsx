'use client';

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
      <span>
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

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminAppSettings | null>(null);
  const [saved, setSaved] = useState(false);

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

  if (!settings) {
    return (
      <div>
        <PageHeader title="App settings" description="Preferences for this browser session." />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="App settings"
        description="Workspace and display preferences stored on this device."
        actions={
          saved ? (
            <span className="text-sm font-medium text-emerald-600">Saved</span>
          ) : undefined
        }
      />

      <div className="max-w-2xl space-y-6">
        <SectionPanel title="Display" description="How lists and alerts behave in the admin console.">
          <SettingToggle
            id="dense-tables"
            label="Compact tables"
            description="Use tighter row spacing on order and rider list pages."
            checked={settings.denseTables}
            onChange={(denseTables) => update({ denseTables })}
          />
          <SettingToggle
            id="sos-sound"
            label="SOS alert sound"
            description="Play a short sound when a new rider SOS incident arrives."
            checked={settings.sosSoundAlerts}
            onChange={(sosSoundAlerts) => update({ sosSoundAlerts })}
          />
        </SectionPanel>

        <Card>
          <CardBody className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Environment</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-muted">API base URL</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-800">{API_URL}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted">App</dt>
                <dd className="mt-1 text-slate-800">Lunara Admin (web)</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">
              API URL is configured via <code className="text-slate-700">NEXT_PUBLIC_API_URL</code> at
              build time. Restart the dev server after changing env files.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
