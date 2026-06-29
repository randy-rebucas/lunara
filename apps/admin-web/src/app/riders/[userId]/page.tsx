'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { AuthenticatedImage } from '../../../components/authenticated-image';
import { DetailPageHeader } from '../../../components/detail-page-header';
import { DataPageStatus } from '../../../components/data-page-status';
import { MetricCell } from '../../../components/datacenter/metric-cell';
import { DetailRow, OpsPanel } from '../../../components/ui/ops-panel';
import { adminFetch } from '../../../lib/admin-api';
import { formatSlugLabel } from '../../../lib/format-label';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface CashRemittance {
  _id: string;
  orderId: string;
  stage: string;
  cashAmount: number;
  earningOffset: number;
  netRemittance: number;
  status: string;
  submittedAt?: string;
  remittedAt?: string;
  transactionId?: string;
  proofImageUrl?: string;
}

interface RiderDocument {
  type: string;
  fileUrl?: string;
  status?: string;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

interface RiderProfileData {
  userId: string;
  riderId: string;
  firstName?: string;
  lastName?: string;
  isOnline?: boolean;
  shiftStatus?: string;
  homeAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  } | null;
  vehicleType?: string;
  plateNumber?: string;
  orCrNumber?: string;
  documents?: RiderDocument[];
  compliance?: {
    isCompliant: boolean;
    profileGaps: string[];
    documentGaps: string[];
    verificationStatus: string;
  };
  user?: { email?: string; phone?: string } | null;
  isActive?: boolean;
  totalEarnings?: number;
  todayEarnings?: number;
}

function docLabel(type: string) {
  return formatSlugLabel(type);
}

function verificationBadge(status?: string) {
  if (status === 'verified') return 'badge-accent';
  if (status === 'pending_review') return 'badge-primary';
  return 'badge-neutral';
}

function complianceBadge(status?: string) {
  if (status === 'verified') return 'badge-accent';
  if (status === 'pending_review') return 'badge-primary';
  return 'badge-neutral';
}

