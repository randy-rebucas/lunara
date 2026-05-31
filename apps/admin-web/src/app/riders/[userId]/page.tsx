'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { resolveApiV1BaseUrl } from '@lunara/utils';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { adminFetch } from '../../../lib/admin-api';
import { useAdminQuery } from '../../../lib/use-admin-query';

const API_ORIGIN = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL).replace(/\/api\/v1$/, '');

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
}

function docLabel(type: string) {
  return type.replace(/_/g, ' ');
}

export default function RiderProfileReviewPage() {
  const { userId } = useParams<{ userId: string }>();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [rejectType, setRejectType] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');

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

  const name =
    data?.firstName || data?.lastName
      ? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim()
      : (data?.user?.email ?? userId);

  return (
    <div>
      <PageHeader
        title={name ?? 'Rider profile'}
        description="Review rider profile details and KYC documents."
      />
      <Link href="/riders" className="text-sm font-medium text-primary hover:underline">
        ← Back to riders
      </Link>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading rider profile…" />
      </div>

      {actionError ? <p className="mt-4 text-sm text-destructive">{actionError}</p> : null}

      {data ? (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card card-body space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">Profile</h3>
              <p className="text-sm">
                <span className="text-muted">Email:</span> {data.user?.email ?? '—'}
              </p>
              <p className="text-sm">
                <span className="text-muted">Phone:</span> {data.user?.phone ?? '—'}
              </p>
              <p className="text-sm">
                <span className="text-muted">Vehicle:</span> {data.vehicleType ?? '—'} · Plate{' '}
                {data.plateNumber ?? '—'} · OR/CR {data.orCrNumber ?? '—'}
              </p>
              <p className="text-sm">
                <span className="text-muted">Home:</span>{' '}
                {data.homeAddress?.line1
                  ? `${data.homeAddress.line1}${data.homeAddress.line2 ? `, ${data.homeAddress.line2}` : ''}, ${data.homeAddress.city ?? ''}, ${data.homeAddress.province ?? ''} ${data.homeAddress.postalCode ?? ''}`
                  : '—'}
              </p>
              <p className="text-sm">
                <span className="text-muted">Status:</span>{' '}
                {data.compliance?.verificationStatus ?? 'incomplete'}
                {data.compliance?.profileGaps?.length ? (
                  <span className="block text-muted">
                    Missing: {data.compliance.profileGaps.join(', ')}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="card card-body">
              <h3 className="text-lg font-semibold text-slate-900">Compliance</h3>
              <p className="mt-2 text-sm text-muted">
                {data.compliance?.isCompliant
                  ? 'Rider can go online.'
                  : 'Rider cannot go online until profile and documents are complete.'}
              </p>
              {data.compliance?.documentGaps?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                  {data.compliance.documentGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(data.documents ?? []).map((doc) => {
                const imageUrl = doc.fileUrl ? `${API_ORIGIN}${doc.fileUrl}` : null;
                const reviewing = busyType === doc.type;

                return (
                  <div key={doc.type} className="card card-body space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-medium capitalize text-slate-900">{docLabel(doc.type)}</h4>
                      <span className="badge-primary">{doc.status ?? 'missing'}</span>
                    </div>

                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={doc.type}
                        className="h-48 w-full rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-muted">
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
                          className="btn btn-accent btn-sm"
                          disabled={reviewing}
                          onClick={() => reviewDocument(doc.type, 'approved')}
                        >
                          {reviewing ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
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
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <textarea
                          className="input min-h-20 w-full"
                          placeholder="Rejection reason (required)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-destructive btn-sm"
                            disabled={reviewing || !rejectReason.trim()}
                            onClick={() => reviewDocument(doc.type, 'rejected', rejectReason.trim())}
                          >
                            Confirm reject
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
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
          </div>
        </>
      ) : null}
    </div>
  );
}
