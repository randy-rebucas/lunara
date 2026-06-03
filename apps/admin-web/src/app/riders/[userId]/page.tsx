'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { AuthenticatedImage } from '../../../components/authenticated-image';
import { DetailPageHeader } from '../../../components/detail-page-header';
import { DataPageStatus } from '../../../components/data-page-status';
import { DetailRow, OpsPanel } from '../../../components/ui/ops-panel';
import { adminFetch } from '../../../lib/admin-api';
import { formatSlugLabel } from '../../../lib/format-label';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

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

  const load = useCallback(async () => {
    if (!userId) throw new Error('Rider not found');
    return adminFetch<RiderProfileData>(`/admin/riders/${userId}/profile`);
  }, [userId]);

  const { data, loading, error, reload } = useAdminQuery(load, [userId]);

  async function reviewDocument(type: string, status: 'approved' | 'rejected', reason?: string) {
    if (!userId) return;
    setBusyType(type);
    setActionError('');
    try {
      await adminFetch(`/admin/riders/${userId}/documents/${type}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          rejectionReason: reason,
        }),
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
          data?.compliance ? (
            <span className={verificationBadge(data.compliance.verificationStatus)}>
              {formatSlugLabel(data.compliance.verificationStatus)}
            </span>
          ) : undefined
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading rider profile…" />

      {actionError ? (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <OpsPanel title="Profile">
              <dl>
                <DetailRow label="Email" value={data.user?.email ?? '—'} />
                <DetailRow label="Phone" value={data.user?.phone ?? '—'} />
                <DetailRow
                  label="Vehicle"
                  value={
                    data.vehicleType
                      ? `${formatSlugLabel(data.vehicleType)} · ${data.plateNumber ?? '—'}`
                      : '—'
                  }
                />
                <DetailRow label="OR/CR" value={data.orCrNumber ?? '—'} />
                <DetailRow
                  label="Home"
                  value={
                    data.homeAddress?.line1
                      ? `${data.homeAddress.line1}${data.homeAddress.line2 ? `, ${data.homeAddress.line2}` : ''}, ${data.homeAddress.city ?? ''}`
                      : '—'
                  }
                />
                <DetailRow
                  label="Earnings"
                  value={`Today ${formatPeso(data.todayEarnings ?? 0)} · Total ${formatPeso(data.totalEarnings ?? 0)}`}
                />
              </dl>
            </OpsPanel>

            <OpsPanel title="Compliance">
              <p className="text-sm text-muted">
                {data.compliance?.isCompliant
                  ? 'Rider can go online.'
                  : 'Rider cannot go online until profile and documents are complete.'}
              </p>
              {data.compliance?.profileGaps?.length ? (
                <p className="mt-2 text-sm text-muted">
                  Profile gaps: {data.compliance.profileGaps.join(', ')}
                </p>
              ) : null}
              {data.compliance?.documentGaps?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                  {data.compliance.documentGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : null}
            </OpsPanel>
          </div>

          <OpsPanel title="Wallet operations">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="wallet-hold" className="form-label">
                  Set pending hold
                </label>
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
              <div>
                <label htmlFor="credit-amount" className="form-label">
                  Manual credit
                </label>
                <div className="flex flex-wrap gap-2">
                  <select
                    id="credit-type"
                    className="input-field"
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
                    className="input-field min-w-0 flex-1"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                  />
                </div>
                <input
                  id="credit-note"
                  className="input-field mt-2 w-full"
                  placeholder="Optional note"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary btn-sm mt-3"
                  disabled={walletBusy}
                  onClick={creditEarning}
                >
                  Credit earning
                </button>
              </div>
            </div>
          </OpsPanel>

          <OpsPanel title="Documents" description="Review uploaded KYC files">
            <div className="grid gap-4 md:grid-cols-2">
              {(data.documents ?? []).map((doc) => {
                const reviewing = busyType === doc.type;

                return (
                  <div
                    key={doc.type}
                    className="rounded-lg border border-border/60 bg-surface p-4 space-y-3"
                  >
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

                    {doc.rejectionReason ? (
                      <p className="text-sm text-destructive">Rejected: {doc.rejectionReason}</p>
                    ) : null}

                    {doc.fileUrl && doc.status === 'pending' ? (
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
                          onClick={() => {
                            setRejectType(doc.type);
                            setRejectReason('');
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}

                    {rejectType === doc.type ? (
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
                    ) : null}
                  </div>
                );
              })}
            </div>
          </OpsPanel>
        </div>
      ) : null}
    </div>
  );
}
