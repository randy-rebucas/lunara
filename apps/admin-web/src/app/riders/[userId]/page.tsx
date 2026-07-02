'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { AuthenticatedImage } from '../../../components/authenticated-image';
import { DetailPageHeader } from '../../../components/detail-page-header';
import { DataPageStatus } from '../../../components/data-page-status';
import { MetricCell } from '../../../components/datacenter/metric-cell';
import { OpsPanel } from '../../../components/ui/ops-panel';
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

function statusBadge(status?: string) {
  if (status === 'approved' || status === 'verified') return 'badge-accent';
  if (status === 'rejected') return 'badge-danger';
  if (status === 'pending' || status === 'pending_review') return 'badge-warning';
  return 'badge-neutral';
}

function remittanceStatusBadge(status: string) {
  if (status === 'remitted') return 'badge-accent';
  if (status === 'pending_verification') return 'badge-warning';
  return 'badge-primary';
}

type RiderComplianceState = 'compliant' | 'pending' | 'non_compliant';

function deriveComplianceState(compliance?: RiderProfileData['compliance']): RiderComplianceState {
  if (!compliance) return 'non_compliant';
  if (compliance.isCompliant && compliance.verificationStatus === 'verified') return 'compliant';
  if (compliance.verificationStatus === 'pending_review' || compliance.verificationStatus === 'pending') return 'pending';
  return 'non_compliant';
}

