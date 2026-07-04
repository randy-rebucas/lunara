'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PartnerSettingsData, PartnerStaffMember } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { ProcessingPhotoUpload } from '../../../components/processing-photo-upload';
import { OrderHandoffQr } from '../../../components/order-handoff-qr';
import { AuthenticatedImage } from '../../../components/authenticated-image';
import { PageHeader } from '../../../components/ui/page-header';
import { ActionCard, Icon, ICONS, StepIcon } from '../../../components/ui/icon';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { isPartnerRole, partnerFetch } from '../../../lib/partner-api';
import {
  isOrderPreProcessingPhase,
  orderDetailBackHref,
  type PartnerOrderDetailView,
} from '../../../lib/order-processing-phase';
import { usePartnerQuery } from '../../../lib/use-partner-query';
import { usePartnerOrderSocket } from '../../../lib/use-partner-pipeline-socket';

function InfoBanner({
  icon,
  tone,
  title,
  children,
}: {
  icon: string;
  tone: 'amber' | 'accent' | 'slate';
  title: string;
  children?: React.ReactNode;
}) {
  const tones = {
    amber: { wrap: 'border-amber-200 bg-amber-50', iconWrap: 'bg-amber-100 text-amber-700', title: 'text-amber-900', body: 'text-amber-800' },
    accent: { wrap: 'border-accent/30 bg-green-50', iconWrap: 'bg-accent/10 text-accent', title: 'text-accent', body: 'text-slate-600' },
    slate: { wrap: 'border-slate-200 bg-slate-50', iconWrap: 'bg-slate-100 text-slate-600', title: 'text-slate-900', body: 'text-slate-600' },
  }[tone];

  return (
    <div className={`mt-6 rounded-xl border p-5 ${tones.wrap}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones.iconWrap}`}>
          <Icon d={icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${tones.title}`}>{title}</p>
          {children && <div className={`mt-1 text-sm ${tones.body}`}>{children}</div>}
        </div>
      </div>
    </div>
  );
}

export default function StaffOrderProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [tagCode, setTagCode] = useState('');
  const [shelfSlot, setShelfSlot] = useState('');
  const [shelfSaving, setShelfSaving] = useState(false);
  const [shelfError, setShelfError] = useState('');
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
    setTagCode(data.processing?.tagCode ?? '');
    setShelfSlot(data.processing?.shelfSlot ?? '');
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

  async function saveShelfSlot() {
    if (!id || !shelfSlot.trim()) return;
    setShelfSaving(true);
    setShelfError('');
    try {
      await partnerFetch(`/partner/orders/${id}/processing/shelf`, {
        method: 'PATCH',
        body: JSON.stringify({ shelfSlot: shelfSlot.trim() }),
      });
      await reload();
    } catch (e) {
      setShelfError(e instanceof Error ? e.message : 'Could not save shelf slot');
    } finally {
      setShelfSaving(false);
    }
  }

  if (!ready) return <AuthLoading message="Loading order…" />;

  if (pageLoading || loadError || !view) {
    return (
      <div className="mx-auto max-w-2xl">
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
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={view.order.bookingType
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())}
        backHref={backHref}
        backLabel={`Back to ${backLabel}`}
        badge={
          socketLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          ) : undefined
        }
        description={
          <>
            <span className="capitalize">{view.order.status.replace(/_/g, ' ')}</span>
            {' · '}
            <span className="font-semibold text-slate-900">₱{view.order.total}</span>
          </>
        }
      />

      {/* ── Receipt strip ── */}
      {view.order.pickup?.receiptCode && (
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon d={ICONS.receipt} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pickup receipt</p>
            <p className="truncate font-mono text-sm font-semibold text-slate-900">
              {view.order.pickup.receiptCode}
            </p>
          </div>
        </div>
      )}

      {preProcessing && (
        <InfoBanner icon={ICONS.truck} tone="slate" title={view.currentStep.label}>
          {view.currentStep.description ??
            'This order is not in laundry processing yet. Lunara assigns pickup riders from dispatch.'}
        </InfoBanner>
      )}

      {preProcessing && view.order.pickup?.receiptCode && !view.order.pickup?.droppedAtShop && (
        <OrderHandoffQr orderId={view.order._id} receiptCode={view.order.pickup.receiptCode} />
      )}

      {needsReceiving && (
        <InfoBanner icon={ICONS.alert} tone="amber" title="Shop receiving required">
          {view.order.status === 'received_at_shop'
            ? 'Intake complete. Continue in processing below, or reopen receiving.'
            : 'Receive laundry, verify weight, and confirm items before processing.'}
          <Link
            href={`/orders/${id}/receiving`}
            className="touch-manipulation mt-3 inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white active:bg-amber-700"
          >
            Open shop receiving
            <Icon d={ICONS.arrow} className="h-4 w-4" />
          </Link>
        </InfoBanner>
      )}

      {partner && inProcessing && (
        <ActionCard
          icon={ICONS.users}
          title="Assign staff"
          description={
            view.assignedStaffId
              ? 'Staff member is assigned and can process this order.'
              : 'Choose staff before processing begins.'
          }
        >
          <div className="flex flex-wrap gap-3">
            <select
              className="input-field min-h-[2.75rem] flex-1 sm:flex-none"
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
            <button
              type="button"
              disabled={loading || !assignStaffId}
              className="btn-primary min-h-[2.75rem]"
              onClick={assignStaff}
            >
              {view.assignedStaffId ? 'Reassign' : 'Assign'}
            </button>
          </div>
          {staffError && <p className="mt-2 text-sm text-red-500">{staffError}</p>}
        </ActionCard>
      )}

      {needsAccept && (
        <InfoBanner icon={ICONS.alert} tone="amber" title="Accept this job to start processing">
          You must accept before updating status or uploading progress photos.
          <button
            type="button"
            disabled={loading}
            className="mt-3 min-h-[2.75rem] w-full touch-manipulation rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white active:bg-primary/90 disabled:opacity-50 sm:w-auto"
            onClick={acceptJob}
          >
            Accept job
          </button>
        </InfoBanner>
      )}

      {inProcessing && (
        <>
          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>Laundry pipeline progress</span>
            <span className="tabular-nums font-medium text-slate-700">{view.progress}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${view.progress}%` }} />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Click any stage to move this order there directly — useful for correcting a mistake
            or skipping ahead.
          </p>
          {error && (
            <div className="alert-error mt-2 flex items-center gap-2">
              <Icon d={ICONS.alert} className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <ol className="mt-3 space-y-2.5">
            {view.steps.map((step, i) => {
              const done = i < stepIndex || view.isComplete;
              const active = i === stepIndex && !view.isComplete;
              const stepState = done ? 'done' : active ? 'current' : 'upcoming';
              const stepRecord = view.processing?.completedSteps?.find((s) => s.stepId === step.id);
              const clickable = !needsAccept && !active && !loading;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => moveToStep(step.id)}
                    className={`flex w-full touch-manipulation items-start gap-3 rounded-lg border px-4 py-3.5 text-left text-base transition-all duration-200 ${
                      active
                        ? 'border-primary bg-primary/5'
                        : done
                          ? 'border-accent/20 bg-accent/5 opacity-60 hover:opacity-100'
                          : 'border-border/60 bg-white'
                    } ${clickable ? 'cursor-pointer hover:border-primary/50 hover:ring-1 hover:ring-primary/20 active:bg-primary/10 active:ring-2 active:ring-primary/30' : 'cursor-default'}`}
                  >
                    <StepIcon state={stepState} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-slate-900">{step.label}</span>
                      {active && <span className="mt-1 block text-sm text-slate-600">{step.description}</span>}
                      {stepRecord?.photoUrl && (
                        <span className="mt-2 block">
                          <AuthenticatedImage
                            publicPath={stepRecord.photoUrl}
                            alt={`${step.label} photo`}
                            className="max-h-36 rounded-lg border border-border/60 object-cover"
                          />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {inProcessing && !view.isComplete && !needsAccept && id && (
        <ActionCard
          icon={ICONS.camera}
          title={`Mark complete: ${view.currentStep.label}`}
          description={`Completing this stage forwards the order to the next step${view.nextStep ? `: ${view.nextStep.label}` : ''}.`}
        >
          {view.canSkipIroning && view.currentStep.id === 'folding' && (
            <label className="mb-4 flex min-h-[2.75rem] touch-manipulation items-center gap-3 rounded-lg bg-surface-muted px-3 text-sm active:bg-slate-100">
              <input
                type="checkbox"
                checked={skipIroning}
                onChange={(e) => setSkipIroning(e.target.checked)}
                className="h-4 w-4 shrink-0"
              />
              Skip ironing (optional step)
            </label>
          )}

          {view.currentStep.id === 'received' && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-border/60 text-slate-600">
                <Icon d={ICONS.tag} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Laundry tag</p>
                {tagCode ? (
                  <p className="truncate font-mono text-sm font-semibold uppercase text-slate-900">{tagCode}</p>
                ) : (
                  <p className="text-sm text-muted">No tag was scanned at pickup for this order</p>
                )}
              </div>
            </div>
          )}

          <ProcessingPhotoUpload
            orderId={id}
            value={photoUrl}
            onChange={setPhotoUrl}
            disabled={loading}
          />

          <label className="form-label mt-4" htmlFor="processing-note">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="processing-note"
            className="input-field min-h-[5rem]"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button
            type="button"
            disabled={loading}
            className="mt-4 min-h-[3rem] w-full touch-manipulation rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white active:bg-accent/90 disabled:opacity-50"
            onClick={advance}
          >
            {loading ? 'Saving…' : 'Complete stage & forward'}
          </button>
        </ActionCard>
      )}

      {inProcessing &&
        (view.currentStep.id === 'quality_check' ||
          view.currentStep.id === 'ready_for_delivery' ||
          view.isComplete ||
          view.order.status === 'customer_pickup') && (
          <ActionCard
            icon={ICONS.shelf}
            title="Shelf slot"
            description="Assign where this bag sits so staff can trace the owner at a glance."
          >
            <label className="form-label" htmlFor="shelf-slot">
              Slot label
            </label>
            <div className="flex flex-wrap gap-3">
              <input
                id="shelf-slot"
                className="input-field flex-1 font-mono uppercase sm:flex-none"
                placeholder="e.g. A-12"
                value={shelfSlot}
                onChange={(e) => setShelfSlot(e.target.value)}
              />
              <button
                type="button"
                disabled={shelfSaving || !shelfSlot.trim()}
                className="btn-primary min-h-[2.75rem]"
                onClick={saveShelfSlot}
              >
                {shelfSaving ? 'Saving…' : 'Save shelf slot'}
              </button>
            </div>
            {shelfError && <p className="mt-2 text-sm text-red-500">{shelfError}</p>}
          </ActionCard>
        )}

      {view.order.status === 'customer_pickup' && (
        <InfoBanner icon={ICONS.bell} tone="amber" title="Awaiting customer self-collection">
          The customer will come to the shop to collect their laundry. Confirm once they have collected it.
          <button
            type="button"
            disabled={loading}
            className="mt-3 min-h-[2.75rem] w-full touch-manipulation rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white active:bg-accent/90 disabled:opacity-50 sm:w-auto"
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
        </InfoBanner>
      )}

      {inProcessing && view.isComplete && view.order.fulfillmentType !== 'customer_pickup' && canDispatchDelivery && (
        <InfoBanner icon={ICONS.truck} tone="accent" title="Ready for delivery">
          Riders are notified automatically. Re-broadcast if needed.
          <button
            type="button"
            disabled={loading}
            className="mt-3 min-h-[2.75rem] w-full touch-manipulation rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white active:bg-primary/90 disabled:opacity-50 sm:w-auto"
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
          {dispatchMessage && <p className="mt-3 text-sm text-emerald-700">{dispatchMessage}</p>}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </InfoBanner>
      )}

      {inProcessing && view.isComplete && view.order.fulfillmentType !== 'customer_pickup' && !canDispatchDelivery && (
        <InfoBanner icon={ICONS.truck} tone="slate" title="Ready for delivery">
          Your shop partner will request a delivery rider from incoming orders or dispatch.
        </InfoBanner>
      )}
    </div>
  );
}
