'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { LiveBadge } from '../ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { formatSlugLabel } from '../../lib/format-label';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-operations-socket';

interface RiderRow {
  _id: string;
  userId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  isOnline: boolean;
  isActive: boolean;
  vehicleType: string;
  verificationStatus: 'incomplete' | 'pending_review' | 'verified';
  totalEarnings: number;
  todayEarnings: number;
  activeTasks: number;
}

interface PendingDocumentRow {
  userId: string;
  riderId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  document: {
    type: string;
    fileUrl?: string;
    status?: string;
    uploadedAt?: string;
  };
}

type FleetState = 'nominal' | 'attention' | 'critical';
type RosterTab = 'all' | 'online' | 'offline' | 'pending_kyc';
type RailMode = 'default' | 'invite';

function verificationBadgeClass(status: RiderRow['verificationStatus']) {
  switch (status) {
    case 'verified':
      return 'badge-accent';
    case 'pending_review':
      return 'badge-warning';
    default:
      return 'badge-neutral';
  }
}

function verificationLabel(status: RiderRow['verificationStatus']) {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'pending_review':
      return 'Pending review';
    default:
      return 'Incomplete';
  }
}

function riderDisplayName(r: {
  firstName?: string;
  lastName?: string;
  email?: string;
  _id?: string;
  userId?: string;
}) {
  const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
  return name || r.email || r._id || r.userId || 'Rider';
}

function deriveFleetState(
  online: number,
  pendingKyc: number,
  activeTasks: number,
  fleetSize: number,
): FleetState {
  if (online === 0 && activeTasks > 0) return 'critical';
  if (pendingKyc > 0 || (activeTasks > 0 && activeTasks > online) || (fleetSize > 0 && online === 0)) {
    return 'attention';
  }
  return 'nominal';
}

const fleetCopy: Record<FleetState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'Fleet nominal',
    detail: 'Riders online, no KYC backlog blocking dispatch.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Fleet attention',
    detail: 'KYC reviews pending or task load exceeds online capacity.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Coverage gap',
    detail: 'Active tasks in flight but no riders online.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

