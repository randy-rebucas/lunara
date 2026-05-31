'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../../components/ui/page-header';
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

function payoutDetails(row: WithdrawalRow) {
  if (row.gcashNumber) return `GCash ${row.gcashNumber}`;
  if (row.mayaNumber) return `Maya ${row.mayaNumber}`;
  if (row.bankAccountNumber) {
    return `${row.bankName ?? 'Bank'} · ${row.bankAccountName ?? '—'} · ${row.bankAccountNumber}`;
  }
  return '—';
}

export default function RiderWithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

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

  async function review(id: string, action: 'approve' | 'reject') {
    const note =
      action === 'reject'
        ? window.prompt('Rejection note (optional)') ?? undefined
        : window.prompt('Approval note (optional)') ?? undefined;

    setActionId(id);
    setError('');
    try {
      await adminFetch(`/admin/riders/withdrawals/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: note || undefined }),
      });
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

      {error ? <div className="alert-error mt-4">{error}</div> : null}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading pending withdrawals…</p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-xl bg-surface-muted p-6 ring-1 ring-border/60">
          <p className="font-medium text-slate-900">No pending withdrawals</p>
          <p className="mt-1 text-sm text-muted">New rider payout requests will appear here.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl ring-1 ring-border/60">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rider</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Payout details</th>
                <th>Requested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="font-medium">{row.riderName}</td>
                  <td>₱{row.amount.toLocaleString('en-PH')}</td>
                  <td>{row.methodLabel}</td>
                  <td className="max-w-xs truncate text-sm text-muted">{payoutDetails(row)}</td>
                  <td className="text-sm text-muted">
                    {new Date(row.createdAt).toLocaleString('en-PH')}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={actionId === row._id}
                      onClick={() => review(row._id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={actionId === row._id}
                      onClick={() => review(row._id, 'reject')}
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

      <p className="mt-6 text-sm text-muted">
        Approved withdrawals are marked paid and debited from the rider wallet. Process GCash/Maya/bank
        transfers manually outside Lunara.
      </p>
    </div>
  );
}
