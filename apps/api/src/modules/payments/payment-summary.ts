import { PaymentMethod, PaymentStatus } from '@lunara/types';
import { isRefundablePaymentMethod } from '@lunara/utils';
import type { Model, Types } from 'mongoose';
import type { PaymentDocument } from './schemas/payment.schema';

export interface OrderPaymentSummary {
  paymentMethod?: PaymentMethod | string;
  paymentStatus?: PaymentStatus | string;
  paymentAmount?: number;
  paymentReceiptCode?: string;
  cashTiming?: 'pickup' | 'delivery';
  paymentPaidAt?: Date;
  cashCollectedBy?: string;
  refundable: boolean;
}

export function buildOrderPaymentSummary(
  payment: PaymentDocument | undefined,
): OrderPaymentSummary {
  if (!payment) {
    return { refundable: false };
  }
  return {
    paymentMethod: payment.method,
    paymentStatus: payment.status,
    paymentAmount: payment.amount,
    paymentReceiptCode: payment.receiptCode,
    cashTiming: payment.cashTiming,
    paymentPaidAt: payment.paidAt,
    cashCollectedBy: payment.cashCollectedBy?.toString(),
    refundable: isRefundablePaymentMethod(payment.method),
  };
}

export function buildPartnerPaymentLabel(summary: OrderPaymentSummary): string | undefined {
  if (!summary.paymentMethod) return undefined;
  if (summary.paymentMethod === PaymentMethod.CASH) {
    const when = summary.cashTiming === 'delivery' ? 'delivery' : 'pickup';
    const collected = summary.paymentStatus === PaymentStatus.PAID;
    return collected
      ? `Cash collected (${when})`
      : `Cash on ${when} — rider collects`;
  }
  if (summary.paymentStatus === PaymentStatus.PAID) {
    return 'Paid online';
  }
  if (summary.paymentStatus === PaymentStatus.PENDING) {
    return 'Payment pending';
  }
  if (summary.paymentStatus === PaymentStatus.FAILED) {
    return 'Payment failed';
  }
  return undefined;
}

export async function loadLatestOrderPaymentsByOrderId(
  paymentModel: Model<PaymentDocument>,
  orderIds: Types.ObjectId[],
): Promise<Map<string, PaymentDocument>> {
  if (orderIds.length === 0) return new Map();

  const payments = await paymentModel
    .find({ orderId: { $in: orderIds }, purpose: 'order' })
    .sort({ createdAt: -1 });

  const byOrderId = new Map<string, PaymentDocument>();
  for (const payment of payments) {
    if (!payment.orderId) continue;
    const key = payment.orderId.toString();
    if (!byOrderId.has(key)) byOrderId.set(key, payment);
  }
  return byOrderId;
}
