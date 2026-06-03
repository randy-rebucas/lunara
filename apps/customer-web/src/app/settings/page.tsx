'use client';

import { useEffect, useState } from 'react';
import { AuthLoading } from '../../components/auth-loading';
import { PageShell } from '../../components/page-shell';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import {
  loadCustomerSettings,
  saveCustomerSettings,
  type CustomerAppSettings,
} from '../../lib/customer-settings';
import { useProtectedPage } from '../../hooks/use-protected-page';

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
      className="flex cursor-pointer items-start justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-0"
    >
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
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

export default function CustomerSettingsPage() {
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [settings, setSettings] = useState<CustomerAppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadCustomerSettings());

    function onSettingsChange() {
      setSettings(loadCustomerSettings());
    }

    window.addEventListener('lunara-customer-settings', onSettingsChange);
    return () => window.removeEventListener('lunara-customer-settings', onSettingsChange);
  }, []);

  function update(patch: Partial<CustomerAppSettings>) {
    const next = saveCustomerSettings(patch);
    setSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  if (isLoading || !ready) {
    return <AuthLoading message="Loading settings…" />;
  }

  if (!settings) {
    return (
      <PageShell narrow>
        <PageHeader title="Settings" description="Your personal preferences." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageHeader title="Settings" description="Your personal preferences." />
      {saved && <p className="-mt-4 text-sm font-medium text-emerald-600">Saved</p>}

      <Card className="mt-6 max-w-2xl">
        <CardBody className="p-0">
          <SettingToggle
            id="emphasize-order-updates"
            label="Highlight order updates"
            description="Use stronger status styling on the orders list."
            checked={settings.emphasizeOrderUpdates}
            onChange={(emphasizeOrderUpdates) => update({ emphasizeOrderUpdates })}
          />
          <SettingToggle
            id="branch-distance-hints"
            label="Partner distance hints"
            description="Show nearest laundry shop distances while booking."
            checked={settings.showBranchDistanceHints}
            onChange={(showBranchDistanceHints) => update({ showBranchDistanceHints })}
          />
        </CardBody>
      </Card>
    </PageShell>
  );
}
