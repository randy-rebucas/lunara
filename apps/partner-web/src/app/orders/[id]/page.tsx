'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PartnerSettingsData, PartnerStaffMember } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { ProcessingPhotoUpload } from '../../../components/processing-photo-upload';
import { AuthenticatedImage } from '../../../components/authenticated-image';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { isPartnerRole, partnerFetch } from '../../../lib/partner-api';
import {
  isOrderPreProcessingPhase,
  orderDetailBackHref,
  type PartnerOrderDetailView,
} from '../../../lib/order-processing-phase';
import { usePartnerQuery } from '../../../lib/use-partner-query';
import { usePartnerOrderSocket } from '../../../lib/use-partner-pipeline-socket';

export default function StaffOrderProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [tagCode, setTagCode] = useState('');
  const [skipIroning, setSkipIroning] = useState(false);
  const [error, setError] = useState('');
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<PartnerStaffMember[]>([]);
  const [staffError, setStaffError] = useState('');
  const [assignStaffId, setAssignStaffId] = useState('');
  const [allowStaffDelivery, setAllowStaffDelivery] = useState(true);
  const partner = isPartnerRole();
  const canDispatchDelivery = partner || allowStaffDelivery;
  const backHref = orderDetailBackHref(partner);
  const backLabel = partner ? 'incoming orders' : 'queue';

  const load = useCallback(async () => {
    if (!id) throw new Error('Order not found');
    const data = await partnerFetch<PartnerOrderDetailView>(`/partner/orders/${id}/processing`);
    setSkipIroning(!!data.processing?.ironingSkipped);
    setPhotoUrl('');
    const receivedStep = data.processing?.completedSteps?.find((s) => s.stepId === 'received');
    if (receivedStep?.tagCode) {
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
    if (!ready) return;
    partnerFetch<PartnerSettingsData>('/partner/settings')
      .then((d) => setAllowStaffDelivery(d.settings.allowStaffToRequestDelivery))
      .catch(() => setAllowStaffDelivery(true));
  }, [ready]);

  useEffect(() => {
    if (!partner || !ready) return;
    setStaffError('');
    partnerFetch<PartnerStaffMember[]>('/partner/staff')
      .then(setStaffList)
      .catch((e) => {
        setStaffError(e instanceof Error ? e.message : 'Failed to load staff list');
        setStaffList([]);
      });
  }, [partner, ready]);

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
      await partnerFetch<PartnerOrderDetailView>(`/partner/orders/${id}/processing/accept`, {
        method: 'POST',
      });
      await reload();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setLoading(false);
    }
  }

  async function moveToStep(targetStepId: string) {
    if (!id || !view || targetStepId === view.currentStep.id) return;
    setLoading(true);
    setError('');
    try {
      await partnerFetch<PartnerOrderDetailView>(`/partner/orders/${id}/processing/move`, {
        method: 'POST',
        body: JSON.stringify({ targetStepId }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move to that step');
    } finally {
      setLoading(false);
    }
  }

  async function advance() {
    if (!id || !view) return;
    setLoading(true);
    setError('');
    try {
      await partnerFetch<PartnerOrderDetailView>(`/partner/orders/${id}/processing/advance`, {
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
      setPhotoUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Advance failed');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <AuthLoading message="Loading order…" />;

  if (pageLoading || loadError || !view) {
    return (
      <div>
        <Link href={backHref} className="text-sm text-slate-500 hover:text-primary">
          ← Back to {backLabel}
        </Link>
        <DataPageStatus loading={pageLoading} error={loadError} loadingMessage="Loading order…" />
      </div>
    );
  }

  const preProcessing = isOrderPreProcessingPhase(view);
  const inProcessing = !preProcessing;
  const needsReceiving =
    view.order.status === 'in_transit_to_shop' || view.order.status === 'received_at_shop';
  const stepIndex = inProcessing
    ? view.steps.findIndex((s) => s.id === view.currentStep.id)
    : -1;
  const needsAccept = inProcessing && !view.isJobAccepted;

  return (
    <div>
      <Link
        href={backHref}
        className="touch-manipulation inline-flex items-center py-2 text-sm text-slate-500 hover:text-primary active:text-primary"
      >
        ← Back to {backLabel}
      </Link>

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

      {preProcessing && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-900">{view.currentStep.label}</p>
          <p className="mt-1 text-sm text-slate-600">
            {view.currentStep.description ??
              'This order is not in laundry processing yet. Lunara assigns pickup riders from dispatch.'}
          </p>
        </div>
      )}

      {needsReceiving && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Shop receiving required</p>
          <p className="mt-1 text-sm text-amber-800">
            {view.order.status === 'received_at_shop'
              ? 'Intake complete. Continue in processing below, or reopen receiving.'
              : 'Receive laundry, verify weight, and confirm items before processing.'}
          </p>
          <Link
            href={`/orders/${id}/receiving`}
            className="touch-manipulation mt-3 inline-flex min-h-[3rem] items-center rounded-lg bg-amber-600 px-5 py-3 text-base font-medium text-white active:bg-amber-700"
          >
            Open shop receiving →
          </Link>
        </div>
      )}

      {partner && inProcessing && (
        <div className="card card-body mt-6 !py-5">
          <h3 className="font-semibold">Assign staff</h3>
          <p className="mt-1 text-sm text-slate-500">
            {view.assignedStaffId
              ? 'Staff member is assigned and can process this order.'
              : 'Choose staff before processing begins.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              className="min-h-[3rem] flex-1 touch-manipulation rounded-lg border px-3 py-3 text-base sm:flex-none"
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
              className="btn-primary min-h-[3rem] touch-manipulation px-5 text-base disabled:opacity-50"
              onClick={assignStaff}
            >
              {view.assignedStaffId ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </div>
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
            className="mt-4 min-h-[3rem] w-full touch-manipulation rounded-lg bg-primary px-5 py-3 text-base font-medium text-white active:bg-primary/90 disabled:opacity-50 sm:w-auto"
            onClick={acceptJob}
          >
            Accept job
          </button>
        </div>
      )}

      {inProcessing && (
        <>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-primary transition-all" style={{ width: `${view.progress}%` }} />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Click any stage to move this order there directly — useful for correcting a mistake
            or skipping ahead.
          </p>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

          <ol className="mt-3 space-y-3">
            {view.steps.map((step, i) => {
              const done = i < stepIndex || view.isComplete;
              const active = i === stepIndex && !view.isComplete;
              const stepRecord = view.processing?.completedSteps?.find((s) => s.stepId === step.id);
              const clickable = !needsAccept && !active && !loading;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => moveToStep(step.id)}
                    className={`min-h-[3.5rem] w-full touch-manipulation rounded-lg border px-5 py-4 text-left text-base transition ${
                      active
                        ? 'border-primary bg-primary/5'
                        : done
                          ? 'border-accent/30 bg-green-50'
                          : 'bg-white'
                    } ${clickable ? 'cursor-pointer hover:border-primary/50 hover:ring-1 hover:ring-primary/20 active:bg-primary/10 active:ring-2 active:ring-primary/30' : 'cursor-default'}`}
                  >
                    <span className="font-medium">
                      {done ? '✓ ' : active ? '→ ' : '○ '}
                      {step.label}
                    </span>
                    {active && <p className="mt-1 text-slate-600">{step.description}</p>}
                    {stepRecord?.photoUrl && (
                      <div className="mt-2">
                        <AuthenticatedImage
                          publicPath={stepRecord.photoUrl}
                          alt={`${step.label} photo`}
                          className="max-h-36 rounded-lg border border-border/60 object-cover"
                        />
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {inProcessing && !view.isComplete && !needsAccept && id && (
        <div className="card card-body mt-8">
          <h3 className="font-semibold">Mark complete: {view.currentStep.label}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Completing this stage forwards the order to the next step
            {view.nextStep ? `: ${view.nextStep.label}` : ''}.
          </p>

          {view.canSkipIroning && view.currentStep.id === 'folding' && (
            <label className="mt-4 flex min-h-[3rem] touch-manipulation items-center gap-3 text-base active:bg-slate-50">
              <input
                type="checkbox"
                checked={skipIroning}
                onChange={(e) => setSkipIroning(e.target.checked)}
                className="h-5 w-5 shrink-0"
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
                className="mt-2 min-h-[3rem] w-full touch-manipulation rounded border px-4 py-3 text-base font-mono uppercase"
                placeholder="e.g. LNR-1042"
                value={tagCode}
                onChange={(e) => setTagCode(e.target.value)}
              />
            </div>
          )}

          <ProcessingPhotoUpload
            orderId={id}
            value={photoUrl}
            onChange={setPhotoUrl}
            disabled={loading}
          />

          <textarea
            className="mt-4 min-h-[5rem] w-full touch-manipulation rounded border px-4 py-3 text-base"
            placeholder="Notes (optional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button
            type="button"
            disabled={loading}
            className="mt-4 min-h-[3.5rem] w-full touch-manipulation rounded-lg bg-accent px-5 py-4 text-base font-medium text-white active:bg-accent/90 disabled:opacity-50"
            onClick={advance}
          >
            {loading ? 'Saving…' : 'Complete stage & forward'}
          </button>
        </div>
      )}

      {view.order.status === 'customer_pickup' && (
        <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
          <p className="text-lg font-semibold text-amber-900">Awaiting customer self-collection</p>
          <p className="mt-2 text-sm text-amber-800">
            The customer will come to the shop to collect their laundry. Confirm once they have collected it.
          </p>
          <button
            type="button"
            disabled={loading}
            className="mt-4 min-h-[3rem] w-full touch-manipulation rounded-lg bg-accent px-5 py-3 text-base font-medium text-white active:bg-accent/90 disabled:opacity-50 sm:w-auto"
            onClick={async () => {
              if (!id) return;
              setLoading(true);
              setError('');
              try {
                await partnerFetch(`/partner/orders/${id}/customer-pickup/complete`, { method: 'POST' });
                await reload();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to confirm collection');
              } finally {
                setLoading(false);
              }
            }}
          >
            Confirm customer collected
          </button>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {inProcessing && view.isComplete && view.order.fulfillmentType !== 'customer_pickup' && canDispatchDelivery && (
        <div className="mt-8 rounded-xl border border-accent bg-green-50 p-6 text-center">
          <p className="text-lg font-semibold text-accent">Ready for delivery</p>
          <p className="mt-2 text-sm text-slate-600">
            Riders are notified automatically. Re-broadcast if needed.
          </p>
          <button
            type="button"
            disabled={loading}
            className="mt-4 min-h-[3rem] w-full touch-manipulation rounded-lg bg-primary px-5 py-3 text-base text-white active:bg-primary/90 disabled:opacity-50 sm:w-auto"
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
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {inProcessing && view.isComplete && view.order.fulfillmentType !== 'customer_pickup' && !canDispatchDelivery && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-lg font-semibold text-slate-900">Ready for delivery</p>
          <p className="mt-2 text-sm text-slate-600">
            Your shop partner will request a delivery rider from incoming orders or dispatch.
          </p>
        </div>
      )}
    </div>
  );
}
