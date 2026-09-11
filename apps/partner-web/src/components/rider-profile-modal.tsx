'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { PartnerOwnedRider } from '@lunara/types';
import {
  getOwnedRiderPayoutMethod,
  removeOwnedRider,
  resolveMediaUrl,
  reviewOwnedRiderDocument,
  updateOwnedRider,
  updateOwnedRiderEmployment,
  updateOwnedRiderPayoutMethod,
  uploadOwnedRiderDocument,
} from '../lib/partner-api';

const DOCUMENT_TYPES: { type: string; label: string }[] = [
  { type: 'drivers_license', label: "Driver's License" },
  { type: 'or_cr', label: 'OR/CR' },
  { type: 'nbi_clearance', label: 'NBI Clearance' },
  { type: 'selfie', label: 'Selfie Verification' },
];

function DocumentStatusPill({ status }: { status?: string }) {
  if (!status) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Not uploaded</span>;
  }
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function EmploymentStatusPill({ status }: { status?: string }) {
  const styles: Record<string, string> = {
    onboarding: 'bg-amber-100 text-amber-700',
    active: 'bg-emerald-100 text-emerald-700',
    suspended: 'bg-orange-100 text-orange-700',
    terminated: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles[status ?? 'onboarding'] ?? 'bg-slate-100 text-slate-600'}`}>
      {status ?? 'onboarding'}
    </span>
  );
}

export function RiderProfileModal({
  rider,
  onClose,
  onSaved,
}: {
  rider: PartnerOwnedRider;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [firstName, setFirstName] = useState(rider.firstName ?? '');
  const [lastName, setLastName] = useState(rider.lastName ?? '');
  const [vehicleType, setVehicleType] = useState(rider.vehicleType ?? 'motorcycle');
  const [plateNumber, setPlateNumber] = useState(rider.plateNumber ?? '');
  const [orCrNumber, setOrCrNumber] = useState(rider.orCrNumber ?? '');
  const [employmentType, setEmploymentType] = useState(rider.employmentType ?? 'independent_contractor');
  const [fixedWageAmount, setFixedWageAmount] = useState(
    rider.fixedWageAmount != null ? String(rider.fixedWageAmount) : '',
  );
  const [wageFrequency, setWageFrequency] = useState(rider.wageFrequency ?? 'weekly');
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const [documents, setDocuments] = useState(rider.documents ?? []);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [reviewingType, setReviewingType] = useState<string | null>(null);
  const [rejectReasonByType, setRejectReasonByType] = useState<Record<string, string>>({});

  const [employmentStatus, setEmploymentStatus] = useState(rider.employmentStatus ?? 'onboarding');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');

  const [payoutMethod, setPayoutMethod] = useState<'gcash' | 'maya' | 'bank'>(rider.payoutMethod ?? 'gcash');
  const [gcashNumber, setGcashNumber] = useState('');
  const [mayaNumber, setMayaNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [payoutConfigured, setPayoutConfigured] = useState(!!rider.payoutMethod);
  const [savingPayout, setSavingPayout] = useState(false);
  const [loadedPayout, setLoadedPayout] = useState(false);

  async function ensurePayoutLoaded() {
    if (loadedPayout) return;
    setLoadedPayout(true);
    try {
      const info = await getOwnedRiderPayoutMethod(rider.userId);
      if (info.method) setPayoutMethod(info.method);
      setGcashNumber(info.gcashNumber ?? '');
      setMayaNumber(info.mayaNumber ?? '');
      setBankName(info.bankName ?? '');
      setBankAccountName(info.bankAccountName ?? '');
      setBankAccountNumber(info.bankAccountNumber ?? '');
      setPayoutConfigured(info.configured);
    } catch (err) {
      // Surface the failure and allow a retry on the next hover — previously this swallowed the
      // error entirely, leaving the payout form silently populated with stale/blank fields with no
      // indication anything went wrong.
      setLoadedPayout(false);
      toast.error(err instanceof Error ? err.message : 'Failed to load payout method');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateOwnedRider(rider.userId, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        vehicleType,
        plateNumber: plateNumber.trim() || undefined,
        orCrNumber: orCrNumber.trim() || undefined,
        employmentType,
        ...(employmentType === 'employee'
          ? {
              fixedWageAmount: fixedWageAmount ? Number(fixedWageAmount) : undefined,
              wageFrequency,
            }
          : {}),
      });
      await onSaved();
      toast.success('Rider updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update rider');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoveError('');
    setRemoving(true);
    try {
      await removeOwnedRider(rider.userId);
      await onSaved();
      toast.success('Rider removed');
      onClose();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Could not remove rider');
    } finally {
      setRemoving(false);
    }
  }

  async function handleUploadDocument(type: string, file: File) {
    setUploadingType(type);
    try {
      const updated = await uploadOwnedRiderDocument(rider.userId, type, file);
      setDocuments(updated.documents ?? []);
      toast.success('Document uploaded — pending review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload document');
    } finally {
      setUploadingType(null);
    }
  }

  async function handleReviewDocument(type: string, status: 'approved' | 'rejected') {
    setReviewingType(type);
    try {
      const updated = await reviewOwnedRiderDocument(rider.userId, type, {
        status,
        rejectionReason: status === 'rejected' ? rejectReasonByType[type]?.trim() : undefined,
      });
      setDocuments(updated.documents ?? []);
      toast.success(status === 'approved' ? 'Document approved' : 'Document rejected');
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not review document');
    } finally {
      setReviewingType(null);
    }
  }

  async function handleSetEmploymentStatus(next: 'active' | 'suspended' | 'onboarding' | 'terminated') {
    if (next === 'suspended' && !window.confirm('Suspend this rider? They will stop receiving new tasks immediately.')) {
      return;
    }
    setActivateError('');
    setActivating(true);
    try {
      const updated = await updateOwnedRiderEmployment(rider.userId, { employmentStatus: next });
      setEmploymentStatus(updated.employmentStatus ?? next);
      toast.success(next === 'active' ? 'Rider activated as employee' : `Rider marked ${next}`);
      await onSaved();
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Could not update employment status');
    } finally {
      setActivating(false);
    }
  }

  async function handleSavePayout() {
    setSavingPayout(true);
    try {
      await updateOwnedRiderPayoutMethod(rider.userId, {
        method: payoutMethod,
        ...(payoutMethod === 'gcash' ? { gcashNumber: gcashNumber.trim() } : {}),
        ...(payoutMethod === 'maya' ? { mayaNumber: mayaNumber.trim() } : {}),
        ...(payoutMethod === 'bank'
          ? {
              bankName: bankName.trim(),
              bankAccountName: bankAccountName.trim(),
              bankAccountNumber: bankAccountNumber.trim(),
            }
          : {}),
      });
      setPayoutConfigured(true);
      toast.success('Payout method saved');
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save payout method');
    } finally {
      setSavingPayout(false);
    }
  }

  const documentsByType = new Map(documents.map((d) => [d.type, d]));
  const allApproved = DOCUMENT_TYPES.every((d) => documentsByType.get(d.type)?.status === 'approved');
  const canActivate = allApproved && payoutConfigured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {rider.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveMediaUrl(rider.avatarUrl)}
                  alt={`${rider.firstName ?? ''} ${rider.lastName ?? ''}`.trim() || 'Rider'}
                  className="h-full w-full object-cover"
                />
              ) : (
                (`${rider.firstName ?? ''}${rider.lastName ?? ''}` || 'R')[0]?.toUpperCase()
              )}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Edit rider</h3>
              <p className="mt-1 text-sm text-muted">{rider.email ?? rider.userId}</p>
            </div>
          </div>
          <EmploymentStatusPill status={employmentStatus} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">First name</span>
            <input
              type="text"
              className="input"
              maxLength={80}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Last name</span>
            <input
              type="text"
              className="input"
              maxLength={80}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Vehicle</span>
            <select className="input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="motorcycle">Motorcycle</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
              <option value="van">Van</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Plate number</span>
            <input
              type="text"
              className="input"
              maxLength={20}
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-900">OR/CR number</span>
          <input
            type="text"
            className="input"
            maxLength={40}
            value={orCrNumber}
            onChange={(e) => setOrCrNumber(e.target.value)}
          />
        </label>

        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-slate-900">Pay setup</p>
          <p className="mt-1 text-xs text-muted">
            This is your own record for how you pay this rider — Lunara does not process their payout.
          </p>
          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Type</span>
            <select
              className="input"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as typeof employmentType)}
            >
              <option value="independent_contractor">Independent contractor</option>
              <option value="employee">Employee</option>
            </select>
          </label>
          {employmentType === 'employee' && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                type="number"
                min={0}
                className="input"
                placeholder="Wage amount"
                value={fixedWageAmount}
                onChange={(e) => setFixedWageAmount(e.target.value)}
              />
              <select
                className="input"
                value={wageFrequency}
                onChange={(e) => setWageFrequency(e.target.value as typeof wageFrequency)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-slate-900">Documents</p>
          <p className="mt-1 text-xs text-muted">
            Upload and review the rider&apos;s compliance documents. All four must be approved before activation.
          </p>
          <div className="mt-3 space-y-3">
            {DOCUMENT_TYPES.map(({ type, label }) => {
              const doc = documentsByType.get(type);
              return (
                <div key={type} className="rounded-lg border border-border/70 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{label}</span>
                    <DocumentStatusPill status={doc?.status} />
                  </div>
                  {doc?.fileUrl && (
                    <a
                      href={resolveMediaUrl(doc.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                    >
                      View uploaded file
                    </a>
                  )}
                  {doc?.status === 'rejected' && doc.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">Reason: {doc.rejectionReason}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="btn-outline btn-sm cursor-pointer">
                      {uploadingType === type ? 'Uploading…' : doc?.fileUrl ? 'Replace file' : 'Upload file'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingType === type}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUploadDocument(type, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {doc?.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn-sm rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                          disabled={reviewingType === type}
                          onClick={() => void handleReviewDocument(type, 'approved')}
                        >
                          Approve
                        </button>
                        <input
                          type="text"
                          placeholder="Rejection reason"
                          className="input h-8 w-40 text-xs"
                          value={rejectReasonByType[type] ?? ''}
                          onChange={(e) =>
                            setRejectReasonByType((prev) => ({ ...prev, [type]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="btn-sm rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                          disabled={reviewingType === type || !rejectReasonByType[type]?.trim()}
                          onClick={() => void handleReviewDocument(type, 'rejected')}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border p-3" onMouseEnter={() => void ensurePayoutLoaded()}>
          <p className="text-sm font-medium text-slate-900">Payout method</p>
          <p className="mt-1 text-xs text-muted">Required before this rider can be activated as an employee.</p>
          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Method</span>
            <select
              className="input"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value as typeof payoutMethod)}
            >
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="bank">Bank</option>
            </select>
          </label>
          {payoutMethod === 'gcash' && (
            <input
              type="text"
              className="input mt-2"
              placeholder="GCash number"
              value={gcashNumber}
              onChange={(e) => setGcashNumber(e.target.value)}
            />
          )}
          {payoutMethod === 'maya' && (
            <input
              type="text"
              className="input mt-2"
              placeholder="Maya number"
              value={mayaNumber}
              onChange={(e) => setMayaNumber(e.target.value)}
            />
          )}
          {payoutMethod === 'bank' && (
            <div className="mt-2 grid gap-2">
              <input
                type="text"
                className="input"
                placeholder="Bank name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder="Account name"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder="Account number"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </div>
          )}
          <button
            type="button"
            className="btn-outline btn-sm mt-2"
            disabled={savingPayout}
            onClick={() => void handleSavePayout()}
          >
            {savingPayout ? 'Saving…' : 'Save payout method'}
          </button>
          {payoutConfigured && <span className="ml-2 text-xs text-emerald-700">Configured</span>}
        </div>

        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-slate-900">Employment status</p>
          <p className="mt-1 text-xs text-muted">
            {canActivate
              ? 'All requirements met — ready to activate.'
              : 'Approve all four documents and set a payout method before activating.'}
          </p>
          {activateError && <p className="mt-2 text-sm text-red-700">{activateError}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {employmentStatus !== 'active' && (
              <button
                type="button"
                className="btn-sm rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={activating || !canActivate}
                onClick={() => void handleSetEmploymentStatus('active')}
              >
                {activating ? 'Activating…' : 'Activate as employee'}
              </button>
            )}
            {employmentStatus === 'active' && (
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={activating}
                onClick={() => void handleSetEmploymentStatus('suspended')}
              >
                Suspend
              </button>
            )}
            {employmentStatus === 'suspended' && (
              <button
                type="button"
                className="btn-sm rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={activating}
                onClick={() => void handleSetEmploymentStatus('active')}
              >
                Reinstate
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700">Remove rider</p>
          <p className="mt-1 text-xs text-red-600">
            {confirmingRemove
              ? 'This will deactivate their account. This cannot be undone from here.'
              : 'They will no longer be able to sign in or be assigned tasks.'}
          </p>
          {removeError && <p className="mt-2 text-sm text-red-700">{removeError}</p>}
          <div className="mt-2 flex gap-2">
            {confirmingRemove ? (
              <>
                <button
                  type="button"
                  className="btn-sm rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                  disabled={removing}
                  onClick={() => void handleRemove()}
                >
                  {removing ? 'Removing…' : 'Confirm remove'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={removing}
                  onClick={() => setConfirmingRemove(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn-outline btn-sm" onClick={() => setConfirmingRemove(true)}>
                Remove rider
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
