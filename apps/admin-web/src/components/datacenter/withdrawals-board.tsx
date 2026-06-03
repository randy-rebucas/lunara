'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { NoteModal } from '../note-modal';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
import { maskPayoutDetails } from '../../lib/mask-pii';
import { useAdminQuery } from '../../lib/use-admin-query';

interface WithdrawalRow {
  _id: string;
  riderName: string;
  amount: number;
  method: string;
  methodLabel: string;
  status: string;
  statusLabel: string;
  gcashNumber?: string;
  mayaNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  adminNote?: string;
  createdAt: string;
}

type PayoutState = 'nominal' | 'attention';
type StatusFilter = '' | 'pending' | 'paid' | 'rejected';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/riders', label: 'Riders' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/orders', label: 'Orders' },
] as const;

const payoutCopy: Record<PayoutState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'Payout queue clear',
    detail: 'No rider withdrawal requests awaiting review.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Payouts pending review',
    detail: 'Approve or reject requests — process transfers manually outside Lunara.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

function statusBadgeClass(status: string) {
  if (status === 'pending') return 'badge-warning';
  if (status === 'paid') return 'badge-accent';
  if (status === 'rejected') return 'badge-danger';
  return 'badge-neutral';
}

export function WithdrawalsBoard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    const q = statusFilter ? `?status=${statusFilter}` : '';
    const [rows, pendingRows] = await Promise.all([
      adminFetch<WithdrawalRow[]>(`/admin/riders/withdrawals${q}`),
      adminFetch<WithdrawalRow[]>('/admin/riders/withdrawals?status=pending'),
    ]);
    setLastUpdated(new Date());
    return { rows, pendingRows };
  }, [statusFilter]);

  const { data, loading, error, reload } = useAdminQuery(load, [statusFilter]);

  const rows = data?.rows ?? [];
  const pendingRows = data?.pendingRows ?? [];
  const pendingCount = pendingRows.length;
  const totalPending = useMemo(
    () => pendingRows.reduce((sum, r) => sum + r.amount, 0),
    [pendingRows],
  );
  const largestPending = useMemo(
    () => (pendingRows.length > 0 ? Math.max(...pendingRows.map((r) => r.amount)) : 0),
    [pendingRows],
  );
  const gcashCount = pendingRows.filter((r) => r.method === 'gcash').length;
  const payoutState: PayoutState = pendingCount > 0 ? 'attention' : 'nominal';
  const copy = payoutCopy[payoutState];
  const showActions = statusFilter === 'pending';

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  async function submitReview() {
    if (!pendingAction) return;
    setActionId(pendingAction.id);
    setActionError('');
    try {
      await adminFetch(`/admin/riders/withdrawals/${pendingAction.id}/${pendingAction.action}`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: note.trim() || undefined }),
      });
      setPendingAction(null);
      setNote('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <Link
          href="/riders"
          className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary"
        >
          ← Riders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Fleet payouts</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Withdrawals
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Review pending rider payout requests — approved withdrawals debit the rider wallet;
              transfer GCash, Maya, or bank payouts manually.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/riders" className="btn-primary btn-sm">
              Fleet board
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {actionError ? (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading withdrawals…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {pendingCount > 0 ? (
              <button
                type="button"
                className="badge-warning px-3 py-1 text-xs font-semibold tabular-nums"
                onClick={() => setStatusFilter('pending')}
              >
                {pendingCount} pending
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell
              label="Pending requests"
              value={pendingCount}
              highlight={pendingCount > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Total pending"
              value={formatPeso(totalPending)}
              highlight={totalPending > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Largest request"
              value={largestPending > 0 ? formatPeso(largestPending) : '—'}
            />
            <MetricCell
              label="GCash requests"
              value={gcashCount}
              sub={pendingCount > 0 ? `of ${pendingCount} pending` : undefined}
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

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Status filter</h2>
                <p className="text-xs text-muted">
                  {rows.length} request{rows.length === 1 ? '' : 's'} in current view
                </p>
              </div>
            </div>
            <div className="dc-panel-body pt-1">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value || 'all'}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    className={statusFilter === f.value ? 'filter-chip-active' : 'filter-chip'}
                    aria-pressed={statusFilter === f.value}
                  >
                    {f.label}
                    {f.value === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="dc-panel" id="withdrawal-queue">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {showActions ? 'Payout queue' : 'Withdrawal history'}
                </h2>
                <p className="text-xs text-muted">
                  {rows.length === 0
                    ? 'No requests in this view'
                    : `${rows.length} request${rows.length === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">
                  {statusFilter === 'pending' ? 'No pending withdrawals' : 'No withdrawals found'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {statusFilter === 'pending'
                    ? 'New rider payout requests will appear here for approval.'
                    : 'Try another status filter.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[880px]">
                  <caption className="sr-only">Rider withdrawal requests</caption>
                  <thead>
                    <tr>
                      <th scope="col">Rider</th>
                      <th scope="col" className="text-right">
                        Amount
                      </th>
                      <th scope="col">Method</th>
                      <th scope="col">Payout details</th>
                      <th scope="col">Status</th>
                      <th scope="col">Requested</th>
                      {!showActions ? <th scope="col">Note</th> : null}
                      {showActions ? (
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row._id}>
                        <td className="font-medium">{row.riderName}</td>
                        <td className="text-right font-medium tabular-nums">{formatPeso(row.amount)}</td>
                        <td>
                          <span className="badge-neutral">{row.methodLabel}</span>
                        </td>
                        <td
                          className="max-w-[14rem] truncate text-code text-muted"
                          title={maskPayoutDetails(row)}
                        >
                          {maskPayoutDetails(row)}
                        </td>
                        <td>
                          <span className={statusBadgeClass(row.status)}>{row.statusLabel}</span>
                        </td>
                        <td className="whitespace-nowrap text-sm text-muted tabular-nums">
                          {new Date(row.createdAt).toLocaleString('en-PH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        {!showActions ? (
                          <td className="max-w-[12rem] truncate text-sm text-muted" title={row.adminNote}>
                            {row.adminNote ?? '—'}
                          </td>
                        ) : null}
                        {showActions ? (
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                disabled={actionId === row._id}
                                onClick={() => {
                                  setPendingAction({ id: row._id, action: 'approve' });
                                  setNote('');
                                  setActionError('');
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                disabled={actionId === row._id}
                                onClick={() => {
                                  setPendingAction({ id: row._id, action: 'reject' });
                                  setNote('');
                                  setActionError('');
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dc-panel">
            <div className="dc-panel-header">
              <h2 className="text-sm font-semibold text-slate-900">Payout policy</h2>
              <p className="text-xs text-muted">Manual transfer workflow</p>
            </div>
            <div className="dc-panel-body text-sm text-muted">
              <p>
                Approved withdrawals are marked paid and debited from the rider wallet. Process
                GCash, Maya, and bank transfers manually outside Lunara, then approve here to
                close the request.
              </p>
            </div>
          </section>
        </div>
      ) : null}

      <NoteModal
        open={!!pendingAction}
        title={pendingAction?.action === 'reject' ? 'Reject withdrawal' : 'Approve withdrawal'}
        description="Add an optional note for the rider and audit trail."
        placeholder="Optional admin note"
        confirmLabel={pendingAction?.action === 'reject' ? 'Reject' : 'Approve'}
        value={note}
        onChange={setNote}
        onConfirm={submitReview}
        onCancel={() => {
          setPendingAction(null);
          setNote('');
        }}
        busy={!!actionId}
      />
    </div>
  );
}