// ── Small blocks ───────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  onClick?: () => void;
  active?: boolean;
}) {
  const cls = `rounded-xl p-4 text-left ring-1 transition-all ${TILE_TONES[tone]} ${
    active ? 'ring-2 ring-primary/40' : ''
  }`;
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function PanelHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
export function RidersBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);
  const [rosterTab, setRosterTab] = useState<RosterTab>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [railMode, setRailMode] = useState<RailMode>('default');

  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState('');

  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteVehicleType, setInviteVehicleType] = useState('motorcycle');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<{ userId: string; name: string } | null>(null);

  const loadRiders = useCallback(async () => {
    const data = await adminFetch<RiderRow[]>('/admin/riders');
    setLastUpdated(new Date());
    return data;
  }, []);

  const loadPending = useCallback(
    () => adminFetch<PendingDocumentRow[]>('/admin/riders/documents/pending'),
    [],
  );

  const {
    data: riders,
    loading,
    error,
    reload: reloadRiders,
  } = useAdminQuery(loadRiders, []);
  const { data: pendingDocs, error: pendingError, reload: reloadPending } = useAdminQuery(
    loadPending,
    [],
  );

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reloadRiders();
    },
  });

  useEffect(() => {
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, [riders]);

  const fleet = useMemo(() => riders ?? [], [riders]);
  const online = fleet.filter((r) => r.isOnline).length;
  const pendingCount = pendingDocs?.length ?? 0;
  const activeTasks = fleet.reduce((n, r) => n + r.activeTasks, 0);
  const verifiedCount = fleet.filter((r) => r.verificationStatus === 'verified').length;
  const todayEarningsTotal = fleet.reduce((n, r) => n + r.todayEarnings, 0);
  const fleetState = deriveFleetState(online, pendingCount, activeTasks, fleet.length);
  const copy = fleetCopy[fleetState];

  const pendingKycUserIds = useMemo(
    () => new Set((pendingDocs ?? []).map((d) => d.userId)),
    [pendingDocs],
  );

  const tabFiltered = useMemo(() => {
    switch (rosterTab) {
      case 'online':
        return fleet.filter((r) => r.isOnline);
      case 'offline':
        return fleet.filter((r) => !r.isOnline);
      case 'pending_kyc':
        return fleet.filter(
          (r) => r.verificationStatus === 'pending_review' || pendingKycUserIds.has(r.userId),
        );
      default:
        return fleet;
    }
  }, [fleet, rosterTab, pendingKycUserIds]);

  const searched = useMemo(
    () =>
      filterBySearch(tabFiltered, search, [
        (r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`,
        (r) => r.email,
        (r) => r.phone,
        (r) => r.vehicleType,
      ]),
    [tabFiltered, search],
  );
  const visible = useMemo(() => searched.slice(0, limit), [searched, limit]);

  const selected = useMemo(
    () => (selectedId ? (fleet.find((r) => r._id === selectedId) ?? null) : null),
    [fleet, selectedId],
  );
  const selectedPendingDocs = useMemo(
    () => (selected ? (pendingDocs ?? []).filter((d) => d.userId === selected.userId) : []),
    [selected, pendingDocs],
  );

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  const ROSTER_TABS: { id: RosterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All riders', count: fleet.length },
    { id: 'online', label: 'Online', count: online },
    { id: 'offline', label: 'Offline', count: fleet.length - online },
    {
      id: 'pending_kyc',
      label: 'Pending KYC',
      count: fleet.filter(
        (r) => r.verificationStatus === 'pending_review' || pendingKycUserIds.has(r.userId),
      ).length,
    },
  ];

  async function syncAll() {
    await Promise.all([reloadRiders(), reloadPending()]);
  }

  function selectRider(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
    setRailMode('default');
  }

  function generateInvitePassword() {
    setInvitePassword(`Lunara${Math.random().toString(36).slice(2, 10)}!`);
  }

  async function inviteRider(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !invitePassword.trim()) return;

    setInviteBusy(true);
    setInviteError('');
    setInviteSuccess(null);
    try {
      const created = await adminFetch<RiderRow>('/admin/riders', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          phone: invitePhone.trim() || undefined,
          password: invitePassword,
          firstName: inviteFirstName.trim() || undefined,
          lastName: inviteLastName.trim() || undefined,
          vehicleType: inviteVehicleType,
        }),
      });
      const name = riderDisplayName(created);
      setInviteSuccess({ userId: created.userId, name });
      setInviteFirstName('');
      setInviteLastName('');
      setInviteEmail('');
      setInvitePhone('');
      setInvitePassword('');
      setInviteVehicleType('motorcycle');
      await syncAll();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviteBusy(false);
    }
  }

  async function sendAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announceBody.trim()) return;
    setAnnounceBusy(true);
    setAnnounceMsg('');
    try {
      const res = await adminFetch<{ sent: number }>('/admin/riders/announcement', {
        method: 'POST',
        body: JSON.stringify({
          title: announceTitle.trim() || undefined,
          body: announceBody.trim(),
        }),
      });
      setAnnounceMsg(`Sent to ${res.sent} rider(s).`);
      setAnnounceTitle('');
      setAnnounceBody('');
    } catch (err) {
      setAnnounceMsg(err instanceof Error ? err.message : 'Announcement failed');
    } finally {
      setAnnounceBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Fleet</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Riders
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Fleet status, KYC reviews, announcements, and earnings — monitor coverage for
              dispatch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {socketLive ? <LiveBadge /> : <span className="badge-neutral">Polling</span>}
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void syncAll()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/riders/withdrawals" className="btn-outline btn-sm">
              Withdrawals
            </Link>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                setRailMode((m) => (m === 'invite' ? 'default' : 'invite'));
                setSelectedId(null);
              }}
            >
              {railMode === 'invite' ? 'Close invite' : 'Invite rider'}
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}
      {pendingError ? (
        <div className="alert-error mb-4" role="alert">
          {pendingError}
        </div>
      ) : null}

      {loading && !riders ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading riders…
        </div>
      ) : null}

      {riders ? (
        <div className="space-y-4">
          {/* Fleet state banner */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {pendingCount > 0 ? (
              <button
                type="button"
                className="badge-warning px-3 py-1 text-xs font-semibold"
                onClick={() => setRosterTab('pending_kyc')}
              >
                {pendingCount} KYC pending
              </button>
            ) : null}
            {online === 0 && activeTasks > 0 ? (
              <span className="badge-danger px-3 py-1 text-xs font-semibold">No riders online</span>
            ) : null}
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Fleet size"
              value={String(fleet.length)}
              sub="registered riders"
              tone="primary"
              onClick={() => setRosterTab('all')}
              active={rosterTab === 'all'}
            />
            <StatTile
              label="Online now"
              value={`${online} / ${fleet.length}`}
              sub={fleet.length > 0 ? `${Math.round((online / fleet.length) * 100)}% coverage` : undefined}
              tone={online === 0 && fleet.length > 0 ? 'rose' : 'accent'}
              onClick={() => setRosterTab('online')}
              active={rosterTab === 'online'}
            />
            <StatTile
              label="Active tasks"
              value={String(activeTasks)}
              sub="pickup + delivery legs"
              tone="secondary"
            />
            <StatTile
              label="Pending KYC"
              value={String(pendingCount)}
              sub="documents to review"
              tone={pendingCount > 0 ? 'amber' : 'violet'}
              onClick={() => setRosterTab('pending_kyc')}
              active={rosterTab === 'pending_kyc'}
            />
            <StatTile
              label="Verified"
              value={String(verifiedCount)}
              sub={`of ${fleet.length} riders`}
              tone="violet"
            />
            <StatTile
              label="Earnings today"
              value={formatPeso(todayEarningsTotal, true)}
              sub="fleet-wide"
              tone="accent"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Roster ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Rider roster filters"
              >
                <div className="flex min-w-max gap-1">
                  {ROSTER_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={rosterTab === t.id}
                      onClick={() => setRosterTab(t.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        rosterTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-1">
                <ListControls
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Name, email, phone, vehicle…"
                  limit={limit}
                  onLimitChange={setLimit}
                  total={searched.length}
                  filtered={visible.length}
                />
              </div>

              {visible.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No riders found</p>
                  <p className="mt-1 text-sm text-muted">
                    {search || rosterTab !== 'all'
                      ? 'Try a different search or tab.'
                      : 'Invite a rider to get started.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[680px]">
                    <caption className="sr-only">Rider fleet roster</caption>
                    <thead>
                      <tr>
                        <th scope="col">Rider</th>
                        <th scope="col">Vehicle</th>
                        <th scope="col">KYC</th>
                        <th scope="col">Status</th>
                        <th scope="col">Tasks</th>
                        <th scope="col" className="text-right">Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => {
                        const isSelected = selectedId === r._id;
                        return (
                          <tr
                            key={r._id}
                            onClick={() => selectRider(r._id)}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                          >
                            <td>
                              <div className="flex items-center gap-3">
                                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                  {riderDisplayName(r)[0]?.toUpperCase() ?? 'R'}
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                                      r.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                    aria-hidden
                                  />
                                </span>
                                <div className="min-w-0">
                                  <p className="max-w-[12rem] truncate text-sm font-medium text-slate-900">
                                    {riderDisplayName(r)}
                                    {!r.isActive ? (
                                      <span className="badge-neutral ml-1.5 text-xs">Inactive</span>
                                    ) : null}
                                  </p>
                                  <p className="max-w-[12rem] truncate text-xs text-muted" title={r.phone ?? r.email}>
                                    {r.phone ?? r.email ?? '—'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="capitalize text-muted">{formatSlugLabel(r.vehicleType)}</td>
                            <td>
                              <span className={verificationBadgeClass(r.verificationStatus)}>
                                {verificationLabel(r.verificationStatus)}
                              </span>
                            </td>
                            <td>
                              {r.isOnline ? (
                                <span className="badge-accent">Online</span>
                              ) : (
                                <span className="badge-neutral">Offline</span>
                              )}
                            </td>
                            <td className="tabular-nums">{r.activeTasks}</td>
                            <td className="text-right">
                              <p className="text-sm font-medium tabular-nums">{formatPeso(r.todayEarnings)}</p>
                              <p className="text-xs tabular-nums text-muted">{formatPeso(r.totalEarnings)} total</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Rail ── */}
            <div className="space-y-4 xl:col-span-4">
              {railMode === 'invite' ? (
                <section className="dc-panel ring-2 ring-primary/30">
                  <PanelHeader
                    title="Invite rider"
                    sub="Account credentials — rider completes profile and KYC in the mobile app"
                    action={
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        aria-label="Close invite form"
                        onClick={() => setRailMode('default')}
                      >
                        ✕
                      </button>
                    }
                  />
                  <form onSubmit={inviteRider} className="space-y-3 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="invite-first-name" className="form-label">
                          First name
                        </label>
                        <input
                          id="invite-first-name"
                          className="input-field"
                          value={inviteFirstName}
                          onChange={(e) => setInviteFirstName(e.target.value)}
                          maxLength={80}
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label htmlFor="invite-last-name" className="form-label">
                          Last name
                        </label>
                        <input
                          id="invite-last-name"
                          className="input-field"
                          value={inviteLastName}
                          onChange={(e) => setInviteLastName(e.target.value)}
                          maxLength={80}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="invite-email" className="form-label">
                        Email
                      </label>
                      <input
                        id="invite-email"
                        type="email"
                        className="input-field"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="invite-phone" className="form-label">
                        Phone <span className="font-normal text-muted">(optional)</span>
                      </label>
                      <input
                        id="invite-phone"
                        type="tel"
                        className="input-field"
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                        placeholder="+63917…"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="invite-password" className="form-label">
                        Temporary password
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="invite-password"
                          type="text"
                          className="input-field min-w-0 flex-1 font-mono text-xs"
                          value={invitePassword}
                          onChange={(e) => setInvitePassword(e.target.value)}
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder="Min. 8 characters"
                        />
                        <button
                          type="button"
                          className="btn-outline btn-sm shrink-0"
                          onClick={generateInvitePassword}
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="invite-vehicle" className="form-label">
                        Vehicle type
                      </label>
                      <select
                        id="invite-vehicle"
                        className="input-field"
                        value={inviteVehicleType}
                        onChange={(e) => setInviteVehicleType(e.target.value)}
                      >
                        <option value="motorcycle">Motorcycle</option>
                        <option value="bicycle">Bicycle</option>
                        <option value="car">Car</option>
                        <option value="van">Van</option>
                      </select>
                    </div>

                    {inviteError ? (
                      <div className="alert-error" role="alert">
                        {inviteError}
                      </div>
                    ) : null}
                    {inviteSuccess ? (
                      <div className="alert-info">
                        <p className="text-sm">
                          <span className="font-medium">{inviteSuccess.name}</span> invited. Share the
                          password — they sign in on the rider app, upload KYC, then approve at{' '}
                          <Link href={`/riders/${inviteSuccess.userId}`} className="link-primary underline">
                            rider profile
                          </Link>
                          .
                        </p>
                      </div>
                    ) : null}

                    <button type="submit" className="btn-primary btn-sm w-full" disabled={inviteBusy}>
                      {inviteBusy ? 'Inviting…' : 'Create rider account'}
                    </button>
                  </form>
                </section>
              ) : null}

              {selected && railMode === 'default' ? (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Rider details</h2>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-3 px-5 py-4">
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                      {riderDisplayName(selected)[0]?.toUpperCase() ?? 'R'}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                          selected.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {riderDisplayName(selected)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={verificationBadgeClass(selected.verificationStatus)}>
                          {verificationLabel(selected.verificationStatus)}
                        </span>
                        {selected.isOnline ? (
                          <span className="badge-accent">Online</span>
                        ) : (
                          <span className="badge-neutral">Offline</span>
                        )}
                        {!selected.isActive ? <span className="badge-danger">Inactive</span> : null}
                      </div>
                    </div>
                  </div>

                  <RailSection title="Contact">
                    <RailRow label="Email" value={selected.email ?? '—'} />
                    <RailRow
                      label="Phone"
                      value={
                        selected.phone ? (
                          <a href={`tel:${selected.phone}`} className="link-primary">
                            {selected.phone}
                          </a>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </RailSection>

                  <RailSection title="Fleet status">
                    <RailRow
                      label="Vehicle"
                      value={<span className="capitalize">{formatSlugLabel(selected.vehicleType)}</span>}
                    />
                    <RailRow label="Active tasks" value={<span className="tabular-nums">{selected.activeTasks}</span>} />
                    <RailRow
                      label="Earnings today"
                      value={<span className="tabular-nums">{formatPeso(selected.todayEarnings)}</span>}
                    />
                    <RailRow
                      label="Earnings all time"
                      value={<span className="tabular-nums">{formatPeso(selected.totalEarnings)}</span>}
                    />
                  </RailSection>

                  {selectedPendingDocs.length > 0 ? (
                    <RailSection title="Documents awaiting review">
                      <ul className="space-y-1.5">
                        {selectedPendingDocs.map((d) => (
                          <li key={d.document.type} className="flex items-center justify-between gap-2 text-sm">
                            <span className="badge-warning capitalize">{formatSlugLabel(d.document.type)}</span>
                            <Link href={`/riders/${selected.userId}`} className="link-primary text-xs font-medium">
                              Review →
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </RailSection>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
                    <Link href={`/riders/${selected.userId}`} className="btn-primary btn-sm flex-1 text-center">
                      Open full profile
                    </Link>
                    <Link href="/live-tracking" className="btn-outline btn-sm flex-1 text-center">
                      Live tracking
                    </Link>
                  </div>
                </section>
              ) : null}

              {railMode === 'default' && !selected ? (
                <section className="dc-panel">
                  <PanelHeader
                    title="Pending document reviews"
                    sub={`${pendingCount} document${pendingCount === 1 ? '' : 's'} waiting for approval`}
                  />
                  {pendingCount === 0 ? (
                    <p className="dc-panel-empty text-sm text-muted">No documents awaiting review.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {(pendingDocs ?? []).slice(0, 8).map((row) => (
                        <li
                          key={`${row.userId}-${row.document.type}`}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {riderDisplayName(row)}
                            </p>
                            <p className="text-xs capitalize text-muted">
                              {formatSlugLabel(row.document.type)}
                            </p>
                          </div>
                          <Link href={`/riders/${row.userId}`} className="link-primary shrink-0 text-xs font-medium">
                            Review →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              <section className="dc-panel">
                <PanelHeader title="Broadcast announcement" sub="Push notification to all active riders" />
                <form onSubmit={sendAnnouncement} className="space-y-3 px-5 py-4">
                  <div>
                    <label htmlFor="announce-title" className="form-label">
                      Title <span className="font-normal text-muted">(optional)</span>
                    </label>
                    <input
                      id="announce-title"
                      className="input-field"
                      value={announceTitle}
                      onChange={(e) => setAnnounceTitle(e.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label htmlFor="announce-body" className="form-label">
                      Message
                    </label>
                    <textarea
                      id="announce-body"
                      className="input-field min-h-24 resize-y"
                      value={announceBody}
                      onChange={(e) => setAnnounceBody(e.target.value)}
                      required
                      maxLength={1000}
                    />
                  </div>
                  {announceMsg ? <p className="text-sm text-muted">{announceMsg}</p> : null}
                  <button type="submit" className="btn-primary btn-sm w-full" disabled={announceBusy}>
                    {announceBusy ? 'Sending…' : 'Send announcement'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
