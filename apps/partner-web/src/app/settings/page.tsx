'use client';

import { UserRole } from '@lunara/types';
import { PH_REGULAR_HOLIDAYS } from '@lunara/utils';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody, SectionPanel } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import {
  attachPaymentMethod,
  createPaymongoCardPaymentMethod,
  getPaymentMethod,
  isPartnerRole,
  partnerFetch,
  redeemPromoCode,
  removePaymentMethod,
  removeShopLogo,
  uploadShopLogo,
} from '../../lib/partner-api';
import type { PartnerPaymentMethodInfo } from '../../lib/partner-api';
import type {
  BranchHoliday,
  DayOperatingHours,
  OperatingHours,
  PartnerPortalSettings,
  PartnerSettingsData,
  PartnerSubscriptionInfo,
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

type Tab = 'shop' | 'hours' | 'preferences' | 'plan';

const SUBSCRIPTION_PLAN_LABELS: Record<PartnerSubscriptionInfo['subscriptionPlan'], string> = {
  trial: 'Trial',
  basic: 'Basic',
  starter: 'Starter',
  professional: 'Professional',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'shop', label: 'Shop' },
  { id: 'hours', label: 'Hours' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'plan', label: 'Plan' },
];

function formatSubscriptionDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Payment method (auto-charge) ────────────────────────────────────────────
function PaymentMethodPanel({ canEdit }: { canEdit: boolean }) {
  const [info, setInfo] = useState<PartnerPaymentMethodInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isPartnerRole()) return;
    setLoading(true);
    try {
      setInfo(await getPaymentMethod());
    } catch {
      // No subscription yet or endpoint unavailable — treat as "no card on file".
      setInfo({ onFile: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveCard() {
    setSaving(true);
    setError('');
    try {
      const methodId = await createPaymongoCardPaymentMethod({
        cardNumber,
        expMonth: Number(expMonth),
        expYear: Number(expYear),
        cvc,
      });
      await attachPaymentMethod(methodId);
      toast.success('Card saved for auto-charge');
      setShowForm(false);
      setCardNumber('');
      setExpMonth('');
      setExpYear('');
      setCvc('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await removePaymentMethod();
      toast.success('Card removed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove card');
    } finally {
      setSaving(false);
    }
  }

  if (!isPartnerRole()) return null;

  return (
    <div className="border-t border-border/60 px-6 py-4 sm:px-8">
      <p className="text-sm font-medium text-slate-900">Payment method</p>
      <p className="mt-0.5 text-xs text-muted">
        Save a card to have your subscription fee charged automatically each period instead of
        settling it manually via bank transfer/GCash.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : info?.onFile ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-50 px-3 py-2.5">
          <span className="text-sm text-slate-900">
            {info.brand ? `${info.brand.toUpperCase()} ` : ''}•••• {info.last4 ?? '····'}
          </span>
          {canEdit && (
            <button type="button" disabled={saving} className="btn-outline btn-sm" onClick={() => void handleRemove()}>
              {saving ? '…' : 'Remove'}
            </button>
          )}
        </div>
      ) : !canEdit ? (
        <p className="mt-3 text-sm text-muted">No card on file.</p>
      ) : !showForm ? (
        <button type="button" className="btn-outline btn-sm mt-3" onClick={() => setShowForm(true)}>
          + Add card
        </button>
      ) : (
        <div className="mt-3 space-y-2.5 rounded-lg border border-border p-3.5">
          <input
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="Card number"
            className="input-field w-full"
            inputMode="numeric"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={expMonth}
              onChange={(e) => setExpMonth(e.target.value)}
              placeholder="MM"
              className="input-field w-full"
              inputMode="numeric"
            />
            <input
              value={expYear}
              onChange={(e) => setExpYear(e.target.value)}
              placeholder="YYYY"
              className="input-field w-full"
              inputMode="numeric"
            />
            <input
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              placeholder="CVC"
              className="input-field w-full"
              inputMode="numeric"
            />
          </div>
          {error && <div className="alert-error">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !cardNumber || !expMonth || !expYear || !cvc}
              className="btn-primary btn-sm disabled:opacity-50"
              onClick={() => void handleSaveCard()}
            >
              {saving ? 'Saving…' : 'Save card'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Promo code ───────────────────────────────────────────────────────────────
function PromoCodePanel({
  canEdit,
  activeCode,
  freeMonthsRemaining,
  onRedeemed,
}: {
  canEdit: boolean;
  activeCode?: string;
  freeMonthsRemaining?: number;
  onRedeemed: () => void;
}) {
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleRedeem() {
    setSaving(true);
    setError('');
    try {
      await redeemPromoCode(code.trim());
      toast.success('Promo code applied');
      setCode('');
      onRedeemed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem promo code');
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return null;

  return (
    <div className="border-t border-border/60 px-6 py-4 sm:px-8">
      {activeCode ? (
        <p className="text-sm text-slate-900">
          <span className="badge-accent mr-2">{activeCode}</span>
          {freeMonthsRemaining != null
            ? `applied — ${freeMonthsRemaining} free month${freeMonthsRemaining !== 1 ? 's' : ''} remaining`
            : 'applied'}
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-900">Have a promo code?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. FOUNDING6"
              className="input-field w-full max-w-[220px] font-mono"
            />
            <button
              type="button"
              disabled={saving || !code.trim()}
              className="btn-outline btn-sm disabled:opacity-50"
              onClick={() => void handleRedeem()}
            >
              {saving ? 'Applying…' : 'Apply'}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
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

function PartnerSettingsContent() {
  const { ready } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab: Tab = TABS.some((t) => t.id === requestedTab) ? (requestedTab as Tab) : 'shop';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [hoursDraft, setHoursDraft] = useState<OperatingHours | null>(null);
  const [holidaysDraft, setHolidaysDraft] = useState<BranchHoliday[] | null>(null);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [newHolidayRecurring, setNewHolidayRecurring] = useState(false);

  const load = useCallback(() => partnerFetch<PartnerSettingsData>('/partner/settings'), []);
  const { data, loading, error, reload } = usePartnerQuery(load, [ready]);

  const loadSubscription = useCallback(() => {
    if (!isPartnerRole()) return Promise.resolve(null);
    return partnerFetch<PartnerSubscriptionInfo>('/partner/subscription');
  }, []);
  const {
    data: subscription,
    loading: subscriptionLoading,
    error: subscriptionError,
    reload: reloadSubscription,
  } = usePartnerQuery(loadSubscription, [ready]);

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
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-slate-50 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-1 ${
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
                      Built in and closed by default every year. Override one open for this branch if you&apos;ll be
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

            {/* Plan tab */}
            {activeTab === 'plan' && (
              <SectionPanel
                title="Subscription plan"
                description="Your platform plan and billing status with Lunara. Contact support to change plans."
              >
                {subscriptionLoading ? (
                  <p className="px-6 py-4 text-sm text-muted sm:px-8">Loading plan details…</p>
                ) : subscription ? (
                  <dl className="px-6 py-2 sm:px-8">
                    <DetailRow label="Plan" value={SUBSCRIPTION_PLAN_LABELS[subscription.subscriptionPlan]} />
                    <DetailRow
                      label="Price / month"
                      value={
                        subscription.subscriptionPlan === 'trial'
                          ? 'Free'
                          : `₱${subscription.planPrice.toLocaleString('en-PH')}`
                      }
                    />
                    <DetailRow
                      label={subscription.subscriptionPlan === 'trial' ? 'Trial ends' : 'Renews on'}
                      value={formatSubscriptionDate(
                        subscription.subscriptionPlan === 'trial'
                          ? subscription.trialEndsAt
                          : subscription.planRenewsAt,
                      )}
                    />
                  </dl>
                ) : subscriptionError ? (
                  <p className="px-6 py-4 text-sm text-destructive sm:px-8">{subscriptionError}</p>
                ) : (
                  <p className="px-6 py-4 text-sm text-muted sm:px-8">
                    Only shop partners can view plan details.
                  </p>
                )}
                {subscription && subscription.subscriptionPlan !== 'trial' ? (
                  <p className="border-t border-border/60 px-6 py-3 text-xs text-muted sm:px-8">
                    Billed automatically alongside your weekly invoice once the renewal date is reached.
                    {subscription.paymentMethodOnFile
                      ? ' Your saved card is charged automatically — no action needed.'
                      : ' Add a card below to have this charged automatically instead of settling manually.'}
                  </p>
                ) : null}
                {subscription && subscription.subscriptionPlan !== 'trial' && (
                  <PaymentMethodPanel canEdit={canEdit} />
                )}
                {subscription && subscription.subscriptionPlan !== 'trial' && (
                  <PromoCodePanel
                    canEdit={canEdit}
                    activeCode={subscription.promotionCode}
                    freeMonthsRemaining={subscription.promotionFreeMonthsRemaining}
                    onRedeemed={() => void reloadSubscription()}
                  />
                )}
              </SectionPanel>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PartnerSettingsPage() {
  return (
    <Suspense fallback={<AuthLoading message="Loading shop settings…" />}>
      <PartnerSettingsContent />
    </Suspense>
  );
}
