'use client';

import {
  formatCashTimingLabel,
  formatCurrency,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel,
  type CashTiming,
} from '@lunara/utils';

export interface PaymentReceiptData {
  _id: string;
  method: string;
  status: string;
  amount: number;
  receiptCode?: string;
  cashTiming?: CashTiming;
  paidAt?: string;
}

export function PaymentReceipt({
  payment,
  orderTotal,
}: {
  payment: PaymentReceiptData;
  orderTotal: number;
}) {
  const isCashPending = payment.method === 'cash' && payment.status === 'pending';

  return (
    <div className="rounded-xl bg-green-50/50 p-6 ring-1 ring-dashed ring-accent/30">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent">
        {isCashPending ? 'Payment reference' : 'Payment receipt'}
      </p>
      {payment.receiptCode && (
        <p className="mt-3 text-center font-mono text-xl font-bold tracking-wide text-slate-800">
          {payment.receiptCode}
        </p>
      )}
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Amount</dt>
          <dd className="font-medium">{formatCurrency(payment.amount ?? orderTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Method</dt>
          <dd>{formatPaymentMethodLabel(payment.method)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Status</dt>
          <dd className={payment.status === 'paid' ? 'text-accent font-medium' : ''}>
            {formatPaymentStatusLabel(payment.status)}
          </dd>
        </div>
        {payment.cashTiming && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Cash</dt>
            <dd>{formatCashTimingLabel(payment.cashTiming)}</dd>
          </div>
        )}
        {payment.paidAt && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Paid at</dt>
            <dd>
              {new Date(payment.paidAt).toLocaleString('en-PH', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </dd>
          </div>
        )}
      </dl>
      {isCashPending && (
        <p className="mt-4 text-center text-xs text-slate-600">
          Show this code to your rider. Pay {formatCurrency(payment.amount)} on{' '}
          {payment.cashTiming === 'delivery' ? 'delivery' : 'pickup'}.
        </p>
      )}
    </div>
  );
}
