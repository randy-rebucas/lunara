'use client';

import { UserRole } from '@lunara/types';
import { useCallback, useState } from 'react';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody, SectionPanel } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { isPartnerRole, partnerFetch } from '../../lib/partner-api';
import type { PartnerPortalSettings, PartnerSettingsData } from '@lunara/types';
import { usePartnerQuery } from '../../lib/use-partner-query';

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
      className={`flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4 last:border-0 sm:px-8 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/30 disabled:cursor-not-allowed"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

export default function PartnerSettingsPage() {
  const { ready } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => partnerFetch<PartnerSettingsData>('/partner/settings'), []);
  const { data, loading, error, reload } = usePartnerQuery(load, [ready]);

  async function saveSettings(patch: Partial<PartnerPortalSettings>) {
    if (!data?.canEdit) return;
    setSaveError('');
    setSaving(true);
    try {
      await partnerFetch<PartnerSettingsData>('/partner/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await reload();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof PartnerPortalSettings>(key: K, value: PartnerPortalSettings[K]) {
    if (!data) return;
    void saveSettings({ [key]: value });
  }

  if (!ready) return <AuthLoading message="Loading shop settings…" />;

  const partner = isPartnerRole();
  const settings = data?.settings;
  const branch = data?.branch;
  const canEdit = data?.canEdit ?? false;

  return (
    <div>
      <PageHeader
        title="Shop settings"
        description={
          canEdit
            ? 'Configure how your laundry shop accepts orders, notifies staff, and runs receiving.'
            : 'View your branch configuration. Contact your shop partner to make changes.'
        }
        actions={
          saved ? (
            <span className="text-sm font-medium text-emerald-600">Saved</span>
          ) : saving ? (
            <span className="text-sm text-muted">Saving…</span>
          ) : undefined
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading shop settings…" />

      {saveError ? <p className="mb-4 text-sm text-red-600">{saveError}</p> : null}

      {branch && settings ? (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-slate-900">{branch.name}</h3>
              <p className="mt-1 font-mono text-xs text-primary">{branch.code}</p>
              <p className="mt-2 text-sm text-muted">
                {branch.line1}, {branch.city}, {branch.province}
              </p>
              <dl className="mt-6">
                <DetailRow
                  label="Platform status"
                  value={
                    branch.isActive ? (
                      <span className="text-emerald-600">Active on Lunara</span>
                    ) : (
                      <span className="text-amber-700">Inactive (contact support)</span>
                    )
                  }
                />
                <DetailRow
                  label="Capacity"
                  value={`${branch.maxActiveOrders} active orders · ${branch.maxWeightCapacityKg} kg`}
                />
                <DetailRow
                  label="Daily quota"
                  value={`${branch.dailyQuotaOrders} orders · ${branch.dailyQuotaWeightKg} kg`}
                />
                <DetailRow label="Service radius" value={`${branch.serviceRadiusKm} km`} />
              </dl>
            </CardBody>
          </Card>

          <SectionPanel
            title="Order intake"
            description="Control whether your shop receives and accepts new work."
          >
            <SettingToggle
              id="accepting-orders"
              label="Accepting new orders"
              description="When off, dispatch should not assign new customer orders to your shop."
              checked={settings.acceptingOrders}
              disabled={!canEdit || saving}
              onChange={(v) => updateSetting('acceptingOrders', v)}
            />
            {partner ? (
              <SettingToggle
                id="auto-accept"
                label="Auto-accept incoming orders"
                description="Automatically accept shop-assigned orders without tapping Accept on each one."
                checked={settings.autoAcceptIncoming}
                disabled={!canEdit || saving}
                onChange={(v) => updateSetting('autoAcceptIncoming', v)}
              />
            ) : null}
          </SectionPanel>

          <SectionPanel
            title="Notifications"
            description="Choose which events create in-portal alerts for your team."
          >
            <SettingToggle
              id="notify-new"
              label="New orders"
              description="Alert when a new booking is assigned or ready for your shop."
              checked={settings.notifyNewOrders}
              disabled={!canEdit || saving}
              onChange={(v) => updateSetting('notifyNewOrders', v)}
            />
            <SettingToggle
              id="notify-pickup"
              label="Pickup in transit"
              description="Alert when a rider is bringing laundry to your shop."
              checked={settings.notifyPickupArriving}
              disabled={!canEdit || saving}
              onChange={(v) => updateSetting('notifyPickupArriving', v)}
            />
            <SettingToggle
              id="notify-ready"
              label="Ready for delivery"
              description="Alert when processed orders are ready for customer delivery."
              checked={settings.notifyReadyForDelivery}
              disabled={!canEdit || saving}
              onChange={(v) => updateSetting('notifyReadyForDelivery', v)}
            />
            <SettingToggle
              id="notify-stock"
              label="Low inventory"
              description="Alert when supply items fall below their restock threshold."
              checked={settings.notifyLowStock}
              disabled={!canEdit || saving}
              onChange={(v) => updateSetting('notifyLowStock', v)}
            />
          </SectionPanel>

          <SectionPanel
            title="Operations"
            description="Workflow rules for staff and shop receiving."
          >
            <SettingToggle
              id="staff-delivery"
              label="Staff can request delivery"
              description="Allow staff accounts to request a rider for customer delivery."
              checked={settings.allowStaffToRequestDelivery}
              disabled={!canEdit || saving}
              onChange={(v) => updateSetting('allowStaffToRequestDelivery', v)}
            />
            <SettingToggle
              id="weight-verify"
              label="Require weight verification on receive"
              description="Staff must verify weight during shop receiving before continuing."
              checked={settings.requireWeightVerificationOnReceive}
              disabled={!canEdit || saving}
              onChange={(v) => updateSetting('requireWeightVerificationOnReceive', v)}
            />
          </SectionPanel>

          {!canEdit ? (
            <p className="text-sm text-muted">
              Only shop partners can change these settings. Your branch manager can update them from a
              partner account.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
