'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../components/auth-loading';
import { PageShell } from '../../../components/page-shell';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import {
  loadCustomerSettings,
  saveCustomerSettings,
  type CustomerAppSettings,
} from '../../../lib/customer-settings';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import type { CustomerProfile, NotificationPreferences } from '../../../lib/profile-types';

function SettingToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
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
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function CustomerSettingsPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [settings, setSettings] = useState<CustomerAppSettings | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setSettings(loadCustomerSettings());

    function onSettingsChange() {
      setSettings(loadCustomerSettings());
    }

    window.addEventListener('lunara-customer-settings', onSettingsChange);
    return () => {
      window.removeEventListener('lunara-customer-settings', onSettingsChange);
      if (savedTimeoutRef.current !== null) {
        window.clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    api
      .get<CustomerProfile>('/customers/me')
      .then((res) =>
        setNotifPrefs(res.data.notificationPreferences ?? { push: true, email: true }),
      )
      .catch(() => setNotifPrefs({ push: true, email: true }));
  }, [ready, api]);

  async function updateNotificationPreferences(patch: Partial<NotificationPreferences>) {
    if (!notifPrefs) return;
    const next = { ...notifPrefs, ...patch };
    setNotifPrefs(next);
    setNotifSaving(true);
    try {
      await api.patch('/customers/me', { notificationPreferences: next });
      setSaved(true);
      if (savedTimeoutRef.current !== null) window.clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = window.setTimeout(() => {
        savedTimeoutRef.current = null;
        setSaved(false);
      }, 2000);
    } catch {
      setNotifPrefs(notifPrefs);
    } finally {
      setNotifSaving(false);
    }
  }

  function update(patch: Partial<CustomerAppSettings>) {
    const next = saveCustomerSettings(patch);
    setSettings(next);
    setSaved(true);
    if (savedTimeoutRef.current !== null) {
      window.clearTimeout(savedTimeoutRef.current);
    }
    savedTimeoutRef.current = window.setTimeout(() => {
      savedTimeoutRef.current = null;
      setSaved(false);
    }, 2000);
  }

  if (isLoading || !ready) {
    return <AuthLoading message="Loading settings…" />;
  }

  if (!settings) {
    return (
      <PageShell>
        <PageHeader title="Settings" description="Your personal preferences." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Settings" description="Your personal preferences." />
      {saved && <p className="-mt-4 text-sm font-medium text-emerald-600">Saved</p>}

      {notifPrefs && (
        <Card className="mt-6 max-w-2xl">
          <CardBody className="p-0">
            <SettingToggle
              id="notif-push"
              label="Push notifications"
              description="Order status updates sent to this device."
              checked={notifPrefs.push}
              disabled={notifSaving}
              onChange={(push) => updateNotificationPreferences({ push })}
            />
            <SettingToggle
              id="notif-email"
              label="Email notifications"
              description="Order confirmation, dispatch, and delivery emails."
              checked={notifPrefs.email}
              disabled={notifSaving}
              onChange={(email) => updateNotificationPreferences({ email })}
            />
          </CardBody>
        </Card>
      )}

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