export default function RiderProfileReviewPage() {
  const { userId } = useParams<{ userId: string }>();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [rejectType, setRejectType] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [walletHold, setWalletHold] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [creditType, setCreditType] = useState<'bonus' | 'adjustment'>('bonus');
  const [walletBusy, setWalletBusy] = useState(false);
  const [remittances, setRemittances] = useState<CashRemittance[]>([]);
  const [remittancesLoading, setRemittancesLoading] = useState(false);
  const [remittancesError, setRemittancesError] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);

  async function reviewDocument(type: string, status: 'approved' | 'rejected', reason?: string) {
    if (!userId) return;
    setBusyType(type);
    setActionError('');
    try {
      await adminFetch(`/admin/riders/${userId}/documents/${type}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionReason: reason }),
      });
      setRejectType(null);
      setRejectReason('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setBusyType(null);
    }
  }

  async function applyWalletHold() {
    if (!userId) return;
    const pendingHold = Number(walletHold);
    if (Number.isNaN(pendingHold) || pendingHold < 0) {
      setActionError('Enter a valid hold amount');
      return;
    }
    setWalletBusy(true);
    setActionError('');
    try {
      await adminFetch(`/admin/riders/${userId}/wallet/hold`, {
        method: 'POST',
        body: JSON.stringify({ pendingHold }),
      });
      setWalletHold('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Wallet hold failed');
    } finally {
      setWalletBusy(false);
    }
  }

  async function creditEarning() {
    if (!userId) return;
    const amount = Number(creditAmount);
    if (Number.isNaN(amount) || amount < 1) {
      setActionError('Enter a valid credit amount');
      return;
    }
    setWalletBusy(true);
    setActionError('');
    try {
      await adminFetch(`/admin/riders/${userId}/earnings/credit`, {
        method: 'POST',
        body: JSON.stringify({ type: creditType, amount, note: creditNote.trim() || undefined }),
      });
      setCreditAmount('');
      setCreditNote('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Credit failed');
    } finally {
      setWalletBusy(false);
    }
  }

  const loadRemittances = useCallback(async () => {
    if (!userId) return;
    setRemittancesLoading(true);
    setRemittancesError('');
    try {
      const res = await adminFetch<CashRemittance[]>(`/admin/riders/${userId}/cash-remittances`);
      setRemittances((res ?? []).filter((r) => r.status !== 'remitted'));
    } catch (e) {
      setRemittancesError(e instanceof Error ? e.message : 'Failed to load remittances');
    } finally {
      setRemittancesLoading(false);
    }
  }, [userId]);

  const { data, loading, error, reload } = useAdminQuery(
    useCallback(async () => {
      if (!userId) throw new Error('Rider not found');
      const profile = await adminFetch<RiderProfileData>(`/admin/riders/${userId}/profile`);
      void loadRemittances();
      return profile;
    }, [userId, loadRemittances]),
    [userId],
  );

  async function verifyRemittances(ids?: string[]) {
    if (!userId) return;
    setVerifyBusy(true);
    setRemittancesError('');
    try {
      await adminFetch(`/admin/riders/${userId}/cash-remittances/verify`, {
        method: 'POST',
        body: JSON.stringify({ remittanceIds: ids }),
      });
      await loadRemittances();
    } catch (e) {
      setRemittancesError(e instanceof Error ? e.message : 'Verify failed');
    } finally {
      setVerifyBusy(false);
    }
  }

  const name =
    data?.firstName || data?.lastName
      ? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim()
      : (data?.user?.email ?? userId);

  return (
    <div>
      <DetailPageHeader
        backHref="/riders"
        backLabel="Riders"
        eyebrow="Fleet"
        title={name ?? 'Rider profile'}
        description="Review profile, KYC documents, wallet hold, and manual credits."
        actions={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              {data.compliance && (
                <span className={verificationBadge(data.compliance.verificationStatus)}>
                  {formatSlugLabel(data.compliance.verificationStatus)}
                </span>
              )}
              {data.isActive === false && (
                <span className="badge-neutral">Inactive</span>
              )}
            </div>
          ) : undefined
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading rider profile…" />

      {actionError && (
        <div className="alert-error mb-4" role="alert">{actionError}</div>
      )}

      {data && (
        <div className="space-y-4">

          {/* ── Metric row ───────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell
              label="Status"
              value={data.isOnline ? 'Online' : 'Offline'}
              highlight={data.isOnline ? 'primary' : undefined}
            />
            <MetricCell
              label="Shift"
              value={data.shiftStatus ? formatSlugLabel(data.shiftStatus) : '—'}
            />
            <MetricCell
              label="Today's earnings"
              value={formatPeso(data.todayEarnings ?? 0)}
            />
            <MetricCell
              label="Total earnings"
              value={formatPeso(data.totalEarnings ?? 0)}
              highlight="accent"
            />
          </div>

          {/* ── Two-column body ──────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-3">

            {/* Left — profile, compliance, remittances */}
            <div className="space-y-4 lg:col-span-2">

              <OpsPanel title="Profile">
                <dl>
                  <DetailRow label="Email"   value={data.user?.email ?? '—'} />
                  <DetailRow label="Phone"   value={data.user?.phone ?? '—'} />
                  <DetailRow
                    label="Vehicle"
                    value={
                      data.vehicleType
                        ? `${formatSlugLabel(data.vehicleType)} · ${data.plateNumber ?? '—'}`
                        : '—'
                    }
                  />
                  <DetailRow label="OR/CR"   value={data.orCrNumber ?? '—'} />
                  <DetailRow
                    label="Home address"
                    value={
                      data.homeAddress?.line1
                        ? `${data.homeAddress.line1}${data.homeAddress.line2 ? `, ${data.homeAddress.line2}` : ''}, ${data.homeAddress.city ?? ''}`
                        : '—'
                    }
                  />
                </dl>
              </OpsPanel>

              <OpsPanel title="Compliance">
                {data.compliance && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className={complianceBadge(data.compliance.verificationStatus)}>
                      {formatSlugLabel(data.compliance.verificationStatus)}
                    </span>
                    <span className="text-sm text-muted">
                      {data.compliance.isCompliant
                        ? 'Rider can go online.'
                        : 'Cannot go online — profile or documents incomplete.'}
                    </span>
                  </div>
                )}
                {data.compliance?.profileGaps?.length ? (
                  <p className="mt-1 text-sm text-muted">
                    Profile gaps: {data.compliance.profileGaps.join(', ')}
                  </p>
                ) : null}
                {data.compliance?.documentGaps?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    {data.compliance.documentGaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                ) : null}
              </OpsPanel>

              <OpsPanel
                title="Cash remittances"
                description="Cash collected by the rider that must be remitted back to Lunara."
              >
                {remittancesError && (
                  <div className="alert-error mb-3" role="alert">{remittancesError}</div>
                )}
                {remittancesLoading ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : remittances.length === 0 ? (
                  <p className="text-sm text-muted">No pending remittances.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="min-w-full text-sm">
                        <thead className="bg-surface-muted text-xs uppercase text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left">Order</th>
                            <th className="px-3 py-2 text-left">Stage</th>
                            <th className="px-3 py-2 text-right">Cash collected</th>
                            <th className="px-3 py-2 text-right">Earning offset</th>
                            <th className="px-3 py-2 text-right">Net to remit</th>
                            <th className="px-3 py-2 text-left">Submitted</th>
                            <th className="px-3 py-2 text-left">Ref no.</th>
                            <th className="px-3 py-2 text-left">Proof</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 bg-white">
                          {remittances.map((r) => (
                            <tr key={r._id}>
                              <td className="px-3 py-2 font-mono text-xs text-muted">
                                {r.orderId.slice(-6).toUpperCase()}
                              </td>
                              <td className="px-3 py-2 capitalize">{r.stage}</td>
                              <td className="px-3 py-2 text-right">{formatPeso(r.cashAmount)}</td>
                              <td className="px-3 py-2 text-right text-muted">
                                {r.earningOffset > 0 ? `−${formatPeso(r.earningOffset)}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {formatPeso(r.netRemittance)}
                              </td>
                              <td className="px-3 py-2 text-muted">
                                {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-slate-700">
                                {r.transactionId ?? '—'}
                              </td>
                              <td className="px-3 py-2">
                                {r.proofImageUrl ? (
                                  <a href={r.proofImageUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={r.proofImageUrl}
                                      alt="Proof"
                                      className="h-10 w-10 rounded object-cover ring-1 ring-border hover:opacity-80"
                                    />
                                  </a>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className="badge-primary capitalize">{r.status}</span>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="btn-accent btn-sm"
                                  disabled={verifyBusy}
                                  onClick={() => verifyRemittances([r._id])}
                                >
                                  Verify
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {remittances.length > 1 && (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={verifyBusy}
                        onClick={() => verifyRemittances()}
                      >
                        {verifyBusy ? 'Processing…' : `Verify all ${remittances.length} remittances`}
                      </button>
                    )}
                  </div>
                )}
              </OpsPanel>
            </div>

            {/* Right — wallet operations */}
            <div>
              <OpsPanel title="Wallet operations">
                <div className="space-y-5">
                  <div>
                    <label htmlFor="wallet-hold" className="form-label">Set pending hold</label>
                    <div className="flex gap-2">
                      <input
                        id="wallet-hold"
                        type="number"
                        min={0}
                        className="input-field min-w-0 flex-1"
                        value={walletHold}
                        onChange={(e) => setWalletHold(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-outline btn-sm shrink-0"
                        disabled={walletBusy}
                        onClick={applyWalletHold}
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-4">
                    <p className="form-label mb-3">Manual credit</p>
                    <div className="space-y-2">
                      <select
                        id="credit-type"
                        className="input-field w-full"
                        value={creditType}
                        onChange={(e) => setCreditType(e.target.value as 'bonus' | 'adjustment')}
                      >
                        <option value="bonus">Bonus</option>
                        <option value="adjustment">Adjustment</option>
                      </select>
                      <input
                        id="credit-amount"
                        type="number"
                        min={1}
                        className="input-field w-full"
                        placeholder="Amount (₱)"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                      />
                      <input
                        id="credit-note"
                        className="input-field w-full"
                        placeholder="Optional note"
                        value={creditNote}
                        onChange={(e) => setCreditNote(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-primary btn-sm w-full"
                        disabled={walletBusy}
                        onClick={creditEarning}
                      >
                        Credit earning
                      </button>
                    </div>
                  </div>
                </div>
              </OpsPanel>
            </div>
          </div>

          {/* ── Documents (full width) ───────────────────────────── */}
          <OpsPanel title="Documents" description="Review uploaded KYC files">
            <div className="grid gap-4 md:grid-cols-2">
              {(data.documents ?? []).map((doc) => {
                const reviewing = busyType === doc.type;
                return (
                  <div key={doc.type} className="space-y-3 rounded-lg border border-border/60 bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-medium capitalize text-slate-900">{docLabel(doc.type)}</h4>
                      <span className="badge-primary capitalize">{doc.status ?? 'missing'}</span>
                    </div>

                    {doc.fileUrl ? (
                      <AuthenticatedImage
                        publicPath={doc.fileUrl}
                        alt={doc.type}
                        className="h-48 w-full rounded-lg border border-border/60 object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted">
                        Not uploaded
                      </div>
                    )}

                    {doc.rejectionReason && (
                      <p className="text-sm text-destructive">Rejected: {doc.rejectionReason}</p>
                    )}

                    {doc.fileUrl && doc.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-accent btn-sm"
                          disabled={reviewing}
                          onClick={() => reviewDocument(doc.type, 'approved')}
                        >
                          {reviewing ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          disabled={reviewing}
                          onClick={() => { setRejectType(doc.type); setRejectReason(''); }}
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {rejectType === doc.type && (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <label htmlFor={`reject-${doc.type}`} className="form-label">
                          Rejection reason
                        </label>
                        <textarea
                          id={`reject-${doc.type}`}
                          className="input-field min-h-20 w-full"
                          placeholder="Rejection reason (required)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary btn-sm bg-destructive hover:bg-destructive/90"
                            disabled={reviewing || !rejectReason.trim()}
                            onClick={() => reviewDocument(doc.type, 'rejected', rejectReason.trim())}
                          >
                            Confirm reject
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => setRejectType(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </OpsPanel>

        </div>
      )}
    </div>
  );
}
