'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { LiveBadge } from '../ui/stat-card';
import { MetricCell } from './metric-cell';
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

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/control-tower', label: 'Control tower' },
  { href: '/orders', label: 'Orders' },
  { href: '/riders/withdrawals', label: 'Withdrawals' },
] as const;

function verificationBadgeClass(status: RiderRow['verificationStatus']) {
  switch (status) {
    case 'verified':
      return 'badge-accent';
    case 'pending_review':
      return 'badge-primary';
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

export function RidersBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
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

  const fleet = riders ?? [];
  const online = fleet.filter((r) => r.isOnline).length;
  const pendingCount = pendingDocs?.length ?? 0;
  const activeTasks = fleet.reduce((n, r) => n + r.activeTasks, 0);
  const verifiedCount = fleet.filter((r) => r.verificationStatus === 'verified').length;
  const fleetState = deriveFleetState(online, pendingCount, activeTasks, fleet.length);
  const copy = fleetCopy[fleetState];

  const filteredRiders = useMemo(() => {
    const searched = filterBySearch(fleet, search, [
      (r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`,
      (r) => r.email,
      (r) => r.phone,
      (r) => r.vehicleType,
    ]);
    return searched.slice(0, limit);
  }, [fleet, search, limit]);

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  async function syncAll() {
    await Promise.all([reloadRiders(), reloadPending()]);
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
      <header className="mb-8">
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
            <a href="#fleet-invite" className="btn-primary btn-sm">
              Invite rider
            </a>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
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
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {pendingCount > 0 ? (
              <span className="badge-warning px-3 py-1 text-xs font-semibold">
                {pendingCount} KYC pending
              </span>
            ) : null}
            {online === 0 && activeTasks > 0 ? (
              <span className="badge-danger px-3 py-1 text-xs font-semibold">No riders online</span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <MetricCell label="Fleet size" value={fleet.length} />
            <MetricCell
              label="Online now"
              value={`${online}/${fleet.length}`}
              href="/dispatch"
              highlight={online === 0 && fleet.length > 0 ? 'danger' : online > 0 ? 'accent' : undefined}
            />
            <MetricCell
              label="Pending KYC"
              value={pendingCount}
              highlight={pendingCount > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Active tasks"
              value={activeTasks}
              highlight={activeTasks > online && online > 0 ? 'warning' : activeTasks > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Verified"
              value={verifiedCount}
              sub={`of ${fleet.length} riders`}
              highlight="accent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-md border border-border/80 bg-surface px-3 py-1.5 dc-chip transition-colors hover:border-primary/40 hover:text-primary"
              >
                {a.label}
              </Link>
            ))}
          </div>

          {pendingError ? (
            <div className="alert-error" role="alert">
              {pendingError}
            </div>
          ) : null}

          {(pendingDocs ?? []).length > 0 ? (
            <section className="dc-panel">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Pending document reviews</h2>
                  <p className="text-xs text-muted">
                    {pendingCount} document{pendingCount === 1 ? '' : 's'} waiting for approval
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Pending rider KYC documents</caption>
                  <thead>
                    <tr>
                      <th scope="col">Rider</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Document</th>
                      <th scope="col">
                        <span className="sr-only">Review</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingDocs ?? []).slice(0, 12).map((row) => (
                      <tr key={`${row.userId}-${row.document.type}`}>
                        <td className="font-medium">{riderDisplayName(row)}</td>
                        <td className="text-muted">{row.phone ?? row.email ?? '—'}</td>
                        <td>
                          <span className="badge-primary capitalize">
                            {formatSlugLabel(row.document.type)}
                          </span>
                        </td>
                        <td>
                          <Link href={`/riders/${row.userId}`} className="link-primary text-xs font-medium">
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Name, email, phone, vehicle…"
            limit={limit}
            onLimitChange={setLimit}
            total={fleet.length}
            filtered={filteredRiders.length}
          />

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Fleet roster</h2>
                <p className="text-xs text-muted">
                  Showing {filteredRiders.length} of {fleet.length} riders
                </p>
              </div>
              <Link href="/dispatch" className="link-primary text-xs font-medium">
                Dispatch board →
              </Link>
            </div>

            {filteredRiders.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No riders found</p>
                <p className="mt-1 text-sm text-muted">
                  {search
                    ? 'Try a different search.'
                    : 'Invite a rider below or seed rider@lunara.dev for local dev.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[960px]">
                  <caption className="sr-only">Rider fleet roster</caption>
                  <thead>
                    <tr>
                      <th scope="col">Rider</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Vehicle</th>
                      <th scope="col">KYC</th>
                      <th scope="col">Status</th>
                      <th scope="col">Tasks</th>
                      <th scope="col" className="text-right">
                        Today
                      </th>
                      <th scope="col" className="text-right">
                        Total
                      </th>
                      <th scope="col">
                        <span className="sr-only">Profile</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRiders.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <Link href={`/riders/${r.userId}`} className="link-primary font-medium">
                            {riderDisplayName(r)}
                          </Link>
                          {!r.isActive ? (
                            <span className="badge-neutral ml-2 text-xs">Inactive</span>
                          ) : null}
                        </td>
                        <td className="max-w-[10rem] truncate text-muted" title={r.phone ?? r.email}>
                          {r.phone ?? r.email ?? '—'}
                        </td>
                        <td className="capitalize text-muted">{formatSlugLabel(r.vehicleType)}</td>
                        <td>
                          <span className={verificationBadgeClass(r.verificationStatus)}>
                            {verificationLabel(r.verificationStatus)}
                          </span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${r.isOnline ? 'bg-accent' : 'bg-slate-300'}`}
                              aria-hidden
                            />
                            {r.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="tabular-nums">{r.activeTasks}</td>
                        <td className="text-right tabular-nums">{formatPeso(r.todayEarnings)}</td>
                        <td className="text-right tabular-nums">{formatPeso(r.totalEarnings)}</td>
                        <td>
                          <Link href={`/riders/${r.userId}`} className="link-primary text-xs font-medium">
                            Profile →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="dc-panel flex h-full flex-col" id="fleet-invite">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Invite rider</h2>
                <p className="text-xs text-muted">
                  Account credentials — rider completes profile and KYC in the mobile app
                </p>
              </div>
              <form onSubmit={inviteRider} className="dc-panel-body flex flex-1 flex-col">
                <div className="dc-form-grid flex-1">
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
                        className="btn-outline btn-sm shrink-0 self-end"
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
                </div>

                {inviteError ? (
                  <div className="alert-error mt-3" role="alert">
                    {inviteError}
                  </div>
                ) : null}
                {inviteSuccess ? (
                  <div className="alert-info mt-3">
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

                <div className="dc-form-actions mt-4">
                  <button type="submit" className="btn-primary btn-sm" disabled={inviteBusy}>
                    {inviteBusy ? 'Inviting…' : 'Create rider account'}
                  </button>
                </div>
              </form>
            </section>

            <section className="dc-panel flex h-full flex-col">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Broadcast announcement</h2>
                <p className="text-xs text-muted">Push notification to all active riders</p>
              </div>
              <form onSubmit={sendAnnouncement} className="dc-panel-body flex flex-1 flex-col">
                <div className="flex flex-1 flex-col gap-3">
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
                  <div className="flex min-h-0 flex-1 flex-col">
                    <label htmlFor="announce-body" className="form-label">
                      Message
                    </label>
                    <textarea
                      id="announce-body"
                      className="input-field min-h-32 flex-1 resize-y"
                      value={announceBody}
                      onChange={(e) => setAnnounceBody(e.target.value)}
                      required
                      maxLength={1000}
                    />
                  </div>
                  {announceMsg ? <p className="text-sm text-muted">{announceMsg}</p> : null}
                </div>
                <div className="dc-form-actions mt-4">
                  <button type="submit" className="btn-primary btn-sm" disabled={announceBusy}>
                    {announceBusy ? 'Sending…' : 'Send announcement'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
