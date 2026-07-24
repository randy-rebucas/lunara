'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { LOST_ITEM_FLOW, formatLostItemOutcome, lostItemFlowIndex } from '@lunara/utils';
import { DetailPageHeader } from '../../../components/detail-page-header';
import { DataPageStatus } from '../../../components/data-page-status';
import { AuthenticatedImage } from '../../../components/authenticated-image';
import { DetailRow, OpsPanel } from '../../../components/ui/ops-panel';
import { adminFetch } from '../../../lib/admin-api';
import { formatSlugLabel } from '../../../lib/format-label';
import { formatPeso } from '../../../lib/format-peso';
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
    shelfSlot?: string;
  } | null;
  photos: { source: string; label: string; url: string; at?: string }[];
  laundryLogs: {
    kind: string;
    label: string;
    at?: string;
    note?: string;
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
        <DetailPageHeader
          backHref="/support"
          backLabel="Tickets"
          eyebrow="Customer success"
          title="Support ticket"
        />
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
      <DetailPageHeader
        backHref="/support"
        backLabel="Tickets"
        eyebrow="Customer success"
        title={ticket.subject}
        description={
          <>
            {ticket.customerEmail ?? 'No email'} ·{' '}
            <span className="capitalize">{formatSlugLabel(ticket.status)}</span>
            {isLostItem ? ` · ${formatSlugLabel(ticket.type)}` : ''}
          </>
        }
        actions={
          ticket.orderId ? (
            <Link href={`/orders/${ticket.orderId}`} className="btn-outline btn-sm">
              Order ops
            </Link>
          ) : undefined
        }
      />

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      <OpsPanel title="Ticket details">
        <p className="text-sm text-slate-700">{ticket.description}</p>
        {ticket.missingItems && ticket.missingItems.length > 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            Missing: {ticket.missingItems.join(', ')}
          </p>
        ) : null}
      </OpsPanel>

      {isLostItem ? (
        <div className="mt-4 space-y-4">
          <OpsPanel title="Investigation flow">
            <ol className="space-y-2">
              {LOST_ITEM_FLOW.map((step, i) => {
                const done = i < stageIdx || ticket.status === 'closed';
                const active = i === stageIdx;
                return (
                  <li
                    key={step.id}
                    className={`rounded-lg border px-4 py-2 text-sm ${
                      active
                        ? 'border-primary/40 bg-primary/5 font-medium text-primary'
                        : done
                          ? 'border-emerald-200/80 bg-emerald-50/50 text-emerald-900'
                          : 'border-border/60 bg-surface text-muted'
                    }`}
                  >
                    {done ? '✓ ' : active ? '→ ' : '○ '}
                    {step.label}
                  </li>
                );
              })}
            </ol>
          </OpsPanel>

          {data.order ? (
            <OpsPanel
              title="Linked order"
              headerAction={
                data.ticket.orderId ? (
                  <Link href={`/orders/${data.ticket.orderId}`} className="link-primary text-xs font-medium">
                    Open order ops →
                  </Link>
                ) : undefined
              }
            >
              <dl>
                <DetailRow
                  label="Service"
                  value={<span className="capitalize">{formatSlugLabel(data.order.bookingType)}</span>}
                />
                <DetailRow label="Total" value={formatPeso(data.order.total)} />
                <DetailRow
                  label="Status"
                  value={<span className="capitalize">{formatSlugLabel(data.order.status)}</span>}
                />
                {data.order.shelfSlot ? (
                  <DetailRow label="Shelf slot" value={data.order.shelfSlot} />
                ) : null}
                {data.order.pickupReceipt ? (
                  <DetailRow label="Pickup receipt" value={data.order.pickupReceipt} />
                ) : null}
                {data.order.deliveryReceipt ? (
                  <DetailRow label="Delivery receipt" value={data.order.deliveryReceipt} />
                ) : null}
              </dl>
            </OpsPanel>
          ) : null}

          <OpsPanel title="Review photos">
            {data.photos.length === 0 ? (
              <p className="text-sm text-muted">No photos on file for this order.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {data.photos.map((p, i) => (
                  <li key={i} className="rounded-lg border border-border/60 p-3">
                    <p className="font-medium text-slate-900">{p.label}</p>
                    <p className="text-xs text-muted">{p.source}</p>
                    <AuthenticatedImage
                      publicPath={p.url}
                      alt={p.label}
                      className="mt-2 max-h-48 w-full rounded border border-border/60 object-cover"
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="dc-form-actions mt-4">
              <button
                type="button"
                disabled={loading}
                className="btn-primary btn-sm disabled:opacity-50"
                onClick={() => investigate('review_photos')}
              >
                Mark photos reviewed
              </button>
            </div>
          </OpsPanel>

          <OpsPanel title="Review laundry logs">
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {data.laundryLogs.map((log, i) => (
                <li key={i} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium capitalize">{log.label}</p>
                  {log.at ? (
                    <p className="text-xs text-muted">{new Date(log.at).toLocaleString()}</p>
                  ) : null}
                  {log.note ? <p className="text-xs text-muted">{log.note}</p> : null}
                  {log.photoUrl ? (
                    <div className="mt-2">
                      <AuthenticatedImage
                        publicPath={log.photoUrl}
                        alt={`${log.label} photo`}
                        className="max-h-32 rounded border object-cover"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="dc-form-actions mt-4">
              <button
                type="button"
                disabled={loading}
                className="btn-primary btn-sm disabled:opacity-50"
                onClick={() => investigate('review_logs')}
              >
                Mark logs reviewed
              </button>
            </div>
          </OpsPanel>

          <OpsPanel title="Outcome & compensation">
            <div className="dc-form-grid max-w-xl">
              <div className="sm:col-span-2">
                <label htmlFor="outcome" className="form-label">
                  Outcome
                </label>
                <select
                  id="outcome"
                  className="input-field"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="found">Item found</option>
                  <option value="compensated">Compensated</option>
                  <option value="no_action">No action</option>
                  <option value="denied">Denied</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="outcome-notes" className="form-label">
                  Outcome notes
                </label>
                <textarea
                  id="outcome-notes"
                  className="input-field min-h-20"
                  rows={2}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="compensation" className="form-label">
                  Compensation
                </label>
                <input
                  id="compensation"
                  className="input-field"
                  type="number"
                  value={compensationAmount}
                  onChange={(e) => setCompensationAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="dc-form-actions mt-4">
              <button
                type="button"
                disabled={loading}
                className="btn-outline btn-sm"
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
                className="btn-primary btn-sm disabled:opacity-50"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Credit ${formatPeso(Number(compensationAmount))} to the customer's wallet? This cannot be undone.`,
                    )
                  ) {
                    return;
                  }
                  investigate('compensate', {
                    outcome: 'compensated',
                    compensationAmount: Number(compensationAmount),
                  });
                }}
              >
                Credit wallet ({formatPeso(Number(compensationAmount))})
              </button>
            </div>
            {ticket.outcome && ticket.outcome !== 'pending' ? (
              <p className="mt-3 text-sm text-emerald-700">
                Current outcome: {formatLostItemOutcome(ticket.outcome)}
                {ticket.compensationCreditedAt ? ' · Wallet credited' : ''}
              </p>
            ) : null}
          </OpsPanel>

          <OpsPanel title="Investigation actions">
            <label htmlFor="investigation-note" className="form-label">
              Admin note
            </label>
            <textarea
              id="investigation-note"
              className="input-field min-h-20"
              rows={2}
              placeholder="Optional note for timeline"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
            <div className="dc-form-actions mt-4">
              {!ticket.investigationStage || ticket.investigationStage === 'complaint' ? (
                <button
                  type="button"
                  disabled={loading}
                  className="btn-primary btn-sm"
                  onClick={() => investigate('start_investigation')}
                >
                  Start investigation
                </button>
              ) : null}
              <button
                type="button"
                disabled={loading || ticket.status === 'closed'}
                className="btn-outline btn-sm"
                onClick={() => investigate('close')}
              >
                Close ticket
              </button>
            </div>
          </OpsPanel>
        </div>
      ) : (
        <OpsPanel title="Manage ticket" className="mt-4">
          <div className="dc-form-grid max-w-xl">
            <div>
              <label htmlFor="ticket-status" className="form-label">
                Status
              </label>
              <select
                id="ticket-status"
                className="input-field"
                value={generalStatus}
                onChange={(e) => setGeneralStatus(e.target.value)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label htmlFor="ticket-priority" className="form-label">
                Priority
              </label>
              <select
                id="ticket-priority"
                className="input-field"
                value={generalPriority}
                onChange={(e) => setGeneralPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="general-admin-note" className="form-label">
                Admin note
              </label>
              <textarea
                id="general-admin-note"
                className="input-field min-h-24"
                rows={3}
                placeholder="Internal note for this ticket"
                value={generalAdminNote}
                onChange={(e) => setGeneralAdminNote(e.target.value)}
              />
            </div>
          </div>
          <div className="dc-form-actions mt-4">
            <button
              type="button"
              disabled={loading}
              className="btn-primary btn-sm disabled:opacity-50"
              onClick={() => saveGeneralUpdate()}
            >
              Save changes
            </button>
          </div>
        </OpsPanel>
      )}
    </div>
  );
}
