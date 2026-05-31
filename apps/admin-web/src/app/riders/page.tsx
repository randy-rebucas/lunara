'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
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

export default function MonitorRidersPage() {
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState('');
  const [search, setSearch] = useState('');

  const loadRiders = useCallback(() => adminFetch<RiderRow[]>('/admin/riders'), []);
  const loadPending = useCallback(
    () => adminFetch<PendingDocumentRow[]>('/admin/riders/documents/pending'),
    [],
  );
  const { data: riders, loading, error } = useAdminQuery(loadRiders, []);
  const { data: pendingDocs, error: pendingError } = useAdminQuery(loadPending, []);
  const online = (riders ?? []).filter((r) => r.isOnline).length;

  const filteredRiders = (riders ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
    return (
      name.toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q) ||
      (r.phone ?? '').toLowerCase().includes(q)
    );
  });

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
        description={
          loading
            ? 'Loading riders…'
            : `${online} of ${riders?.length ?? 0} riders online · active pickup/delivery tasks`
        }
        actions={
          <Link href="/riders/withdrawals" className="btn-secondary btn-sm">
            Withdrawal queue →
          </Link>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading riders…" />
      </div>

      <form onSubmit={sendAnnouncement} className="card card-body mt-6 space-y-3">
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

      <div className="mt-4">
        <label htmlFor="rider-search" className="form-label">
          Search riders
        </label>
        <input
          id="rider-search"
          type="search"
          className="input-field max-w-md"
          placeholder="Name, email, or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {pendingError ? (
        <div className="alert-error mt-4" role="alert">
          {pendingError}
        </div>
      ) : null}

      {(pendingDocs ?? []).length > 0 ? (
        <div className="mt-6 card card-body">
          <h3 className="text-lg font-semibold text-slate-900">Pending document reviews</h3>
          <p className="mt-1 text-sm text-muted">
            {pendingDocs?.length} document(s) waiting for admin approval
          </p>
          <ul className="mt-4 space-y-2">
            {(pendingDocs ?? []).slice(0, 8).map((row) => (
              <li key={`${row.userId}-${row.document.type}`}>
                <Link
                  href={`/riders/${row.userId}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {row.firstName || row.lastName
                    ? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()
                    : (row.email ?? row.userId)}{' '}
                  · {row.document.type.replace(/_/g, ' ')}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {filteredRiders.map((r) => (
          <Link key={r._id} href={`/riders/${r.userId}`} className="block">
            <div className="card card-body flex flex-wrap items-center justify-between gap-4 !py-5 transition hover:border-primary/30">
              <div>
                <p className="font-medium text-slate-900">
                  {r.firstName || r.lastName
                    ? `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()
                    : (r.email ?? r._id)}
                </p>
                <p className="text-sm text-muted">
                  {r.phone ?? '—'} · {r.vehicleType}
                  {!r.isActive && ' · inactive account'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm">
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
                <span>{r.activeTasks} active tasks</span>
                <span>Today ₱{r.todayEarnings}</span>
                <span>Total ₱{r.totalEarnings}</span>
              </div>
            </div>
          </Link>
        ))}
        {!loading && !error && filteredRiders.length === 0 && (
          <p className="text-sm text-muted">No riders. Seed rider@lunara.dev and run API seed.</p>
        )}
      </div>
    </div>
  );
}
