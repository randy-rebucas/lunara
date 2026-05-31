export const HANDOFF_QR_VERSION = 'v1';
export const HANDOFF_QR_PREFIX = 'lunara';

export const HANDOFF_QR_KIND = {
  CUSTOMER_PICKUP: 'customer_pickup',
  ORDER_HANDOVER: 'order_handover',
  CUSTOMER_DELIVERY: 'customer_delivery',
} as const;

export type HandoffQrKind = (typeof HANDOFF_QR_KIND)[keyof typeof HANDOFF_QR_KIND];

export interface HandoffQrPayload {
  version: string;
  kind: HandoffQrKind;
  orderId: string;
  secret: string;
}

export function buildHandoffQrPayload(kind: HandoffQrKind, orderId: string, secret: string): string {
  return [HANDOFF_QR_PREFIX, HANDOFF_QR_VERSION, kind, orderId, secret].join('|');
}

export function parseHandoffQrPayload(raw: string): HandoffQrPayload | null {
  const trimmed = raw.trim();
  const parts = trimmed.split('|');
  if (parts.length !== 5) return null;
  if (parts[0] !== HANDOFF_QR_PREFIX) return null;
  if (parts[1] !== HANDOFF_QR_VERSION) return null;

  const kind = parts[2];
  if (
    kind !== HANDOFF_QR_KIND.CUSTOMER_PICKUP &&
    kind !== HANDOFF_QR_KIND.ORDER_HANDOVER &&
    kind !== HANDOFF_QR_KIND.CUSTOMER_DELIVERY
  ) {
    return null;
  }

  const orderId = parts[3]?.trim();
  const secret = parts[4]?.trim();
  if (!orderId || !secret) return null;

  return {
    version: parts[1],
    kind,
    orderId,
    secret,
  };
}

export function assertHandoffQrKind(
  payload: HandoffQrPayload,
  expected: HandoffQrKind,
): void {
  if (payload.kind !== expected) {
    throw new Error(`Expected ${expected} QR, got ${payload.kind}`);
  }
}

export const HANDOFF_QR_LABELS: Record<HandoffQrKind, string> = {
  customer_pickup: 'Scan Customer QR',
  order_handover: 'Scan Order QR',
  customer_delivery: 'Scan Customer QR',
};
