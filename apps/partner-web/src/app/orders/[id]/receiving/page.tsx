'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PartnerReceivingView } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../../../components/auth-loading';
import { PageHeader } from '../../../../components/ui/page-header';
import { OrderHandoffQr } from '../../../../components/order-handoff-qr';
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
    return error ? <div className="alert-error">{error}</div> : <AuthLoading message="Loading…" />;
  }

  const est = view.order.estimatedWeightKg;
  const riderWt = view.order.pickup?.actualWeightKg;

  return (
    <div>
      <PageHeader
        title="Shop receiving"
        backHref={backHref}
        backLabel={backLabel}
        description={
          <>
            <span className="capitalize">{view.order.bookingType.replace(/_/g, ' ')}</span>
            {' · '}
            <span className="capitalize">{view.order.status.replace(/_/g, ' ')}</span>
            {view.order.branchName ? ` · ${view.order.branchName}` : ''}
          </>
        }
      />

      <ol className="space-y-2">
        {view.workflowSteps.map((label, i) => {
          const state =
            i < view.workflowStep ? 'done' : i === view.workflowStep ? 'current' : 'upcoming';
          return (
            <li
              key={label}
              className={`rounded-lg px-4 py-3 text-sm ring-1 ${
                state === 'current'
                  ? 'bg-primary/5 font-medium text-primary ring-primary/30'
                  : state === 'done'
                    ? 'bg-accent/10 text-accent ring-accent/30'
                    : 'text-muted-foreground ring-border/50'
              }`}
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      {view.order.pickup?.receiptCode && (
        <>
          <p className="mt-4 text-sm text-muted">
            Pickup receipt:{' '}
            <span className="font-mono font-semibold text-slate-900">{view.order.pickup.receiptCode}</span>
          </p>
          <OrderHandoffQr orderId={view.order._id} receiptCode={view.order.pickup.receiptCode} />
        </>
      )}

      {error && <div className="alert-error mt-4">{error}</div>}

      {view.canReceive && (
        <div className="card card-body mt-6 !py-5">
          <h3 className="font-semibold text-slate-900">Receive laundry</h3>
          <p className="mt-1 text-sm text-muted">Confirm bags arrived from the rider.</p>
          <input
            className="input-field mt-3"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={loading}
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={() => run('receive', { note: note || undefined })}
          >
            Receive laundry
          </button>
        </div>
      )}

      {view.canVerifyWeight && (
        <div className="card card-body mt-6 !py-5">
          <h3 className="font-semibold text-slate-900">Verify weight</h3>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
            {est != null && (
              <span><span className="font-medium text-slate-700">Customer declared:</span> {est} kg</span>
            )}
            {riderWt != null && (
              <span><span className="font-medium text-slate-700">Rider weighed:</span> {riderWt} kg</span>
            )}
            {est != null && riderWt != null && (
              <span><span className="font-medium text-slate-700">Variance:</span> {Math.abs(riderWt - est).toFixed(2)} kg</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">Enter the weight measured at your shop — this is the authoritative value used for billing.</p>
          <input
            className="input-field mt-3"
            type="number"
            step="0.1"
            placeholder="Shop-measured weight (kg)"
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
            Verify weight
          </button>
        </div>
      )}

      {view.canConfirmItems && (
        <div className="card card-body mt-6 !py-5">
          <h3 className="font-semibold text-slate-900">Confirm items</h3>
          <p className="mt-1 text-sm text-muted">
            Count bags/pieces. Status becomes <span className="font-mono">received_at_shop</span>.
          </p>
          <input
            className="input-field mt-3"
            type="number"
            min={1}
            value={itemCount}
            onChange={(e) => setItemCount(e.target.value)}
          />
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
            Confirm items
          </button>
        </div>
      )}

      {view.isComplete && (
        <div className="mt-6 rounded-xl bg-accent/10 p-5 ring-1 ring-accent/30">
          <p className="font-semibold text-accent">Received at shop</p>
          <p className="mt-1 text-sm text-muted">
            {view.shopReceiving?.verifiedWeightKg != null &&
              `Verified ${view.shopReceiving.verifiedWeightKg} kg`}
            {view.shopReceiving?.itemCount != null && ` · ${view.shopReceiving.itemCount} item(s)`}
          </p>
          <Link href={`/orders/${id}`} className="btn-primary mt-4 inline-flex">
            Start laundry processing →
          </Link>
        </div>
      )}
    </div>
  );
}
