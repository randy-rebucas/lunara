'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PartnerReceivingView } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../../../components/auth-loading';
import { PageHeader } from '../../../../components/ui/page-header';
import { ActionCard, Icon, ICONS, StepIcon } from '../../../../components/ui/icon';
import { useProtectedPage } from '../../../../hooks/use-protected-page';
import { isPartnerRole, partnerFetch } from '../../../../lib/partner-api';

export default function ShopReceivingPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });
  const partner = isPartnerRole();
  const [view, setView] = useState<PartnerReceivingView | null>(null);
  const [weight, setWeight] = useState('');
  const [itemCount, setItemCount] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const backHref = partner ? '/orders/incoming' : '/orders';
  const backLabel = partner ? 'Incoming orders' : 'Processing queue';

  const load = useCallback(async () => {
    if (!id) return;
    const data = await partnerFetch<PartnerReceivingView>(`/partner/orders/${id}/receiving`);
    setView(data);
    if (data.shopReceiving?.verifiedWeightKg) {
      setWeight(String(data.shopReceiving.verifiedWeightKg));
    } else if (data.order.estimatedWeightKg) {
      setWeight(String(data.order.estimatedWeightKg));
    } else if (data.order.pickup?.actualWeightKg) {
      setWeight(String(data.order.pickup.actualWeightKg));
    }
    if (data.shopReceiving?.itemCount) setItemCount(String(data.shopReceiving.itemCount));
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [ready, load]);

  async function run(path: string, body?: object) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      await partnerFetch(`/partner/orders/${id}/receiving/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <AuthLoading message="Loading receiving…" />;

  if (!view) {
    return (
      <div className="mx-auto max-w-2xl">
        {error ? <div className="alert-error">{error}</div> : <AuthLoading message="Loading…" />}
      </div>
    );
  }

  const est = view.order.estimatedWeightKg;
  const riderWt = view.order.pickup?.actualWeightKg;
  const variance = est != null && riderWt != null ? Math.abs(riderWt - est) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Shop receiving"
        backHref={backHref}
        backLabel={backLabel}
        badge={
          view.order.branchName ? (
            <span className="badge-primary">{view.order.branchName}</span>
          ) : undefined
        }
        description={
          <>
            <span className="capitalize">{view.order.bookingType.replace(/_/g, ' ')}</span>
            {' · '}
            <span className="capitalize">{view.order.status.replace(/_/g, ' ')}</span>
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

      {/* ── Step progress ── */}
      <ol className="mt-5 space-y-2.5">
        {view.workflowSteps.map((label, i) => {
          const state = i < view.workflowStep ? 'done' : i === view.workflowStep ? 'current' : 'upcoming';
          return (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ring-1 ${
                state === 'current'
                  ? 'bg-primary/5 font-medium text-primary ring-primary/30'
                  : state === 'done'
                    ? 'bg-accent/5 text-slate-700 ring-accent/20'
                    : 'text-muted-foreground ring-border/50'
              }`}
            >
              <StepIcon state={state} />
              {label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="alert-error mt-4 flex items-center gap-2">
          <Icon d={ICONS.alert} className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {view.canReceive && (
        <ActionCard icon={ICONS.box} title="Receive laundry" description="Confirm bags arrived from the rider.">
          <label className="form-label" htmlFor="receive-note">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="receive-note"
            className="input-field"
            placeholder="e.g. 2 bags, one slightly damp"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={loading}
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={() => run('receive', { note: note || undefined })}
          >
            {loading ? 'Saving…' : 'Receive laundry'}
          </button>
        </ActionCard>
      )}

      {view.canVerifyWeight && (
        <ActionCard
          icon={ICONS.scale}
          title="Verify weight"
          description="Enter the weight measured at your shop — this is the authoritative value used for billing."
        >
          {(est != null || riderWt != null) && (
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-surface-muted p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Declared</p>
                <p className="tabular-nums text-sm font-semibold text-slate-900">
                  {est != null ? `${est} kg` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rider weighed</p>
                <p className="tabular-nums text-sm font-semibold text-slate-900">
                  {riderWt != null ? `${riderWt} kg` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Variance</p>
                <p
                  className={`tabular-nums text-sm font-semibold ${
                    variance != null && variance > 0.5 ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {variance != null ? `${variance.toFixed(2)} kg` : '—'}
                </p>
              </div>
            </div>
          )}
          <label className="form-label" htmlFor="verify-weight">
            Shop-measured weight (kg)
          </label>
          <input
            id="verify-weight"
            className="input-field"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="e.g. 8.2"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || !weight}
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={() =>
              run('verify-weight', { verifiedWeightKg: Number(weight), note: note || undefined })
            }
          >
            {loading ? 'Saving…' : 'Verify weight'}
          </button>
        </ActionCard>
      )}

      {view.canConfirmItems && (
        <ActionCard
          icon={ICONS.list}
          title="Confirm items"
          description="Count bags/pieces to complete shop intake."
        >
          <label className="form-label" htmlFor="item-count">
            Item count
          </label>
          <input
            id="item-count"
            className="input-field"
            type="number"
            inputMode="numeric"
            min={1}
            value={itemCount}
            onChange={(e) => setItemCount(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Status becomes <span className="font-mono">received_at_shop</span> once confirmed.
          </p>
          <button
            type="button"
            disabled={loading}
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={() =>
              run('confirm-items', {
                itemCount: Number(itemCount),
                note: note || undefined,
              })
            }
          >
            {loading ? 'Saving…' : 'Confirm items'}
          </button>
        </ActionCard>
      )}

      {view.isComplete && (
        <div className="card card-body mt-6 border-l-4 border-accent">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Icon d={ICONS.check} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-accent">Received at shop</p>
              <p className="mt-1 text-sm text-muted">
                {view.shopReceiving?.verifiedWeightKg != null &&
                  `Verified ${view.shopReceiving.verifiedWeightKg} kg`}
                {view.shopReceiving?.itemCount != null && ` · ${view.shopReceiving.itemCount} item(s)`}
              </p>
              <Link href={`/orders/${id}`} className="btn-primary mt-4 inline-flex items-center gap-1.5">
                Start laundry processing
                <Icon d={ICONS.arrow} className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
