import { PaymentMethod, PaymentStatus } from '@lunara/types';

export type CashTiming = 'pickup' | 'delivery';

export type PaymentChannel = 'wallet' | 'paymongo' | 'cash';

export interface PaymentMethodOption {
  channel: PaymentChannel;
  method: PaymentMethod;
  label: string;
  description: string;
}

export const PAYMONGO_METHODS: PaymentMethod[] = [
  PaymentMethod.GCASH,
  PaymentMethod.MAYA,
  PaymentMethod.STRIPE,
];

export const CUSTOMER_PAYMENT_OPTIONS: PaymentMethodOption[] = [
  {
    channel: 'paymongo',
    method: PaymentMethod.GCASH,
    label: 'GCash',
    description: 'Pay via PayMongo (GCash)',
  },
  {
    channel: 'paymongo',
    method: PaymentMethod.MAYA,
    label: 'Maya',
    description: 'Pay via PayMongo (Maya)',
  },
  {
    channel: 'paymongo',
    method: PaymentMethod.STRIPE,
    label: 'Card',
    description: 'Credit / debit card via PayMongo',
  },
  {
    channel: 'cash',
    method: PaymentMethod.CASH,
    label: 'Cash',
    description: 'Pay in cash when we pick up or deliver',
  },
  {
    channel: 'wallet',
    method: PaymentMethod.WALLET,
    label: 'Wallet',
    description: 'Pay from your Lunara wallet balance',
  },
];

export function generatePaymentReceiptCode(orderId: string, paymentId: string) {
  const short = orderId.slice(-6).toUpperCase();
  const tail = paymentId.slice(-4).toUpperCase();
  return `PAY-${short}-${tail}`;
}

export function formatPaymentMethodLabel(method: string) {
  switch (method) {
    case PaymentMethod.WALLET:
      return 'Lunara Wallet';
    case PaymentMethod.GCASH:
      return 'GCash (PayMongo)';
    case PaymentMethod.MAYA:
      return 'Maya (PayMongo)';
    case PaymentMethod.STRIPE:
      return 'Card (PayMongo)';
    case PaymentMethod.CASH:
      return 'Cash';
    default:
      return method.replace(/_/g, ' ');
  }
}

export function formatPaymentStatusLabel(status: string) {
  switch (status) {
    case PaymentStatus.PAID:
      return 'Paid';
    case PaymentStatus.PENDING:
      return 'Pending';
    case PaymentStatus.FAILED:
      return 'Failed';
    case PaymentStatus.REFUNDED:
      return 'Refunded';
    default:
      return status;
  }
}

export function formatCashTimingLabel(timing?: CashTiming) {
  if (timing === 'pickup') return 'Pay on pickup';
  if (timing === 'delivery') return 'Pay on delivery';
  return 'Cash';
}

export function isPaymongoMethod(method: PaymentMethod) {
  return PAYMONGO_METHODS.includes(method);
}

/** PayMongo's published PH processing rate: 3.5% + ₱15 per transaction. Not modelled anywhere
 * before — Lunara's platform_cash previously showed the full payment amount as received, when
 * PayMongo actually nets its fee out before depositing. */
export const PAYMONGO_FEE_RATE = 0.035;
export const PAYMONGO_FEE_FLAT = 15;

export function calculatePaymongoFee(amount: number): number {
  return Math.round(amount * PAYMONGO_FEE_RATE + PAYMONGO_FEE_FLAT);
}

/** Wallet and online (PayMongo) payments can be refunded to the Lunara wallet — not cash. */
export function isRefundablePaymentMethod(method: PaymentMethod) {
  return method === PaymentMethod.WALLET || isPaymongoMethod(method);
}

/** Cash payment summary for rider pickup/delivery tasks. */
export interface RiderCashPaymentInfo {
  required: true;
  timing: CashTiming;
  amount: number;
  status: 'pending' | 'paid';
  receiptCode?: string;
  /** When the rider must collect cash. */
  collectAt: CashTiming;
  /** Rider can tap "Cash collected" on this task now. */
  canCollect: boolean;
  collected: boolean;
  /** Rider's earned fee for this task, offset against the cash amount. */
  earningOffset?: number;
  /** Net cash to remit to admin after subtracting earningOffset. */
  netRemittance?: number;
}

export function buildRiderCashPaymentInfo(input: {
  timing: CashTiming;
  amount: number;
  status: string;
  receiptCode?: string;
  stage: 'pickup' | 'delivery';
  /** Pickup: customer verified. Delivery: out for delivery with customer received. */
  readyToCollect: boolean;
}): RiderCashPaymentInfo {
  const collected = input.status === 'paid';
  const collectAt = input.timing;
  const canCollect =
    !collected && collectAt === input.stage && input.readyToCollect;

  return {
    required: true,
    timing: input.timing,
    amount: input.amount,
    status: collected ? 'paid' : 'pending',
    receiptCode: input.receiptCode,
    collectAt,
    canCollect,
    collected,
  };
}
