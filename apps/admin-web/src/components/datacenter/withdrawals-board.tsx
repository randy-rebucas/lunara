'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { NoteModal } from '../note-modal';
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
  processedAt?: string;
  createdAt: string;
}

interface WithdrawalCounts {
  pending: number;
  pendingAmount: number;
  paid: number;
  paidAmount: number;
  rejected: number;
  total: number;
}

type PayoutState = 'nominal' | 'attention';
type StatusTab = 'all' | 'pending' | 'paid' | 'rejected';

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

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

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

export function WithdrawalsBoard() {
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    const data = await adminFetch<{ items: WithdrawalRow[]; counts: WithdrawalCounts }>(
      '/admin/riders/withdrawals',
    );
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const counts = useMemo(
    () =>
      data?.counts ?? { pending: 0, pendingAmount: 0, paid: 0, paidAmount: 0, rejected: 0, total: 0 },
    [data?.counts],
  );

  const tabFiltered = useMemo(() => {
    if (statusTab === 'all') return items;
    return items.filter((r) => r.status === statusTab);
  }, [items, statusTab]);

  const filteredItems = useMemo(() => {
    return filterBySearch(tabFiltered, search, [
      (r) => r.riderName,
      (r) => r.methodLabel,
      (r) => r.status,
      (r) => maskPayoutDetails(r),
    ]).slice(0, limit);
  }, [tabFiltered, search, limit]);

  const selected = useMemo(
    () => (selectedId ? (items.find((r) => r._id === selectedId) ?? null) : null),
    [items, selectedId],
  );

  const largestPending = useMemo(() => {
    const pending = items.filter((r) => r.status === 'pending');
    return pending.length > 0 ? Math.max(...pending.map((r) => r.amount)) : 0;
  }, [items]);

  const payoutState: PayoutState = counts.pending > 0 ? 'attention' : 'nominal';
  const copy = payoutCopy[payoutState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const STATUS_TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All requests', count: items.length },
    { id: 'pending', label: 'Pending', count: items.filter((r) => r.status === 'pending').length },
    { id: 'paid', label: 'Paid', count: items.filter((r) => r.status === 'paid').length },
    { id: 'rejected', label: 'Rejected', count: items.filter((r) => r.status === 'rejected').length },
  ];

  function selectTab(next: StatusTab) {
    setStatusTab(next);
    setSelectedId(null);
  }

  function startAction(id: string, action: 'approve' | 'reject') {
    setPendingAction({ id, action });
    setNote('');
    setActionError('');
  }

  async function submitReview() {
    if (!pendingAction) return;
    setActionBusy(true);
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
      setActionBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-5">
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
          {/* ── Queue state banner ───────────────────────────────── */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {counts.pending > 0 ? (
              <button
                type="button"
                className="badge-warning px-3 py-1 text-xs font-semibold tabular-nums"
                onClick={() => selectTab('pending')}
              >
                {counts.pending} pending
              </button>
            ) : null}
          </div>

          {/* ── Stat tiles ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Total requests"
              value={counts.total.toLocaleString()}
              sub="all time"
              tone="primary"
              onClick={() => selectTab('all')}
              active={statusTab === 'all'}
            />
            <StatTile
              label="Pending"
              value={counts.pending.toLocaleString()}
              sub="awaiting review"
              tone={counts.pending > 0 ? 'amber' : 'secondary'}
              onClick={() => selectTab('pending')}
              active={statusTab === 'pending'}
            />
            <StatTile
              label="Pending value"
              value={formatPeso(counts.pendingAmount, true)}
              sub="to be paid out"
              tone="violet"
            />
            <StatTile
              label="Largest pending"
              value={largestPending > 0 ? formatPeso(largestPending, true) : '—'}
              tone="secondary"
            />
            <StatTile
              label="Paid out"
              value={formatPeso(counts.paidAmount, true)}
              sub={`${counts.paid.toLocaleString()} request${counts.paid === 1 ? '' : 's'}`}
              tone="accent"
              onClick={() => selectTab('paid')}
              active={statusTab === 'paid'}
            />
            <StatTile
              label="Rejected"
              value={counts.rejected.toLocaleString()}
              sub="all time"
              tone={counts.rejected > 0 ? 'rose' : 'secondary'}
              onClick={() => selectTab('rejected')}
              active={statusTab === 'rejected'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Payout queue ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Withdrawal status"
              >
                <div className="flex min-w-max gap-1">
                  {STATUS_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={statusTab === t.id}
                      onClick={() => selectTab(t.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        statusTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                        {t.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-1">
                <ListControls
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Rider, method, payout details…"
                  limit={limit}
                  onLimitChange={setLimit}
                  total={tabFiltered.length}
                  filtered={filteredItems.length}
                />
              </div>

              {filteredItems.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">
                    {search || statusTab !== 'all' ? 'No withdrawals match' : 'No withdrawal requests'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {search || statusTab !== 'all'
                      ? 'Try another filter or search term.'
                      : 'New rider payout requests will appear here for approval.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[760px]">
                    <caption className="sr-only">Rider withdrawal requests</caption>
                    <thead>
                      <tr>
                        <th scope="col">Rider</th>
                        <th scope="col" className="text-right">Amount</th>
                        <th scope="col">Method</th>
                        <th scope="col">Status</th>
                        <th scope="col">Requested</th>
                        <th scope="col">Processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((row) => {
                        const isSelected = selectedId === row._id;
                        return (
                          <tr
                            key={row._id}
                            onClick={() => setSelectedId((prev) => (prev === row._id ? null : row._id))}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${
                              isSelected
                                ? 'bg-primary/5 hover:bg-primary/5'
                                : row.status === 'pending'
                                  ? 'bg-amber-50/40'
                                  : ''
                            }`}
                          >
                            <td>
                              <p className="font-medium text-slate-900">{row.riderName}</p>
                              <p
                                className="max-w-[13rem] truncate text-code text-xs text-muted"
                                title={maskPayoutDetails(row)}
                              >
                                {maskPayoutDetails(row)}
                              </p>
                            </td>
                            <td className="text-right font-medium tabular-nums">{formatPeso(row.amount)}</td>
                            <td>
                              <span className="badge-neutral">{row.methodLabel}</span>
                            </td>
                            <td>
                              <span className={statusBadgeClass(row.status)}>{row.statusLabel}</span>
                            </td>
                            <td className="whitespace-nowrap text-xs text-muted tabular-nums">
                              {formatDateTime(row.createdAt)}
                            </td>
                            <td className="whitespace-nowrap text-xs text-muted tabular-nums">
                              {formatDateTime(row.processedAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Detail rail ── */}
            <div className="xl:col-span-4">
              {!selected ? (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Withdrawal detail</h2>
                  </div>
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Select a request row to review it here.
                  </p>
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={statusBadgeClass(selected.status)}>{selected.statusLabel}</span>
                      <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
                        {selected.riderName}
                      </p>
                      <p className="text-lg font-bold tabular-nums text-slate-900">
                        {formatPeso(selected.amount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm shrink-0"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <RailSection title="Payout">
                    <RailRow label="Method" value={selected.methodLabel} />
                    <RailRow
                      label="Details"
                      value={<span className="text-code break-all text-xs">{maskPayoutDetails(selected)}</span>}
                    />
                    <RailRow label="Requested on" value={formatDateTime(selected.createdAt)} />
                    {selected.processedAt ? (
                      <RailRow label="Processed on" value={formatDateTime(selected.processedAt)} />
                    ) : null}
                  </RailSection>

                  {selected.adminNote ? (
                    <RailSection title="Admin note">
                      <p className="text-sm leading-relaxed text-slate-700">{selected.adminNote}</p>
                    </RailSection>
                  ) : null}

                  {selected.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
                      <button
                        type="button"
                        className="btn-outline btn-sm flex-1"
                        disabled={actionBusy}
                        onClick={() => startAction(selected._id, 'reject')}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-sm flex-1"
                        disabled={actionBusy}
                        onClick={() => startAction(selected._id, 'approve')}
                      >
                        Approve
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-border/60 px-5 py-4">
                      <Link href="/riders" className="btn-outline btn-sm block text-center">
                        View rider fleet
                      </Link>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>

          {/* ── Payout policy ────────────────────────────────────── */}
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
        busy={actionBusy}
      />
    </div>
  );
}
