'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { AuthenticatedImage } from '../../../../components/authenticated-image';
import { DetailPageHeader } from '../../../../components/detail-page-header';
import { DataPageStatus } from '../../../../components/data-page-status';
import { OpsPanel } from '../../../../components/ui/ops-panel';
import { adminFetch } from '../../../../lib/admin-api';
import { formatSlugLabel } from '../../../../lib/format-label';
import { useAdminQuery } from '../../../../lib/use-admin-query';

const DOCUMENT_TYPES = ['businessPermit', 'dtiSecRegistration', 'birCertificate', 'ownerValidId', 'shopPhoto'] as const;

const DOCUMENT_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  businessPermit: 'Business Permit',
  dtiSecRegistration: 'DTI/SEC Registration',
  birCertificate: 'BIR Certificate',
  ownerValidId: "Owner's Valid ID",
  shopPhoto: 'Shop Photo',
};

interface DocumentRecord {
  publicId: string;
  uploadedAt: string;
  fileUrl: string;
}

interface PartnerApplicationDetail {
  _id: string;
  businessName: string;
  ownerFullName: string;
  email: string;
  phone: string;
  businessType: string;
  address: { street: string; barangay: string; cityMunicipality: string; province: string; postalCode: string };
  operations: { dailyCapacityKg: number; serviceRadiusKm: number; operatingHours: string };
  documents: Partial<Record<string, DocumentRecord>>;
  declarationAccepted: boolean;
  message?: string;
  status: string;
  rejectionReason?: string;
  createdAt?: string;
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'badge-accent';
  if (status === 'rejected') return 'badge-danger';
  if (status === 'reviewed') return 'badge-primary';
  return 'badge-warning';
}

export default function PartnerApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data, loading, error, reload } = useAdminQuery(
    useCallback(async () => {
      if (!id) throw new Error('Application not found');
      return adminFetch<PartnerApplicationDetail>(`/partner-applications/${id}`);
    }, [id]),
    [id],
  );

  async function setStatus(status: 'approved' | 'rejected') {
    if (!id) return;
    setActionBusy(true);
    setActionError('');
    try {
      await adminFetch(`/partner-applications/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          rejectionReason: status === 'rejected' ? rejectReason.trim() : undefined,
        }),
      });
      setRejecting(false);
      setRejectReason('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div>
      <DetailPageHeader
        backHref="/applications"
        backLabel="Applications"
        eyebrow="Partner application"
        title={data?.businessName ?? id ?? 'Partner application'}
        description="Review submitted business details and documents."
        actions={data ? <span className={`${statusBadgeClass(data.status)} capitalize`}>{data.status}</span> : undefined}
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading application…" />

      {actionError && (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <OpsPanel title="Documents" description="Uploaded business documents">
              <div className="grid gap-4 sm:grid-cols-2">
                {DOCUMENT_TYPES.map((type) => {
                  const doc = data.documents?.[type];
                  return (
                    <div key={type} className="space-y-2 rounded-lg border border-border/60 bg-surface p-4">
                      <h4 className="font-medium text-slate-900">{DOCUMENT_LABELS[type]}</h4>
                      {doc?.fileUrl ? (
                        <AuthenticatedImage
                          publicPath={doc.fileUrl}
                          alt={DOCUMENT_LABELS[type]}
                          className="h-48 w-full rounded-lg border border-border/60 object-cover"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted">
                          Not uploaded
                        </div>
                      )}
                      {doc?.uploadedAt && (
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/70">
                          Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </OpsPanel>
          </div>

          <div className="space-y-4">
            <OpsPanel title="Business">
              <dl className="grid grid-cols-2 gap-px bg-border/60">
                {[
                  { label: 'Owner', value: data.ownerFullName },
                  { label: 'Email', value: data.email },
                  { label: 'Phone', value: data.phone },
                  { label: 'Business type', value: formatSlugLabel(data.businessType) },
                  {
                    label: 'Address',
                    value: [
                      data.address.street,
                      data.address.barangay,
                      data.address.cityMunicipality,
                      data.address.province,
                      data.address.postalCode,
                    ].filter(Boolean).join(', '),
                  },
                  { label: 'Daily capacity', value: `${data.operations.dailyCapacityKg} kg` },
                  { label: 'Service radius', value: `${data.operations.serviceRadiusKm} km` },
                  { label: 'Operating hours', value: data.operations.operatingHours },
                ].map(({ label, value }) => (
                  <div key={label} className="col-span-2 bg-surface px-3 py-2.5">
                    <dt className="dc-label">{label}</dt>
                    <dd className="dc-value-sm mt-0.5 text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              {data.message && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="dc-label">Message</p>
                  <p className="mt-1 text-sm text-slate-900">{data.message}</p>
                </div>
              )}
              {data.status === 'rejected' && data.rejectionReason && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="dc-label">Rejection reason</p>
                  <p className="mt-1 text-sm text-slate-900">{data.rejectionReason}</p>
                </div>
              )}
            </OpsPanel>

            {data.status === 'pending' || data.status === 'reviewed' ? (
              <OpsPanel title="Decision">
                {!rejecting ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary btn-sm" disabled={actionBusy} onClick={() => setStatus('approved')}>
                      {actionBusy ? 'Saving…' : 'Approve'}
                    </button>
                    <button type="button" className="btn-outline btn-sm" disabled={actionBusy} onClick={() => setRejecting(true)}>
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="reject-reason" className="form-label">
                      Rejection reason
                    </label>
                    <textarea
                      id="reject-reason"
                      className="input-field min-h-20 w-full"
                      placeholder="Rejection reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary btn-sm bg-red-600 hover:bg-red-700"
                        disabled={actionBusy || !rejectReason.trim()}
                        onClick={() => setStatus('rejected')}
                      >
                        {actionBusy ? 'Saving…' : 'Confirm reject'}
                      </button>
                      <button type="button" className="btn-outline btn-sm" onClick={() => setRejecting(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </OpsPanel>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
