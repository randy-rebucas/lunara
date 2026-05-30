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
