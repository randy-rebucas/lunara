'use client';

import { UserRole } from '@lunara/types';
import { PH_REGULAR_HOLIDAYS } from '@lunara/utils';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody, SectionPanel } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { isPartnerRole, partnerFetch, removeShopLogo, uploadShopLogo } from '../../lib/partner-api';
import type {
  BranchHoliday,
  DayOperatingHours,
  OperatingHours,
  PartnerPortalSettings,
  PartnerSettingsData,
} from '@lunara/types';
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

type PayoutMethod = 'gcash' | 'maya' | 'bank' | 'counter';
type Tab = 'shop' | 'hours' | 'machines' | 'preferences' | 'payout';

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank transfer',
  counter: 'Personal / Over the counter',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'shop', label: 'Shop' },
  { id: 'hours', label: 'Hours' },
  { id: 'machines', label: 'Machines' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'payout', label: 'Payout' },
];

// ── Machines ───────────────────────────────────────────────────────────────
interface BranchMachine {
  id: string;
  label: string;
  machineType: string;
  status: string;
  capacityKg: number;
}

const MACHINE_TYPES = ['washer', 'dryer', 'folder', 'press', 'other'] as const;

const MACHINE_TYPE_LABELS: Record<string, string> = {
  washer: 'Washer',
  dryer: 'Dryer',
  folder: 'Folding station',
  press: 'Press / Iron',
  other: 'Other',
};

const MACHINE_STATUSES = ['active', 'maintenance', 'offline'] as const;

const MACHINE_STATUS_META: Record<string, { label: string; badge: string }> = {
  active: { label: 'Active', badge: 'badge-accent' },
  maintenance: { label: 'Maintenance', badge: 'badge-warning' },
  offline: { label: 'Offline', badge: 'badge-neutral' },
};

