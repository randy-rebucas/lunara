'use client';

import { useCallback, useEffect, useState } from 'react';
import { SectionPanel } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface AutomationSettings {
  autoDispatchOrders: boolean;
  autoAssignPickupRider: boolean;
  autoAssignDeliveryRider: boolean;
  autoGenerateSettlements: boolean;
  autoApproveRefunds: boolean;
  autoApproveRefundsThreshold: number;
  autoApproveWithdrawals: boolean;
  autoApproveWithdrawalsThreshold: number;
  weeklyStatsEnabled: boolean;
  weeklyStatsPhone: string;
  weeklyStatsEmail: string;
}

function AutomationToggle({
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
    <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4 last:border-0 sm:px-8">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-start gap-4">
        <span className="min-w-0 flex-1">
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
      {threshold ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-muted">Under ₱</span>
          <input
            type="number"
            min={0}
            className="input-field w-24"
            disabled={!checked}
            value={threshold.value}
            onChange={(e) => threshold.onChange(Number(e.target.value))}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function AutomationSettingsPage() {
  const load = useCallback(
    () => adminFetch<AutomationSettings>('/admin/settings/automation'),
    [],
  );
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const [form, setForm] = useState<AutomationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError('');
    try {
      await adminFetch('/admin/settings/automation', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      await reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save automation settings');
    } finally {
      setSaving(false);
    }
  }

  function patch(fields: Partial<AutomationSettings>) {
    setForm((f) => (f ? { ...f, ...fields } : f));
  }

  async function sendTestNow() {
    setSendingTest(true);
    setTestResult('');
    try {
      await adminFetch('/admin/automation/weekly-stats/send-now', { method: 'POST' });
      setTestResult('Sent — check the phone and inbox configured above.');
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : 'Failed to send test');
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Automation settings"
        description="Each automation below replaces a manual admin action. Off by default — turn on only what you're ready to trust, and switch it back off any time to fall back to manual review."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {saved ? <span className="badge-accent text-xs">Saved</span> : null}
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={saving || !form}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      />

      {loading && !form ? <p className="text-sm text-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saveError ? <p className="mb-3 text-sm text-destructive">{saveError}</p> : null}

      {form ? (
        <div className="space-y-6">
          <SectionPanel title="Order flow" description="Dispatch and rider assignment.">
            <AutomationToggle
              id="auto-dispatch"
              label="Auto-dispatch orders to shops"
              description="Assign paid orders to the top-ranked partner branch automatically instead of waiting in the admin dispatch queue."
              checked={form.autoDispatchOrders}
              onChange={(autoDispatchOrders) => patch({ autoDispatchOrders })}
            />
            <AutomationToggle
              id="auto-pickup-rider"
              label="Auto-assign pickup riders"
              description="Confirm the system-suggested pickup rider automatically once the shop accepts the order."
              checked={form.autoAssignPickupRider}
              onChange={(autoAssignPickupRider) => patch({ autoAssignPickupRider })}
            />
            <AutomationToggle
              id="auto-delivery-rider"
              label="Auto-assign delivery riders"
              description="Confirm the system-suggested delivery rider automatically once an order is ready for delivery."
              checked={form.autoAssignDeliveryRider}
              onChange={(autoAssignDeliveryRider) => patch({ autoAssignDeliveryRider })}
            />
          </SectionPanel>

          <SectionPanel title="Financial" description="Settlements, refunds, and withdrawals.">
            <AutomationToggle
              id="auto-settlements"
              label="Auto-generate partner settlements"
              description="Run a weekly settlement for every partner branch with unsettled completed orders, instead of requiring a manual admin trigger."
              checked={form.autoGenerateSettlements}
              onChange={(autoGenerateSettlements) => patch({ autoGenerateSettlements })}
            />
            <AutomationToggle
              id="auto-refunds"
              label="Auto-approve small refunds"
              description="Approve refund requests automatically when the requested amount is under the threshold. Larger requests still go to manual review."
              checked={form.autoApproveRefunds}
              onChange={(autoApproveRefunds) => patch({ autoApproveRefunds })}
              threshold={{
                value: form.autoApproveRefundsThreshold,
                onChange: (autoApproveRefundsThreshold) => patch({ autoApproveRefundsThreshold }),
              }}
            />
            <AutomationToggle
              id="auto-withdrawals"
              label="Auto-approve small rider withdrawals"
              description="Approve rider cash-out requests automatically when under the threshold and the rider's wallet/KYC checks out."
              checked={form.autoApproveWithdrawals}
              onChange={(autoApproveWithdrawals) => patch({ autoApproveWithdrawals })}
              threshold={{
                value: form.autoApproveWithdrawalsThreshold,
                onChange: (autoApproveWithdrawalsThreshold) =>
                  patch({ autoApproveWithdrawalsThreshold }),
              }}
            />
          </SectionPanel>

          <SectionPanel
            title="Weekly reports"
            description="Send a weekly platform stats summary automatically."
          >
            <AutomationToggle
              id="weekly-stats"
              label="Weekly stats via SMS + email"
              description="Every week, text and email a summary of orders, revenue, new customers, and riders joined to the contacts below."
              checked={form.weeklyStatsEnabled}
              onChange={(weeklyStatsEnabled) => patch({ weeklyStatsEnabled })}
            />
            <div className="flex flex-col gap-3 px-6 py-4 sm:px-8">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-900">SMS phone number</span>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+639171234567"
                  value={form.weeklyStatsPhone}
                  onChange={(e) => patch({ weeklyStatsPhone: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-900">Email address</span>
                <input
                  type="email"
                  className="input-field"
                  placeholder="admin@lunara.app"
                  value={form.weeklyStatsEmail}
                  onChange={(e) => patch({ weeklyStatsEmail: e.target.value })}
                />
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={sendingTest || (!form.weeklyStatsPhone && !form.weeklyStatsEmail)}
                  onClick={() => void sendTestNow()}
                >
                  {sendingTest ? 'Sending…' : 'Send test now'}
                </button>
                {testResult ? <span className="text-sm text-muted">{testResult}</span> : null}
              </div>
            </div>
          </SectionPanel>
        </div>
      ) : null}
    </div>
  );
}
