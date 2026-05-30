'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { LOST_ITEM_FLOW, formatLostItemOutcome, lostItemFlowIndex } from '@lunara/utils';
import { DataPageStatus } from '../../../components/data-page-status';
import { adminFetch } from '../../../lib/admin-api';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface InvestigationData {
  ticket: {
    _id: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    type: string;
    missingItems?: string[];
    investigationStage?: string;
    outcome?: string;
    outcomeNotes?: string;
    compensationAmount?: number;
    compensationCreditedAt?: string;
    customerEmail?: string;
    orderId?: string;
    adminNote?: string;
    timeline?: { stage: string; label: string; at: string; note?: string }[];
  };
  flow: { id: string; label: string }[];
  order: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    pickupReceipt?: string;
    deliveryReceipt?: string;
  } | null;
  photos: { source: string; label: string; url: string; at?: string }[];
  laundryLogs: {
    kind: string;
    label: string;
    at?: string;
    note?: string;
    tagCode?: string;
    photoUrl?: string;
  }[];
}

export default function SupportTicketInvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const [adminNote, setAdminNote] = useState('');
  const [outcome, setOutcome] = useState('compensated');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [compensationAmount, setCompensationAmount] = useState('200');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generalStatus, setGeneralStatus] = useState('open');
  const [generalPriority, setGeneralPriority] = useState('medium');
  const [generalAdminNote, setGeneralAdminNote] = useState('');

  const load = useCallback(async () => {
    if (!id) throw new Error('Ticket not found');
    const ticket = await adminFetch<InvestigationData['ticket']>(`/admin/tickets/${id}`);
    if (ticket.type === 'lost_item') {
      const inv = await adminFetch<InvestigationData>(`/admin/tickets/${id}/investigation`);
      setOutcome(inv.ticket.outcome === 'pending' ? 'compensated' : inv.ticket.outcome ?? 'compensated');
      setCompensationAmount(String(inv.ticket.compensationAmount || 200));
      return inv;
    }
    setGeneralStatus(ticket.status);
    setGeneralPriority(ticket.priority);
    setGeneralAdminNote(ticket.adminNote ?? '');
    return {
      ticket,
      flow: [],
      order: null,
      photos: [],
      laundryLogs: [],
    } satisfies InvestigationData;
  }, [id]);

  const { data, loading: pageLoading, error: loadError, reload } = useAdminQuery(load, [id]);

  async function investigate(action: string, body?: Record<string, unknown>) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      await adminFetch(`/admin/tickets/${id}/investigate`, {
        method: 'POST',
        body: JSON.stringify({ action, adminNote: adminNote || undefined, ...body }),
      });
      setAdminNote('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveGeneralUpdate() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      await adminFetch(`/admin/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: generalStatus,
          priority: generalPriority,
          adminNote: generalAdminNote,
        }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading || loadError || !data) {
    return (
      <div>
        <Link href="/support" className="text-sm text-indigo-600">
          ← Back to tickets
        </Link>
        <DataPageStatus loading={pageLoading} error={loadError} loadingMessage="Loading ticket…" />
      </div>
    );
  }

  const { ticket } = data;
  const isLostItem = ticket.type === 'lost_item';
  const stageIdx = ticket.investigationStage
    ? lostItemFlowIndex(ticket.investigationStage)
    : 0;

  return (
    <div>
      <Link href="/support" className="text-sm text-indigo-600">
        ← Back to tickets
      </Link>
      <h2 className="mt-4 text-2xl font-bold">{ticket.subject}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {ticket.customerEmail ?? '—'} ·{' '}
        <span className="capitalize">{ticket.status.replace(/_/g, ' ')}</span>
        {isLostItem && ` · ${ticket.type.replace(/_/g, ' ')}`}
      </p>
      <p className="mt-4 rounded-lg border bg-white p-4 text-sm">{ticket.description}</p>
      {ticket.missingItems && ticket.missingItems.length > 0 && (
        <p className="mt-2 text-sm text-amber-700">Missing: {ticket.missingItems.join(', ')}</p>
      )}

      {isLostItem && (
        <>
          <h3 className="mt-8 font-semibold">Investigation flow</h3>
          <ol className="mt-4 space-y-2">
            {LOST_ITEM_FLOW.map((step, i) => {
              const done = i < stageIdx || ticket.status === 'closed';
              const active = i === stageIdx;
              return (
                <li
                  key={step.id}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    active ? 'border-indigo-400 bg-indigo-50' : done ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {done ? '✓ ' : active ? '→ ' : '○ '}
                  {step.label}
                </li>
              );
            })}
          </ol>

          {data.order && (
            <section className="mt-8 rounded-xl border bg-white p-5">
              <h3 className="font-semibold">Linked order</h3>
              <p className="mt-2 text-sm capitalize">
                {data.order.bookingType.replace(/_/g, ' ')} · ₱{data.order.total} ·{' '}
                {data.order.status.replace(/_/g, ' ')}
              </p>
              {data.order.pickupReceipt && (
                <p className="text-xs text-slate-500">Pickup: {data.order.pickupReceipt}</p>
              )}
              {data.order.deliveryReceipt && (
                <p className="text-xs text-slate-500">Delivery: {data.order.deliveryReceipt}</p>
              )}
            </section>
          )}

          <section className="mt-8 rounded-xl border bg-white p-5">
            <h3 className="font-semibold">Review photos</h3>
            {data.photos.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No photos on file for this order.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.photos.map((p, i) => (
                  <li key={i} className="rounded border p-3">
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-slate-500">{p.source}</p>
                    <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-indigo-600">
                      {p.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={loading}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => investigate('review_photos')}
            >
              Mark photos reviewed
            </button>
          </section>

          <section className="mt-6 rounded-xl border bg-white p-5">
            <h3 className="font-semibold">Review laundry logs</h3>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
              {data.laundryLogs.map((log, i) => (
                <li key={i} className="rounded border px-3 py-2">
                  <p className="font-medium capitalize">{log.label}</p>
                  {log.at && (
                    <p className="text-xs text-slate-500">{new Date(log.at).toLocaleString()}</p>
                  )}
                  {log.tagCode && <p className="text-xs">Tag: {log.tagCode}</p>}
                  {log.note && <p className="text-xs text-slate-600">{log.note}</p>}
                  {log.photoUrl && (
                    <a href={log.photoUrl} className="text-xs text-indigo-600" target="_blank" rel="noreferrer">
                      Photo
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={loading}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => investigate('review_logs')}
            >
              Mark logs reviewed
            </button>
          </section>

          <section className="mt-6 rounded-xl border bg-white p-5">
            <h3 className="font-semibold">Determine outcome & compensation</h3>
            <select
              className="mt-3 w-full rounded border px-3 py-2 text-sm"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="found">Item found</option>
              <option value="compensated">Compensated</option>
              <option value="no_action">No action</option>
              <option value="denied">Denied</option>
            </select>
            <textarea
              className="mt-3 w-full rounded border px-3 py-2 text-sm"
              rows={2}
              placeholder="Outcome notes"
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
            />
            <input
              className="mt-3 w-full rounded border px-3 py-2 text-sm"
              type="number"
              placeholder="Compensation ₱"
              value={compensationAmount}
              onChange={(e) => setCompensationAmount(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                className="rounded-lg border px-4 py-2 text-sm"
                onClick={() =>
                  investigate('determine_outcome', {
                    outcome,
                    outcomeNotes,
                    compensationAmount: Number(compensationAmount),
                  })
                }
              >
                Save outcome
              </button>
              <button
                type="button"
                disabled={loading || !!ticket.compensationCreditedAt}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() =>
                  investigate('compensate', {
                    outcome: 'compensated',
                    compensationAmount: Number(compensationAmount),
                  })
                }
              >
                Credit wallet (₱{compensationAmount})
              </button>
            </div>
            {ticket.outcome && ticket.outcome !== 'pending' && (
              <p className="mt-3 text-sm text-green-700">
                Current outcome: {formatLostItemOutcome(ticket.outcome)}
                {ticket.compensationCreditedAt && ' · Wallet credited'}
              </p>
            )}
          </section>

          <section className="mt-6 rounded-xl border bg-white p-5">
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              rows={2}
              placeholder="Admin note (optional)"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {!ticket.investigationStage || ticket.investigationStage === 'complaint' ? (
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
                  onClick={() => investigate('start_investigation')}
                >
                  Start investigation
                </button>
              ) : null}
              <button
                type="button"
                disabled={loading || ticket.status === 'closed'}
                className="rounded-lg border px-4 py-2 text-sm"
                onClick={() => investigate('close')}
              >
                Close ticket
              </button>
            </div>
          </section>
        </>
      )}

      {!isLostItem && (
        <section className="mt-6 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Manage ticket</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={generalStatus}
                onChange={(e) => setGeneralStatus(e.target.value)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Priority</span>
              <select
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={generalPriority}
                onChange={(e) => setGeneralPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm">
            <span className="font-medium text-slate-700">Admin note</span>
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              rows={3}
              placeholder="Internal note for this ticket"
              value={generalAdminNote}
              onChange={(e) => setGeneralAdminNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={loading}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={() => saveGeneralUpdate()}
          >
            Save changes
          </button>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}
