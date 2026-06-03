'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { EmptyState } from '../../components/empty-state';
import { filterBySearch, ListControls } from '../../components/list-controls';
import { PageHeader } from '../../components/ui/page-header';
import { SectionHeading } from '../../components/ui/section-heading';
import { StatCard } from '../../components/ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { formatSlugLabel } from '../../lib/format-label';
import { useAdminQuery } from '../../lib/use-admin-query';

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

function riderDisplayName(r: { firstName?: string; lastName?: string; email?: string; _id?: string; userId?: string }) {
  const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
  return name || r.email || r._id || r.userId || 'Rider';
}

export default function MonitorRidersPage() {
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const loadRiders = useCallback(() => adminFetch<RiderRow[]>('/admin/riders'), []);
  const loadPending = useCallback(
    () => adminFetch<PendingDocumentRow[]>('/admin/riders/documents/pending'),
    [],
  );
  const { data: riders, loading, error } = useAdminQuery(loadRiders, []);
  const { data: pendingDocs, error: pendingError } = useAdminQuery(loadPending, []);

  const online = (riders ?? []).filter((r) => r.isOnline).length;
  const pendingCount = pendingDocs?.length ?? 0;

  const filteredRiders = useMemo(() => {
    const rows = riders ?? [];
    const searched = filterBySearch(rows, search, [
      (r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`,
      (r) => r.email,
      (r) => r.phone,
      (r) => r.vehicleType,
    ]);
    return searched.slice(0, limit);
  }, [riders, search, limit]);

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
      <PageHeader
        title="Riders"
        description="Fleet status, KYC reviews, announcements, and withdrawals."
        actions={
          <Link href="/riders/withdrawals" className="btn-secondary btn-sm">
            Withdrawal queue →
          </Link>
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading riders…" />

      {riders ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Riders online" value={`${online}/${riders.length}`} accent="accent" />
            <StatCard
              label="Pending KYC"
              value={pendingCount}
              accent={pendingCount > 0 ? 'warning' : undefined}
            />
            <StatCard
              label="Active tasks"
              value={riders.reduce((n, r) => n + r.activeTasks, 0)}
            />
          </div>

          <form onSubmit={sendAnnouncement} className="card card-body mt-8 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Broadcast announcement</h3>
            <p className="text-sm text-muted">Send a push notification to all active riders.</p>
            <label htmlFor="announce-title" className="form-label">
              Title (optional)
            </label>
            <input
              id="announce-title"
              className="input-field"
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              maxLength={120}
            />
            <label htmlFor="announce-body" className="form-label">
              Message
            </label>
            <textarea
              id="announce-body"
              className="input-field min-h-24"
              value={announceBody}
              onChange={(e) => setAnnounceBody(e.target.value)}
              required
              maxLength={1000}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary btn-sm" disabled={announceBusy}>
                {announceBusy ? 'Sending…' : 'Send announcement'}
              </button>
              {announceMsg ? <p className="text-sm text-muted">{announceMsg}</p> : null}
            </div>
          </form>

          {pendingError ? (
            <div className="alert-error mt-6" role="alert">
              {pendingError}
            </div>
          ) : null}

          {(pendingDocs ?? []).length > 0 ? (
            <div className="card card-body mt-6">
              <SectionHeading title="Pending document reviews" />
              <p className="-mt-2 mb-4 text-sm text-muted">
                {pendingCount} document{pendingCount === 1 ? '' : 's'} waiting for approval
              </p>
              <ul className="space-y-2">
                {(pendingDocs ?? []).slice(0, 8).map((row) => (
                  <li key={`${row.userId}-${row.document.type}`}>
                    <Link
                      href={`/riders/${row.userId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {riderDisplayName(row)} · {formatSlugLabel(row.document.type)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Name, email, phone, vehicle…"
            limit={limit}
            onLimitChange={setLimit}
            total={riders.length}
            filtered={filteredRiders.length}
          />

          <div className="mt-6 space-y-3">
            {filteredRiders.length === 0 ? (
              <EmptyState
                title="No riders found"
                description={search ? 'Try a different search.' : 'Seed rider@lunara.dev and run API seed.'}
              />
            ) : (
              filteredRiders.map((r) => (
                <Link key={r._id} href={`/riders/${r.userId}`} className="block">
                  <div className="card card-body flex flex-wrap items-center justify-between gap-4 !py-5 transition hover:ring-primary/25">
                    <div>
                      <p className="font-medium text-slate-900">{riderDisplayName(r)}</p>
                      <p className="text-sm text-muted">
                        {r.phone ?? '—'} · {formatSlugLabel(r.vehicleType)}
                        {!r.isActive && ' · inactive account'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm sm:gap-6">
                      <span className={verificationBadgeClass(r.verificationStatus)}>
                        {verificationLabel(r.verificationStatus)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${r.isOnline ? 'bg-accent' : 'bg-slate-300'}`}
                          aria-hidden
                        />
                        {r.isOnline ? 'Online' : 'Offline'}
                      </span>
                      <span>{r.activeTasks} tasks</span>
                      <span>Today {formatPeso(r.todayEarnings)}</span>
                      <span>Total {formatPeso(r.totalEarnings)}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