const complianceCopy: Record<RiderComplianceState, { label: string; detail: string; dot: string; bar: string }> = {
  compliant:     { label: 'Rider compliant',      detail: 'All documents verified. Rider can go online.',                       dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',  bar: 'border-emerald-500/30 bg-emerald-950/5'  },
  pending:       { label: 'Verification pending',  detail: 'Documents submitted and awaiting admin review.',                     dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',    bar: 'border-amber-500/35 bg-amber-950/5'      },
  non_compliant: { label: 'Not compliant',         detail: 'Profile or document gaps prevent the rider from going online.',      dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',       bar: 'border-red-500/35 bg-red-950/5'          },
};

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
              {data.isOnline !== undefined && (
                <span className={`inline-flex items-center gap-1.5 ${data.isOnline ? 'badge-accent' : 'badge-neutral'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${data.isOnline ? 'bg-accent' : 'bg-slate-400'}`} aria-hidden />
                  {data.isOnline ? 'Online' : 'Offline'}
                </span>
              )}
              {data.isActive === false && <span className="badge-danger">Inactive</span>}
            </div>
          ) : undefined
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading rider profile…" />

      {actionError && (
        <div className="alert-error mb-4" role="alert">{actionError}</div>
      )}

      {data && (() => {
        const complianceState = deriveComplianceState(data.compliance);
        const complianceBanner = complianceCopy[complianceState];
        return (
        <div className="space-y-4">

          {/* ── Compliance state banner ── */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${complianceBanner.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${complianceBanner.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{complianceBanner.label}</p>
              <p className="text-xs text-muted">{complianceBanner.detail}</p>
            </div>
            {data.compliance && (
              <span className={statusBadge(data.compliance.verificationStatus)}>
                {formatSlugLabel(data.compliance.verificationStatus)}
              </span>
            )}
          </div>

          {/* ── Metric row ── */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell
              label="Today's earnings"
              value={formatPeso(data.todayEarnings ?? 0)}
              sub="since midnight"
            />
            <MetricCell
              label="Total earnings"
              value={formatPeso(data.totalEarnings ?? 0)}
              sub="lifetime"
              highlight="accent"
            />
            <MetricCell
              label="Shift"
              value={data.shiftStatus ? formatSlugLabel(data.shiftStatus) : '—'}
              sub="current shift state"
            />
            <MetricCell
              label="Status"
              value={data.isOnline ? 'Online' : 'Offline'}
              sub={data.isActive === false ? 'account inactive' : 'account active'}
              highlight={data.isOnline ? 'primary' : undefined}
            />
          </div>

          {/* ── Main body: documents left, reference + actions right ── */}
          <div className="grid gap-4 lg:grid-cols-3">

            {/* Left — KYC documents (primary admin action) */}
            <div className="space-y-4 lg:col-span-2">

              <OpsPanel title="KYC Documents" description="Review uploaded identity and vehicle documents">
                {(data.documents ?? []).length === 0 ? (
                  <p className="dc-panel-empty">No documents uploaded.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(data.documents ?? []).map((doc) => {
                      const reviewing = busyType === doc.type;
                      const cardAccent =
                        doc.status === 'approved' || doc.status === 'verified'
                          ? 'border-l-4 border-l-emerald-400'
                          : doc.status === 'rejected'
                            ? 'border-l-4 border-l-red-400'
                            : doc.status === 'pending' || doc.status === 'pending_review'
                              ? 'border-l-4 border-l-amber-400'
                              : '';
                      return (
                        <div key={doc.type} className={`space-y-3 rounded-lg border border-border/60 bg-surface p-4 ${cardAccent}`}>
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-medium text-slate-900">{formatSlugLabel(doc.type)}</h4>
                            <span className={`${statusBadge(doc.status)} capitalize`}>
                              {doc.status ?? 'missing'}
                            </span>
                          </div>

                          {doc.uploadedAt && (
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/70">
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                              {doc.reviewedAt ? ` · Reviewed ${new Date(doc.reviewedAt).toLocaleDateString()}` : ''}
                            </p>
                          )}

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
                            <div className="alert-error text-xs">
                              Rejected: {doc.rejectionReason}
                            </div>
                          )}

                          {doc.fileUrl && doc.status === 'pending' && rejectType !== doc.type && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
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
                                  className="btn-primary btn-sm bg-red-600 hover:bg-red-700"
                                  disabled={reviewing || !rejectReason.trim()}
                                  onClick={() => reviewDocument(doc.type, 'rejected', rejectReason.trim())}
                                >
                                  {reviewing ? 'Saving…' : 'Confirm reject'}
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
                )}
              </OpsPanel>

            </div>

            {/* Right — profile + compliance gaps + wallet operations */}
            <div className="space-y-4">

              {/* Profile info with compliance gaps inline */}
              <OpsPanel title="Profile">
                <dl className="grid grid-cols-2 gap-px bg-border/60">
                  {[
                    { label: 'Email',   value: data.user?.email ?? '—' },
                    { label: 'Phone',   value: data.user?.phone ?? '—' },
                    {
                      label: 'Vehicle',
                      value: data.vehicleType
                        ? `${formatSlugLabel(data.vehicleType)} · ${data.plateNumber ?? '—'}`
                        : '—',
                    },
                    { label: 'OR/CR',   value: data.orCrNumber ?? '—' },
                    {
                      label: 'Address',
                      value: data.homeAddress?.line1
                        ? [data.homeAddress.line1, data.homeAddress.line2, data.homeAddress.city]
                            .filter(Boolean).join(', ')
                        : '—',
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface px-3 py-2.5">
                      <dt className="dc-label">{label}</dt>
                      <dd className="dc-value-sm mt-0.5 text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>

                {data.compliance && (data.compliance.profileGaps?.length || data.compliance.documentGaps?.length) ? (
                  <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
                    {data.compliance.profileGaps?.length ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted/70">Profile gaps</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.compliance.profileGaps.map((gap) => (
                            <span key={gap} className="badge-warning">{gap}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {data.compliance.documentGaps?.length ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted/70">Document gaps</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.compliance.documentGaps.map((gap) => (
                            <span key={gap} className="badge-danger">{gap}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </OpsPanel>

              {/* Wallet operations */}
              <OpsPanel title="Wallet operations">
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted/70">Pending hold</p>
                    <p className="mb-2 text-xs text-muted">Locks this amount from the rider&apos;s withdrawable balance.</p>
                    <div className="flex gap-2">
                      <input
                        id="wallet-hold"
                        type="number"
                        min={0}
                        className="input-field min-w-0 flex-1"
                        placeholder="Amount (₱)"
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
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted/70">Manual credit</p>
                    <div className="space-y-2">
                      <div>
                        <label htmlFor="credit-type" className="form-label">Type</label>
                        <select
                          id="credit-type"
                          className="input-field w-full"
                          value={creditType}
                          onChange={(e) => setCreditType(e.target.value as 'bonus' | 'adjustment')}
                        >
                          <option value="bonus">Bonus</option>
                          <option value="adjustment">Adjustment</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="credit-amount" className="form-label">Amount</label>
                        <input
                          id="credit-amount"
                          type="number"
                          min={1}
                          className="input-field w-full"
                          placeholder="₱0.00"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="credit-note" className="form-label">
                          Note <span className="font-normal text-muted">(optional)</span>
                        </label>
                        <input
                          id="credit-note"
                          className="input-field w-full"
                          placeholder="Reason for credit"
                          value={creditNote}
                          onChange={(e) => setCreditNote(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-primary btn-sm w-full"
                        disabled={walletBusy}
                        onClick={creditEarning}
                      >
                        {walletBusy ? 'Processing…' : 'Apply credit'}
                      </button>
                    </div>
                  </div>
                </div>
              </OpsPanel>

            </div>
          </div>

          {/* ── Cash remittances — custom panel without overflow-hidden so the table can scroll ── */}
          <section className="overflow-x-hidden rounded-lg bg-surface ring-1 ring-border/60">
            <div className="dc-panel-header flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Cash remittances</h2>
                <p className="text-xs text-muted">Cash collected by the rider that must be remitted back to Lunara.</p>
              </div>
              {remittances.length > 1 && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={verifyBusy}
                  onClick={() => verifyRemittances()}
                >
                  {verifyBusy ? 'Processing…' : `Verify all ${remittances.length}`}
                </button>
              )}
            </div>
            <div className="dc-panel-body">
              {remittancesError && (
                <div className="alert-error mb-3" role="alert">{remittancesError}</div>
              )}
              {remittancesLoading ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : remittances.length === 0 ? (
                <p className="dc-panel-empty">No pending remittances.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Stage</th>
                        <th className="text-right">Cash collected</th>
                        <th className="text-right">Offset</th>
                        <th className="text-right">Net to remit</th>
                        <th>Submitted</th>
                        <th>Ref no.</th>
                        <th>Proof</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {remittances.map((r) => (
                        <tr key={r._id}>
                          <td className="font-mono text-xs text-muted">
                            {r.orderId.slice(-6).toUpperCase()}
                          </td>
                          <td className="capitalize">{r.stage}</td>
                          <td className="text-right">{formatPeso(r.cashAmount)}</td>
                          <td className="text-right text-muted">
                            {r.earningOffset > 0 ? `−${formatPeso(r.earningOffset)}` : '—'}
                          </td>
                          <td className="text-right font-semibold">
                            {formatPeso(r.netRemittance)}
                          </td>
                          <td className="text-muted">
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="font-mono text-xs text-slate-700">
                            {r.transactionId ?? '—'}
                          </td>
                          <td>
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
                          <td>
                            <span className={`${remittanceStatusBadge(r.status)} capitalize`}>
                              {formatSlugLabel(r.status)}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
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
              )}
            </div>
          </section>

        </div>
        );
      })()}
    </div>
  );
}
