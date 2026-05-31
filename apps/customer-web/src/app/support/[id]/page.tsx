'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { LOST_ITEM_FLOW, formatLostItemOutcome, lostItemFlowIndex } from '@lunara/utils';
import { ButtonLink } from '../../../components/ui/button-link';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../components/auth-loading';
import { PageShell } from '../../../components/page-shell';
import { DataPageStatus } from '../../../components/data-page-status';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';

interface Ticket {
  _id: string;
  subject: string;
  description: string;
  status: string;
  type: string;
  orderId?: string;
  missingItems?: string[];
  investigationStage?: string;
  outcome?: string;
  compensationAmount?: number;
  compensationCreditedAt?: string;
  timeline?: { stage: string; label: string; at: string; note?: string }[];
}

interface TicketData {
  ticket: Ticket;
  currentStage: string;
}

export default function CustomerTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });

  const load = useCallback(async () => {
    if (!id) throw new Error('Ticket not found');
    const res = await api.get<{ ticket: Ticket; investigation: { currentStage: string } | null }>(
      `/support/tickets/${id}`,
    );
    return {
      ticket: res.data.ticket,
      currentStage: res.data.investigation?.currentStage ?? 'complaint',
    } satisfies TicketData;
  }, [api, id]);

  const { data, loading, error } = useCustomerQuery(load, [ready, api, id]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading ticket…" />;
  }

  if (loading || error || !data) {
    return (
      <PageShell narrow>
        <Link href="/support" className="text-sm text-muted transition-colors hover:text-primary">
          ← My support tickets
        </Link>
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading ticket…" />
      </PageShell>
    );
  }

  const { ticket, currentStage } = data;
  const stageIdx = lostItemFlowIndex(currentStage);

  return (
    <PageShell narrow>
      <Link href="/support" className="text-sm text-muted transition-colors hover:text-primary">
        ← My support tickets
      </Link>
        <h1 className="mt-4 text-2xl font-bold">{ticket.subject}</h1>
        <p className="mt-1 text-sm capitalize text-slate-500">
          Status: {ticket.status.replace(/_/g, ' ')}
        </p>

        {ticket.type === 'lost_item' && (
          <>
            <ol className="mt-8 list-stack">
              {LOST_ITEM_FLOW.map((step, i) => {
                const done = i < stageIdx || ticket.status === 'closed';
                const active = i === stageIdx && ticket.status !== 'closed';
                return (
                  <li
                    key={step.id}
                    className={`rounded-lg px-4 py-3 text-sm ring-1 ${
                      active ? 'ring-2 ring-primary/30 bg-primary/5' : done ? 'bg-accent/5 ring-accent/20' : 'bg-surface ring-border/40'
                    }`}
                  >
                    <span className="font-medium">
                      {done ? '✓ ' : active ? '→ ' : '○ '}
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {ticket.outcome && ticket.outcome !== 'pending' && (
              <div className="mt-6 rounded-xl bg-accent/5 p-4 ring-1 ring-accent/20">
                <p className="font-medium text-accent">Outcome: {formatLostItemOutcome(ticket.outcome)}</p>
                {(ticket.compensationAmount ?? 0) > 0 && (
                  <p className="mt-1 text-sm text-slate-600">
                    Compensation: ₱{ticket.compensationAmount}
                    {ticket.compensationCreditedAt ? ' (credited to wallet)' : ''}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="panel mt-6 text-sm text-slate-700">
          <p className="font-medium">Your report</p>
          <p className="mt-2">{ticket.description}</p>
          {ticket.missingItems && ticket.missingItems.length > 0 && (
            <p className="mt-2 text-slate-500">Items: {ticket.missingItems.join(', ')}</p>
          )}
        </div>

        {ticket.timeline && ticket.timeline.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-slate-700">Updates</p>
            <ul className="mt-2 list-stack-sm text-sm text-slate-600">
              {ticket.timeline.map((e, i) => (
                <li key={i}>
                  {new Date(e.at).toLocaleString()} — {e.label}
                  {e.note ? `: ${e.note}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 btn-row">
          <ButtonLink href="/support" variant="outline">
            All tickets
          </ButtonLink>
          {ticket.orderId && (
            <ButtonLink href={`/orders/${ticket.orderId}`} variant="ghost">
              View order
            </ButtonLink>
          )}
        </div>
    </PageShell>
  );
}
