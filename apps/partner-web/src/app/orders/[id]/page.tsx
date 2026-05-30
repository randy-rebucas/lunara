'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { LaundryProcessingStep } from '@lunara/utils';
import { DataPageStatus } from '../../../components/data-page-status';
import { isPartnerRole, partnerFetch } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';
import { usePartnerOrderSocket } from '../../../lib/use-partner-pipeline-socket';
interface ProcessingView {
  order: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    estimatedWeightKg?: number;
    pickup?: { actualWeightKg?: number; receiptCode?: string };
  };
  currentStep: LaundryProcessingStep;
  nextStep: LaundryProcessingStep | null;
  steps: LaundryProcessingStep[];
  progress: number;
  isComplete: boolean;
  canSkipIroning: boolean;
  isJobAccepted?: boolean;
  assignedStaffId?: string;
  processing?: {
    verifiedWeightKg?: number;
    ironingSkipped?: boolean;
    completedSteps?: { stepId: string; photoUrl?: string; tagCode?: string }[];
  };
}

export default function StaffOrderProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [tagCode, setTagCode] = useState('');
  const [skipIroning, setSkipIroning] = useState(false);
  const [error, setError] = useState('');
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<{ _id: string; email?: string }[]>([]);
  const [staffError, setStaffError] = useState('');
  const [assignStaffId, setAssignStaffId] = useState('');
  const partner = isPartnerRole();

  const load = useCallback(async () => {
    if (!id) throw new Error('Order not found');
    const data = await partnerFetch<ProcessingView>(`/partner/orders/${id}/processing`);
    setSkipIroning(!!data.processing?.ironingSkipped);
    setPhotoUrl('');
    const receivedStep = data.processing?.completedSteps?.find((s) => s.stepId === 'received');
    if (receivedStep && 'tagCode' in receivedStep && receivedStep.tagCode) {
      setTagCode(String(receivedStep.tagCode));
    }
    return data;
  }, [id]);

  const { data: view, loading: pageLoading, error: loadError, reload } = usePartnerQuery(load, [id]);

  const { connected: socketLive } = usePartnerOrderSocket(id, {
    onOrderUpdated: () => {
      void reload();
    },
  });

  useEffect(() => {
    if (!partner) return;
    setStaffError('');
    partnerFetch<{ _id: string; email?: string }[]>('/partner/staff')
      .then(setStaffList)
      .catch((e) => {
        setStaffError(e instanceof Error ? e.message : 'Failed to load staff list');
        setStaffList([]);
      });
  }, [partner]);
  async function assignStaff() {
    if (!id || !assignStaffId) return;
    setLoading(true);
    try {
      await partnerFetch(`/partner/orders/${id}/assign-staff`, {
        method: 'POST',
        body: JSON.stringify({ staffId: assignStaffId }),
      });
      await reload();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setLoading(false);
    }
  }

  async function acceptJob() {
    if (!id) return;
    setLoading(true);
    try {
      await partnerFetch<ProcessingView>(
        `/partner/orders/${id}/processing/accept`,
        { method: 'POST' },
      );
      await reload();
      setError('');    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setLoading(false);
    }
  }

  async function advance() {
    if (!id || !view) return;
    setLoading(true);
    setError('');
    try {
      await partnerFetch<ProcessingView>(`/partner/orders/${id}/processing/advance`, {
        method: 'POST',
        body: JSON.stringify({
          note: note || undefined,
          skipIroning: view.currentStep.id === 'folding' ? skipIroning : undefined,
          photoUrl: photoUrl.trim() || undefined,
          tagCode: view.currentStep.id === 'received' ? tagCode.trim() || undefined : undefined,
        }),
      });
      await reload();
      setNote('');
      setPhotoUrl('');    } catch (e) {
      setError(e instanceof Error ? e.message : 'Advance failed');
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading || loadError || !view) {
    return (
      <div>
        <Link
          href={partner ? '/orders/incoming' : '/orders'}
          className="text-sm text-slate-500 hover:text-primary"
        >
          ← Back to {partner ? 'incoming orders' : 'queue'}
        </Link>
        <DataPageStatus loading={pageLoading} error={loadError} loadingMessage="Loading order…" />
      </div>
    );
  }
  const stepIndex = view.steps.findIndex((s) => s.id === view.currentStep.id);
  const needsAccept = !view.isJobAccepted;
  return (
    <div>
      <Link
        href={partner ? '/orders/incoming' : '/orders'}
        className="text-sm text-slate-500 hover:text-primary"
      >
        ← Back to {partner ? 'incoming orders' : 'queue'}
      </Link>

      {(view.order.status === 'in_transit_to_shop' ||
        view.order.status === 'received_at_shop') && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Shop receiving required</p>
          <p className="mt-1 text-sm text-amber-800">
            {view.order.status === 'received_at_shop'
              ? 'Intake complete. Continue in processing below, or reopen receiving.'
              : 'Receive laundry, verify weight, and confirm items before processing.'}
          </p>
          <Link
            href={`/orders/${id}/receiving`}
            className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white"
          >
            Open shop receiving →
          </Link>
        </div>
      )}

      {partner && (
        <div className="mt-6 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Assign staff</h3>
          <p className="mt-1 text-sm text-slate-500">
            {view.assignedStaffId
              ? 'Staff member is assigned and can process this order.'
              : 'Choose staff before processing begins.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={assignStaffId || view.assignedStaffId || ''}
              onChange={(e) => setAssignStaffId(e.target.value)}
            >
              <option value="">Select staff…</option>
              {staffList.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.email ?? s._id}
                </option>
              ))}
            </select>
            {staffError && <p className="w-full text-sm text-red-500">{staffError}</p>}
            <button
              type="button"
              disabled={loading || !assignStaffId}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={assignStaff}
            >
              {view.assignedStaffId ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </div>
      )}
      <h2 className="mt-4 text-2xl font-bold capitalize">
        {view.order.bookingType.replace(/_/g, ' ')}
        {socketLive ? (
          <span className="ml-3 align-middle rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            ● Live
          </span>
        ) : null}
      </h2>
      <p className="text-sm capitalize text-slate-500">
        Order {view.order.status.replace(/_/g, ' ')} · ₱{view.order.total}
      </p>
      {view.order.pickup?.receiptCode && (
        <p className="mt-1 text-sm text-slate-600">Pickup receipt: {view.order.pickup.receiptCode}</p>
      )}

      {needsAccept && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-medium text-amber-900">Accept this job to start processing</p>
          <p className="mt-1 text-sm text-amber-800">
            You must accept before updating status or uploading progress photos.
          </p>
          <button
            type="button"
            disabled={loading}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            onClick={acceptJob}
          >
            Accept job
          </button>
        </div>
      )}

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${view.progress}%` }}
        />
      </div>

      <ol className="mt-8 space-y-2">
        {view.steps.map((step, i) => {
          const done = i < stepIndex || view.isComplete;
          const active = i === stepIndex && !view.isComplete;
          const stepRecord = view.processing?.completedSteps?.find((s) => s.stepId === step.id);
          return (
            <li
              key={step.id}
              className={`rounded-lg border px-4 py-3 text-sm ${
                active ? 'border-primary bg-indigo-50' : done ? 'border-accent/30 bg-green-50' : 'bg-white'
              }`}
            >
              <span className="font-medium">
                {done ? '✓ ' : active ? '→ ' : '○ '}
                {step.label}
              </span>
              {active && <p className="mt-1 text-slate-600">{step.description}</p>}
              {stepRecord?.photoUrl && (
                <p className="mt-1 truncate text-xs text-slate-500">Photo: {stepRecord.photoUrl}</p>
              )}
            </li>
          );
        })}
      </ol>

      {!view.isComplete && !needsAccept && (
        <div className="mt-8 rounded-xl border bg-white p-6">
          <h3 className="font-semibold">Mark complete: {view.currentStep.label}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Completing this stage forwards the order to the next step
            {view.nextStep ? `: ${view.nextStep.label}` : ''}.
          </p>

          {view.canSkipIroning && view.currentStep.id === 'folding' && (
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipIroning}
                onChange={(e) => setSkipIroning(e.target.checked)}
              />
              Skip ironing (optional step)
            </label>
          )}

          {view.currentStep.id === 'received' && (
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">Laundry tag code</label>
              <p className="text-xs text-slate-500">
                Assign a tag to track this order through the shop pipeline
              </p>
              <input
                className="mt-2 w-full rounded border px-3 py-2 text-sm font-mono uppercase"
                placeholder="e.g. LNR-1042"
                value={tagCode}
                onChange={(e) => setTagCode(e.target.value)}
              />
            </div>
          )}

          <div className="mt-4">            <label className="text-sm font-medium text-slate-700">Progress photo</label>
            <p className="text-xs text-slate-500">
              Paste a photo URL for this stage (dev placeholder until S3 upload is wired)
            </p>
            <input
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
              placeholder="https://storage.lunara.dev/processing/…"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>

          <textarea
            className="mt-4 w-full rounded border px-3 py-2 text-sm"
            placeholder="Notes (optional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          <button
            type="button"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            onClick={advance}
          >
            {loading ? 'Saving…' : `Complete stage & forward`}
          </button>
        </div>
      )}

      {view.isComplete && (
        <div className="mt-8 rounded-xl border border-accent bg-green-50 p-6 text-center">
          <p className="text-lg font-semibold text-accent">Ready for delivery</p>
          <p className="mt-2 text-sm text-slate-600">
            Riders are notified automatically. Re-broadcast if needed.
          </p>
          <button
            type="button"
            disabled={loading}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={async () => {
              if (!id) return;
              setLoading(true);
              setDispatchMessage('');
              setError('');
              try {
                await partnerFetch(`/partner/orders/${id}/delivery/dispatch`, { method: 'POST' });
                setDispatchMessage('Delivery offers sent to online riders.');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to notify riders');
              } finally {
                setLoading(false);
              }
            }}
          >
            Notify delivery riders
          </button>
          {dispatchMessage && <p className="mt-3 text-sm text-green-700">{dispatchMessage}</p>}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}        </div>
      )}
    </div>
  );
}
