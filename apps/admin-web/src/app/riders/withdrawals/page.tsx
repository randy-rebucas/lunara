'use client';

import { useCallback, useEffect, useState } from 'react';
import { NoteModal } from '../../../components/note-modal';
import { PageHeader } from '../../../components/ui/page-header';
import { maskPayoutDetails } from '../../../lib/mask-pii';
import { adminFetch } from '../../../lib/admin-api';

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

export default function RiderWithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await adminFetch<WithdrawalRow[]>('/admin/riders/withdrawals?status=pending');
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReview() {
    if (!pendingAction) return;
    setActionId(pendingAction.id);
    setError('');
    try {
      await adminFetch(`/admin/riders/withdrawals/${pendingAction.id}/${pendingAction.action}`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: note.trim() || undefined }),
      });
      setPendingAction(null);
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Rider withdrawals"
        backHref="/riders"
        backLabel="Riders"
        description="Review pending payout requests from riders."
      />

      {error ? (
        <div className="alert-error mt-4" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading pending withdrawals…</p>
      ) : rows.length === 0 ? (
        <div className="card card-body mt-6">
          <p className="font-medium text-slate-900">No pending withdrawals</p>
          <p className="mt-1 text-sm text-muted">New rider payout requests will appear here.</p>
        </div>
      ) : (
        <div className="section-panel mt-6 overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Pending rider withdrawal requests</caption>
            <thead>
              <tr>
                <th scope="col">Rider</th>
                <th scope="col">Amount</th>
                <th scope="col">Method</th>
                <th scope="col">Payout details</th>
                <th scope="col">Requested</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="font-medium">{row.riderName}</td>
                  <td>₱{row.amount.toLocaleString('en-PH')}</td>
                  <td>{row.methodLabel}</td>
                  <td className="max-w-xs truncate text-sm text-muted" title={maskPayoutDetails(row)}>
                    {maskPayoutDetails(row)}
                  </td>
                  <td className="text-sm text-muted">
                    {new Date(row.createdAt).toLocaleString('en-PH')}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={actionId === row._id}
                      onClick={() => {
                        setPendingAction({ id: row._id, action: 'approve' });
                        setNote('');
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={actionId === row._id}
                      onClick={() => {
                        setPendingAction({ id: row._id, action: 'reject' });
                        setNote('');
                      }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      <p className="mt-6 text-sm text-muted">
        Approved withdrawals are marked paid and debited from the rider wallet. Process GCash/Maya/bank
        transfers manually outside Lunara.
      </p>
    </div>
  );
}