function MachinesTab({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  const load = useCallback(
    () => partnerFetch<BranchMachine[]>(`/partner/branches/${branchId}/machines`),
    [branchId],
  );
  const { data, loading, error, reload } = usePartnerQuery(load, [branchId]);
  const machines = data ?? [];

  const [busy, setBusy] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', machineType: 'washer', capacityKg: '8' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', machineType: 'washer', capacityKg: '' });

  async function run(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      await reload();
      toast.success(successMessage);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update machines');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.label.trim()) return;
    const ok = await run(
      () =>
        partnerFetch(`/partner/branches/${branchId}/machines`, {
          method: 'POST',
          body: JSON.stringify({
            label: addForm.label.trim(),
            machineType: addForm.machineType,
            capacityKg: Number(addForm.capacityKg) || 8,
          }),
        }),
      'Machine added',
    );
    if (ok) setAddForm({ label: '', machineType: 'washer', capacityKg: '8' });
  }

  function startEdit(m: BranchMachine) {
    setEditingId(m.id);
    setEditForm({ label: m.label, machineType: m.machineType, capacityKg: String(m.capacityKg) });
  }

  async function saveEdit(machineId: string) {
    if (!editForm.label.trim()) return;
    const ok = await run(
      () =>
        partnerFetch(`/partner/branches/${branchId}/machines/${machineId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            label: editForm.label.trim(),
            machineType: editForm.machineType,
            capacityKg: Number(editForm.capacityKg) || undefined,
          }),
        }),
      'Machine updated',
    );
    if (ok) setEditingId(null);
  }

  async function setStatus(m: BranchMachine, status: string) {
    if (status === m.status) return;
    await run(
      () =>
        partnerFetch(`/partner/branches/${branchId}/machines/${m.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
      'Machine status updated',
    );
  }

  async function removeMachine(m: BranchMachine) {
    if (!window.confirm(`Remove ${m.label}? This only affects capacity display — no orders are changed.`)) {
      return;
    }
    await run(
      () =>
        partnerFetch(`/partner/branches/${branchId}/machines/${m.id}`, { method: 'DELETE' }),
      'Machine removed',
    );
  }

  return (
    <SectionPanel
      title="Machines"
      description="Washers, dryers, and stations at your shop. Lunara shows these to dispatch for capacity context; mark machines under maintenance so the team knows."
    >
      <DataPageStatus loading={loading && !data} error={error} loadingMessage="Loading machines…" />

      {data ? (
        <div>
          {machines.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted sm:px-8">
              No machines registered yet{canEdit ? ' — add your first one below.' : '.'}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {machines.map((m) => (
                <li key={m.id} className="px-6 py-4 sm:px-8">
                  {editingId === m.id ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="text-xs font-medium text-slate-600" htmlFor={`edit-label-${m.id}`}>
                          Label
                        </label>
                        <input
                          id={`edit-label-${m.id}`}
                          className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                          value={editForm.label}
                          disabled={busy}
                          onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600" htmlFor={`edit-type-${m.id}`}>
                          Type
                        </label>
                        <select
                          id={`edit-type-${m.id}`}
                          className="mt-1 block rounded-lg border px-3 py-2 text-sm"
                          value={editForm.machineType}
                          disabled={busy}
                          onChange={(e) => setEditForm((f) => ({ ...f, machineType: e.target.value }))}
                        >
                          {MACHINE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {MACHINE_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600" htmlFor={`edit-cap-${m.id}`}>
                          Capacity (kg)
                        </label>
                        <input
                          id={`edit-cap-${m.id}`}
                          type="number"
                          min={1}
                          max={500}
                          className="mt-1 block w-24 rounded-lg border px-3 py-2 text-sm"
                          value={editForm.capacityKg}
                          disabled={busy}
                          onChange={(e) => setEditForm((f) => ({ ...f, capacityKg: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={busy || !editForm.label.trim()}
                          onClick={() => void saveEdit(m.id)}
                        >
                          {busy ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{m.label}</p>
                        <p className="text-xs text-muted">
                          {MACHINE_TYPE_LABELS[m.machineType] ?? m.machineType} · {m.capacityKg} kg
                        </p>
                      </div>
                      {canEdit ? (
                        <select
                          className="rounded-lg border px-2 py-1.5 text-sm"
                          value={m.status}
                          disabled={busy}
                          aria-label={`Status of ${m.label}`}
                          onChange={(e) => void setStatus(m, e.target.value)}
                        >
                          {MACHINE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {MACHINE_STATUS_META[s].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={MACHINE_STATUS_META[m.status]?.badge ?? 'badge-neutral'}>
                          {MACHINE_STATUS_META[m.status]?.label ?? m.status}
                        </span>
                      )}
                      {canEdit ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            disabled={busy}
                            onClick={() => startEdit(m)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm !text-red-600"
                            disabled={busy}
                            onClick={() => void removeMachine(m)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit ? (
            <form
              onSubmit={addMachine}
              className="flex flex-wrap items-end gap-3 border-t border-border/60 px-6 py-4 sm:px-8"
            >
              <div className="min-w-0 flex-1">
                <label className="text-xs font-medium text-slate-600" htmlFor="new-machine-label">
                  Label
                </label>
                <input
                  id="new-machine-label"
                  placeholder="e.g. Washer 3"
                  className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                  value={addForm.label}
                  disabled={busy}
                  maxLength={80}
                  onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600" htmlFor="new-machine-type">
                  Type
                </label>
                <select
                  id="new-machine-type"
                  className="mt-1 block rounded-lg border px-3 py-2 text-sm"
                  value={addForm.machineType}
                  disabled={busy}
                  onChange={(e) => setAddForm((f) => ({ ...f, machineType: e.target.value }))}
                >
                  {MACHINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MACHINE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600" htmlFor="new-machine-capacity">
                  Capacity (kg)
                </label>
                <input
                  id="new-machine-capacity"
                  type="number"
                  min={1}
                  max={500}
                  className="mt-1 block w-24 rounded-lg border px-3 py-2 text-sm"
                  value={addForm.capacityKg}
                  disabled={busy}
                  onChange={(e) => setAddForm((f) => ({ ...f, capacityKg: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary btn-sm" disabled={busy || !addForm.label.trim()}>
                {busy ? 'Adding…' : 'Add machine'}
              </button>
            </form>
          ) : (
            <p className="border-t border-border/60 px-6 py-4 text-sm text-muted sm:px-8">
              Only shop partners can add or update machines.
            </p>
          )}
        </div>
      ) : null}
    </SectionPanel>
  );
}

/** Display order Mon–Sun; each entry's `dayIndex` maps back to `OperatingHours` (JS `Date.getDay()`). */
const WEEKDAY_ROWS: { dayIndex: number; label: string }[] = [
  { dayIndex: 1, label: 'Monday' },
  { dayIndex: 2, label: 'Tuesday' },
  { dayIndex: 3, label: 'Wednesday' },
  { dayIndex: 4, label: 'Thursday' },
  { dayIndex: 5, label: 'Friday' },
  { dayIndex: 6, label: 'Saturday' },
  { dayIndex: 0, label: 'Sunday' },
];

export default function PartnerSettingsPage() {
  const { ready } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });
  const [activeTab, setActiveTab] = useState<Tab>('shop');
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [hoursDraft, setHoursDraft] = useState<OperatingHours | null>(null);
  const [holidaysDraft, setHolidaysDraft] = useState<BranchHoliday[] | null>(null);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [newHolidayRecurring, setNewHolidayRecurring] = useState(false);
  const [payoutDraft, setPayoutDraft] = useState<{
    method: PayoutMethod | '';
    gcashNumber: string;
    mayaNumber: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
  } | null>(null);

  const load = useCallback(() => partnerFetch<PartnerSettingsData>('/partner/settings'), []);
  const { data, loading, error, reload } = usePartnerQuery(load, [ready]);

  async function saveSettings(patch: Partial<PartnerPortalSettings>, successMessage = 'Settings saved') {
    if (!data?.canEdit) return;
    setSaving(true);
    try {
      await partnerFetch<PartnerSettingsData>('/partner/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await reload();
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof PartnerPortalSettings>(key: K, value: PartnerPortalSettings[K]) {
    if (!data) return;
    void saveSettings({ [key]: value });
  }

  useEffect(() => {
    if (data && payoutDraft === null) {
      setPayoutDraft({
        method: (data.settings.payoutMethod as PayoutMethod) ?? '',
        gcashNumber: data.settings.gcashNumber ?? '',
        mayaNumber: data.settings.mayaNumber ?? '',
        bankName: data.settings.bankName ?? '',
        bankAccountName: data.settings.bankAccountName ?? '',
        bankAccountNumber: data.settings.bankAccountNumber ?? '',
      });
    }
  }, [data, payoutDraft]);

  useEffect(() => {
    if (data && hoursDraft === null) {
      setHoursDraft(data.branch.operatingHours);
    }
  }, [data, hoursDraft]);

  useEffect(() => {
    if (data && holidaysDraft === null) {
      setHolidaysDraft(data.branch.holidays);
    }
  }, [data, holidaysDraft]);

  function updateHoursDraftDay(dayIndex: number, patch: Partial<DayOperatingHours>) {
    setHoursDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[dayIndex] = { ...next[dayIndex], ...patch };
      return next;
    });
  }

  async function saveHours() {
    if (!hoursDraft) return;
    setSaving(true);
    try {
      await partnerFetch<PartnerSettingsData>('/partner/settings', {
        method: 'PATCH',
        body: JSON.stringify({ operatingHours: hoursDraft }),
      });
      await reload();
      toast.success('Operating hours saved');
      setHoursDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save operating hours');
    } finally {
      setSaving(false);
    }
  }

  async function saveHolidays(next: BranchHoliday[]) {
    setSaving(true);
    try {
      await partnerFetch<PartnerSettingsData>('/partner/settings', {
        method: 'PATCH',
        body: JSON.stringify({ holidays: next }),
      });
      await reload();
      toast.success('Holidays saved');
      setHolidaysDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save holidays');
    } finally {
      setSaving(false);
    }
  }

  function addHoliday() {
    if (!newHolidayDate || !holidaysDraft) return;
    // Recurring holidays are stored as "MM-DD"; the date input still supplies a full YYYY-MM-DD.
    const date = newHolidayRecurring ? newHolidayDate.slice(5) : newHolidayDate;
    if (holidaysDraft.some((h) => h.date === date && Boolean(h.recurring) === newHolidayRecurring)) return;
    const next = [
      ...holidaysDraft,
      { date, label: newHolidayLabel.trim() || undefined, recurring: newHolidayRecurring || undefined },
    ].sort((a, b) => a.date.localeCompare(b.date));
    setHolidaysDraft(next);
    setNewHolidayDate('');
    setNewHolidayLabel('');
    setNewHolidayRecurring(false);
    void saveHolidays(next);
  }

  function removeHoliday(date: string, recurring?: boolean) {
    if (!holidaysDraft) return;
    const next = holidaysDraft.filter((h) => !(h.date === date && Boolean(h.recurring) === Boolean(recurring)));
    setHolidaysDraft(next);
    void saveHolidays(next);
  }

  /** Forces the branch open on a specific occurrence of a built-in national holiday, overriding it. */
  function addOpenOverride(monthDay: string, label: string, year: number) {
    if (!holidaysDraft) return;
    const date = `${year}-${monthDay}`;
    if (holidaysDraft.some((h) => h.date === date && h.type === 'open')) return;
    const next = [...holidaysDraft, { date, label, type: 'open' as const }].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    setHolidaysDraft(next);
    void saveHolidays(next);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !data?.canEdit) return;
    setLogoBusy(true);
    try {
      await uploadShopLogo(file);
      await reload();
      toast.success('Logo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload logo');
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    if (!data?.canEdit) return;
    setLogoBusy(true);
    try {
      await removeShopLogo();
      await reload();
      toast.success('Logo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove logo');
    } finally {
      setLogoBusy(false);
    }
  }

  async function savePayoutMethod() {
    if (!payoutDraft?.method) return;
    const patch: Partial<PartnerPortalSettings> = { payoutMethod: payoutDraft.method };
    if (payoutDraft.method === 'gcash') patch.gcashNumber = payoutDraft.gcashNumber;
    if (payoutDraft.method === 'maya') patch.mayaNumber = payoutDraft.mayaNumber;
    if (payoutDraft.method === 'bank') {
      patch.bankName = payoutDraft.bankName;
      patch.bankAccountName = payoutDraft.bankAccountName;
      patch.bankAccountNumber = payoutDraft.bankAccountNumber;
    }
    await saveSettings(patch, 'Payout method saved');
    setPayoutDraft(null);
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
        actions={saving ? <span className="text-sm text-muted">Saving…</span> : undefined}
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading shop settings…" />

      {branch && settings ? (
        <div className="mt-6 max-w-2xl">
          {/* Tab bar */}
          <div className="flex gap-1 rounded-xl border border-border bg-slate-50 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-muted hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-6">
            {/* Shop tab */}
            {activeTab === 'shop' && (
              <Card>
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-slate-50">
                      {branch.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branch.logoUrl} alt={`${branch.name} logo`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted">No logo</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">{branch.name}</h3>
                      <p className="mt-1 font-mono text-xs text-primary">{branch.code}</p>
                      <p className="mt-2 text-sm text-muted">
                        {branch.line1}, {branch.city}, {branch.province}
                      </p>
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4">
                      <label className={`btn-outline btn-sm cursor-pointer ${logoBusy ? 'pointer-events-none opacity-60' : ''}`}>
                        {logoBusy ? 'Uploading…' : branch.logoUrl ? 'Change logo' : 'Upload logo'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={logoBusy}
                          onChange={handleLogoChange}
                        />
                      </label>
                      {branch.logoUrl ? (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          disabled={logoBusy}
                          onClick={() => void handleLogoRemove()}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ) : null}

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
            )}

            {/* Hours tab */}
            {activeTab === 'hours' && (
              <SectionPanel
                title="Operating hours"
                description="Customers can only book pickup times while at least one shop is open. Closed days won't offer any pickup slots for that day."
              >
                {hoursDraft ? (
                  <div className="divide-y divide-border/60 px-6 py-2 sm:px-8">
                    <div className="flex items-center gap-1.5 pb-3 pt-2 text-xs font-medium text-muted">
                      <span aria-hidden="true">🕒</span>
                      All times are Philippine Time (Asia/Manila, UTC+8)
                    </div>
                    {WEEKDAY_ROWS.map(({ dayIndex, label }) => {
                      const day = hoursDraft[dayIndex];
                      return (
                        <div key={dayIndex} className="flex flex-wrap items-center gap-3 py-3">
                          <span className="w-28 shrink-0 text-sm font-medium text-slate-900">{label}</span>
                          <label className="flex items-center gap-2 text-sm text-muted">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                              checked={!day.isClosed}
                              disabled={!canEdit || saving}
                              onChange={(e) => updateHoursDraftDay(dayIndex, { isClosed: !e.target.checked })}
                            />
                            Open
                          </label>
                          {!day.isClosed ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                className="rounded-lg border px-2 py-1 text-sm"
                                value={day.openTime}
                                disabled={!canEdit || saving}
                                onChange={(e) => updateHoursDraftDay(dayIndex, { openTime: e.target.value })}
                              />
                              <span className="text-sm text-muted">to</span>
                              <input
                                type="time"
                                className="rounded-lg border px-2 py-1 text-sm"
                                value={day.closeTime}
                                disabled={!canEdit || saving}
                                onChange={(e) => updateHoursDraftDay(dayIndex, { closeTime: e.target.value })}
                              />
                            </div>
                          ) : (
                            <span className="text-sm text-muted">Closed</span>
                          )}
                        </div>
                      );
                    })}
                    {canEdit ? (
                      <div className="pb-2 pt-4">
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={saving}
                          onClick={() => void saveHours()}
                        >
                          {saving ? 'Saving…' : 'Save hours'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </SectionPanel>
            )}

            {/* Holidays sub-section of Hours tab */}
            {activeTab === 'hours' && branch && (
              <SectionPanel
                title="Holidays"
                description={
                  branch.isMainShop
                    ? 'One-off closed dates, on top of your weekly hours. These apply to every branch under your account unless a branch sets its own.'
                    : branch.holidaysInherited
                      ? "Inherited from your main shop's holiday calendar. Add a date here to override it for this branch only."
                      : 'This branch has its own holiday calendar, overriding the main shop.'
                }
              >
                <div className="px-6 py-4 sm:px-8">
                  {holidaysDraft && holidaysDraft.length > 0 ? (
                    <ul className="divide-y divide-border/60">
                      {holidaysDraft.map((h) => (
                        <li key={`${h.date}-${h.recurring ? 'r' : 'o'}-${h.type ?? 'closed'}`} className="flex items-center justify-between py-2">
                          <span className="text-sm text-slate-900">
                            {h.date}
                            {h.label ? <span className="ml-2 text-muted">— {h.label}</span> : null}
                            {h.recurring ? (
                              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                Repeats yearly
                              </span>
                            ) : null}
                            {h.type === 'open' ? (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                Open (override)
                              </span>
                            ) : null}
                          </span>
                          {canEdit ? (
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              disabled={saving}
                              onClick={() => removeHoliday(h.date, h.recurring)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No holidays set.</p>
                  )}

                  {canEdit ? (
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="form-label">Date</label>
                        <input
                          type="date"
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={newHolidayDate}
                          disabled={saving}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Label (optional)</label>
                        <input
                          type="text"
                          className="rounded-lg border px-2 py-1 text-sm"
                          placeholder="e.g. New Year's Day"
                          value={newHolidayLabel}
                          disabled={saving}
                          onChange={(e) => setNewHolidayLabel(e.target.value)}
                        />
                      </div>
                      <label className="flex items-center gap-2 pb-1.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={newHolidayRecurring}
                          disabled={saving}
                          onChange={(e) => setNewHolidayRecurring(e.target.checked)}
                        />
                        Repeats every year
                      </label>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={saving || !newHolidayDate}
                        onClick={addHoliday}
                      >
                        Add holiday
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t border-border/60 pt-4">
                    <p className="text-sm font-medium text-slate-900">Philippine regular holidays</p>
                    <p className="mt-1 text-xs text-muted">
                      Built in and closed by default every year. Override one open for this branch if you'll be
                      operating on that date.
                    </p>
                    <ul className="mt-2 divide-y divide-border/60">
                      {PH_REGULAR_HOLIDAYS.map((h) => {
                        const year = new Date().getFullYear();
                        const overridden = holidaysDraft?.some(
                          (d) => d.date === `${year}-${h.date}` && d.type === 'open',
                        );
                        return (
                          <li key={h.date} className="flex items-center justify-between py-2">
                            <span className="text-sm text-slate-900">
                              {h.date} — {h.label}
                              {overridden ? (
                                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                  Open this year
                                </span>
                              ) : null}
                            </span>
                            {canEdit && !overridden ? (
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                disabled={saving}
                                onClick={() => addOpenOverride(h.date, h.label ?? '', year)}
                              >
                                Stay open this year
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </SectionPanel>
            )}

            {/* Machines tab */}
            {activeTab === 'machines' && (
              <MachinesTab branchId={branch.id} canEdit={canEdit} />
            )}

            {/* Preferences tab */}
            {activeTab === 'preferences' && (
              <>
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
                  <SettingToggle
                    id="inventory-enabled"
                    label="Inventory tracking"
                    description="Enable supply inventory tracking (detergent, bags, etc.). Turn off if your shop does not manage stock."
                    checked={settings.inventoryEnabled}
                    disabled={!canEdit || saving}
                    onChange={(v) => updateSetting('inventoryEnabled', v)}
                  />
                </SectionPanel>

                {!canEdit ? (
                  <p className="text-sm text-muted">
                    Only shop partners can change these settings. Your branch manager can update them from a
                    partner account.
                  </p>
                ) : null}
              </>
            )}

            {/* Payout tab */}
            {activeTab === 'payout' && (
              <>
                {canEdit && payoutDraft !== null ? (
                  <SectionPanel
                    title="Payout method"
                    description="Choose how Lunara sends your settlement payout every Saturday."
                  >
                    <div className="space-y-3 px-6 py-4 sm:px-8">
                      {(['gcash', 'maya', 'bank', 'counter'] as PayoutMethod[]).map((m) => (
                        <label key={m} className="flex cursor-pointer items-center gap-3">
                          <input
                            type="radio"
                            name="payoutMethod"
                            value={m}
                            checked={payoutDraft.method === m}
                            disabled={saving}
                            className="h-4 w-4 text-primary focus:ring-primary/30"
                            onChange={() => setPayoutDraft((d) => d && { ...d, method: m })}
                          />
                          <span className="text-sm font-medium text-slate-900">{PAYOUT_METHOD_LABELS[m]}</span>
                        </label>
                      ))}

                      {payoutDraft.method === 'gcash' && (
                        <div className="mt-3 pl-7">
                          <label className="text-xs font-medium text-slate-600">GCash number</label>
                          <input
                            type="tel"
                            placeholder="09XXXXXXXXX"
                            className="mt-1 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
                            value={payoutDraft.gcashNumber}
                            disabled={saving}
                            onChange={(e) => setPayoutDraft((d) => d && { ...d, gcashNumber: e.target.value })}
                          />
                        </div>
                      )}

                      {payoutDraft.method === 'maya' && (
                        <div className="mt-3 pl-7">
                          <label className="text-xs font-medium text-slate-600">Maya number</label>
                          <input
                            type="tel"
                            placeholder="09XXXXXXXXX"
                            className="mt-1 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
                            value={payoutDraft.mayaNumber}
                            disabled={saving}
                            onChange={(e) => setPayoutDraft((d) => d && { ...d, mayaNumber: e.target.value })}
                          />
                        </div>
                      )}

                      {payoutDraft.method === 'bank' && (
                        <div className="mt-3 space-y-3 pl-7">
                          <div>
                            <label className="text-xs font-medium text-slate-600">Bank name</label>
                            <input
                              type="text"
                              placeholder="e.g. BDO, BPI, UnionBank"
                              className="mt-1 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
                              value={payoutDraft.bankName}
                              disabled={saving}
                              onChange={(e) => setPayoutDraft((d) => d && { ...d, bankName: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Account name</label>
                            <input
                              type="text"
                              placeholder="Full name on account"
                              className="mt-1 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
                              value={payoutDraft.bankAccountName}
                              disabled={saving}
                              onChange={(e) => setPayoutDraft((d) => d && { ...d, bankAccountName: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Account number</label>
                            <input
                              type="text"
                              placeholder="Account number"
                              className="mt-1 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
                              value={payoutDraft.bankAccountNumber}
                              disabled={saving}
                              onChange={(e) => setPayoutDraft((d) => d && { ...d, bankAccountNumber: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {payoutDraft.method === 'counter' && (
                        <p className="mt-2 pl-7 text-sm text-muted">
                          Lunara will coordinate with you directly for over-the-counter payout.
                        </p>
                      )}

                      {payoutDraft.method && (
                        <div className="mt-4 pl-7">
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={saving}
                            onClick={() => void savePayoutMethod()}
                          >
                            {saving ? 'Saving…' : 'Save payout method'}
                          </button>
                        </div>
                      )}
                    </div>
                  </SectionPanel>
                ) : (
                  <p className="text-sm text-muted">
                    Only shop partners can configure the payout method.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
