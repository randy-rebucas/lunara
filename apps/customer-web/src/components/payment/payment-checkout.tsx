'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OrderStatus } from '@lunara/types';
import { PaymentMethod } from '@lunara/types';
import { Button } from '@lunara/ui';
import {
  CUSTOMER_PAYMENT_OPTIONS,
  formatCashTimingLabel,
  formatCurrency,
  formatPaymentMethodLabel,
  type CashTiming,
} from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';

interface CheckoutOrder {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
}

interface CheckoutPayment {
  _id: string;
  status: string;
  method: string;
  amount: number;
  receiptCode?: string;
  cashTiming?: CashTiming;
}

interface PaymentCheckoutProps {
  orderId: string;
}

export function PaymentCheckout({ orderId }: PaymentCheckoutProps) {
  const router = useRouter();
  const { api } = useAuthContext();
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [existingPayment, setExistingPayment] = useState<CheckoutPayment | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const [cashTiming, setCashTiming] = useState<CashTiming>('pickup');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCheckout() {
      try {
        const [checkout, wallet] = await Promise.all([
          api.get<{ order: CheckoutOrder; payment: CheckoutPayment | null }>(
            `/payments/orders/${orderId}`,
          ),
          api.get<{ balance: number }>('/wallets/me'),
        ]);

        if (cancelled) return;

        let payment = checkout.data.payment;
        setOrder(checkout.data.order);
        setWalletBalance((wallet.data as { balance?: number }).balance ?? 0);

        if (payment?.status === 'pending' && payment._id) {
          try {
            const synced = await api.post<{ status: string; _id: string }>(
              `/payments/${payment._id}/sync`,
              {},
            );
            payment = { ...payment, status: synced.data.status };
          } catch {
            // Still pending — user can retry payment
          }
        }

        setExistingPayment(payment);

        if (payment?.status === 'paid' && payment._id) {
          window.location.href = `/checkout/${orderId}/success?paymentId=${payment._id}`;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load checkout');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCheckout();
    return () => {
      cancelled = true;
    };
  }, [api, orderId]);

  async function handleDelete() {
    if (
      !window.confirm(
        'Delete this unpaid order? You can book again anytime. This cannot be undone.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/orders/${orderId}`);
      router.push('/orders');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete order');
    } finally {
      setDeleting(false);
    }
  }

  async function handlePay() {
    if (payingRef.current) return;
    payingRef.current = true;
    setPaying(true);
    setError('');
    try {
      const res = await api.post<{
        paid?: boolean;
        checkoutUrl?: string;
        payment?: { _id: string };
        receiptCode?: string;
      }>('/payments/intent', {
        orderId,
        method,
        clientOrigin: window.location.origin,
        ...(method === PaymentMethod.CASH ? { cashTiming } : {}),
      });

      if (res.data.paid && res.data.payment?._id) {
        window.location.href = `/checkout/${orderId}/success?paymentId=${res.data.payment._id}`;
        return;
      }

      if (method === PaymentMethod.CASH && res.data.payment?._id) {
        window.location.href = `/checkout/${orderId}/success?paymentId=${res.data.payment._id}`;
        return;
      }

      if (res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return;
      }

      payingRef.current = false;
      setError('Payment could not be started');
    } catch (e) {
      payingRef.current = false;
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading checkout…</p>;
  }

  if (!order) {
    return <p className="text-sm text-red-500">{error || 'Order not found'}</p>;
  }

  const paymongoOptions = CUSTOMER_PAYMENT_OPTIONS.filter((o) => o.channel === 'paymongo');
  const selectedOption = CUSTOMER_PAYMENT_OPTIONS.find((o) => o.method === method);
  const insufficientWallet =
    method === PaymentMethod.WALLET && walletBalance < order.total;

  return (
    <div className="space-y-8">
      <section className="panel">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <p className="mt-1 capitalize text-slate-600">{order.bookingType.replace(/_/g, ' ')}</p>
        <p className="mt-4 text-3xl font-bold text-primary">{formatCurrency(order.total)}</p>
        <p className="mt-1 text-xs text-slate-500">Status: {order.status.replace(/_/g, ' ')}</p>
        {existingPayment?.receiptCode && existingPayment.status === 'pending' && (
          <p className="mt-2 text-xs text-amber-700">
            Pending payment · ref {existingPayment.receiptCode}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Choose payment method</h2>
        <p className="mt-1 text-sm text-slate-500">PayMongo for online payments, cash, or wallet</p>

        <div className="mt-4 list-stack-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PayMongo</p>
          {paymongoOptions.map((opt) => (
            <button
              key={opt.method}
              type="button"
              onClick={() => setMethod(opt.method)}
              className={`selectable-item ${
                method === opt.method ? 'selectable-item-active' : ''
              }`}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-sm text-slate-500">{opt.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 list-stack-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cash</p>
          <button
            type="button"
            onClick={() => setMethod(PaymentMethod.CASH)}
            className={`selectable-item ${
              method === PaymentMethod.CASH ? 'selectable-item-active' : ''
            }`}
          >
            <p className="font-medium">Cash</p>
            <p className="text-sm text-slate-500">Pay when we pick up or deliver your laundry</p>
          </button>
          {method === PaymentMethod.CASH && (
            <div className="flex gap-2 pl-1">
              {(['pickup', 'delivery'] as CashTiming[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCashTiming(t)}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                    cashTiming === t ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {formatCashTimingLabel(t)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 list-stack-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Wallet</p>
          <button
            type="button"
            onClick={() => setMethod(PaymentMethod.WALLET)}
            className={`selectable-item ${
              method === PaymentMethod.WALLET ? 'selectable-item-active' : ''
            }`}
          >
            <div className="flex justify-between">
              <div>
                <p className="font-medium">Lunara Wallet</p>
                <p className="text-sm text-slate-500">Balance: {formatCurrency(walletBalance)}</p>
              </div>
            </div>
          </button>
          {insufficientWallet && (
            <p className="text-sm text-amber-700">
              Insufficient balance.{' '}
              <Link href="/wallet" className="text-primary underline">
                Top up wallet
              </Link>
            </p>
          )}
        </div>
      </section>

      {selectedOption && (
        <p className="text-sm text-slate-600">
          You selected <strong>{formatPaymentMethodLabel(method)}</strong>
          {method === PaymentMethod.CASH && ` · ${formatCashTimingLabel(cashTiming)}`}
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        className="w-full"
        size="lg"
        disabled={paying || deleting || insufficientWallet}
        onClick={handlePay}
      >
        {paying
          ? 'Processing…'
          : method === PaymentMethod.CASH
            ? 'Confirm & get receipt'
            : method === PaymentMethod.WALLET
              ? 'Pay with wallet'
              : 'Continue to PayMongo'}
      </Button>

      {order.status === OrderStatus.PENDING && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-red-200 text-red-600 hover:bg-red-50"
          size="lg"
          disabled={paying || deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting…' : 'Delete order'}
        </Button>
      )}
    </div>
  );
}
