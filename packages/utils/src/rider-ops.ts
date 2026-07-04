/** Default partner shop for rider drop-off after pickup. */
export const PARTNER_SHOP_LOCATION = {
  name: 'Lunara Laundry Hub',
  line1: '123 Wash Street',
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1200',
  latitude: 14.5547,
  longitude: 121.0244,
} as const;

/** Fallback only — actual rates are admin-configurable via PlatformSettings. */
export const RIDER_PICKUP_PAYOUT = 35;
export const RIDER_DELIVERY_PAYOUT = 35;

export type RiderEarningType = 'pickup' | 'delivery' | 'bonus' | 'adjustment';

export const RIDER_EARNING_TYPE_LABELS: Record<RiderEarningType, string> = {
  pickup: 'Pickup Fee',
  delivery: 'Delivery Fee',
  bonus: 'Bonus',
  adjustment: 'Adjustment',
};

export function riderEarningAmount(type: RiderEarningType, override?: number) {
  if (override != null) return override;
  if (type === 'pickup') return RIDER_PICKUP_PAYOUT;
  if (type === 'delivery') return RIDER_DELIVERY_PAYOUT;
  throw new Error(`Amount required for ${type} earnings`);
}

export const RIDER_MIN_WITHDRAWAL = 100;

export const RIDER_PAYOUT_METHOD = {
  GCASH: 'gcash',
  MAYA: 'maya',
  BANK: 'bank',
} as const;

export type RiderPayoutMethod = (typeof RIDER_PAYOUT_METHOD)[keyof typeof RIDER_PAYOUT_METHOD];

export const RIDER_PAYOUT_METHOD_LABELS: Record<RiderPayoutMethod, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank Transfer',
};

export const RIDER_WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
} as const;

export type RiderWithdrawalStatus =
  (typeof RIDER_WITHDRAWAL_STATUS)[keyof typeof RIDER_WITHDRAWAL_STATUS];

export const RIDER_WITHDRAWAL_STATUS_LABELS: Record<RiderWithdrawalStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid out',
};

export function computeRiderWalletBalances(
  walletBalance: number,
  pendingHold: number,
  pendingWithdrawalTotal: number,
) {
  const currentBalance = walletBalance;
  const pendingEarnings = pendingHold;
  const withdrawableBalance = Math.max(0, walletBalance - pendingHold - pendingWithdrawalTotal);
  return { currentBalance, pendingEarnings, withdrawableBalance };
}

export function taskEarningReference(id: string, type: RiderEarningType) {
  return `earning:${type}:${id}`;
}

export function parseEarningReference(reference: string): { type: RiderEarningType; id: string } | null {
  if (!reference.startsWith('earning:')) return null;
  const parts = reference.split(':');
  if (parts.length !== 3) return null;
  const type = parts[1];
  const id = parts[2];
  if (
    type !== 'pickup' &&
    type !== 'delivery' &&
    type !== 'bonus' &&
    type !== 'adjustment'
  ) {
    return null;
  }
  if (!id) return null;
  return { type: type as RiderEarningType, id };
}

export function getEarningsPeriodStarts(at = new Date()) {
  const todayStart = new Date(at);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  return { todayStart, weekStart, monthStart };
}

/** Client-side GPS ping interval during active pickup/delivery tasks. */
export const RIDER_GPS_UPDATE_INTERVAL_MS = 15000;

export interface RiderLocationPayload {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export type RiderLocationInput = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  speed?: number | null;
  heading?: number | null;
  timestamp?: string;
};

export function normalizeRiderLocationPayload(input: RiderLocationInput): RiderLocationPayload {
  const latitude = input.latitude ?? input.lat;
  const longitude = input.longitude ?? input.lng;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error('latitude and longitude are required');
  }

  const payload: RiderLocationPayload = {
    latitude,
    longitude,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };

  if (input.speed != null && Number.isFinite(input.speed) && input.speed >= 0) {
    payload.speed = input.speed;
  }
  if (input.heading != null && Number.isFinite(input.heading) && input.heading >= 0) {
    payload.heading = input.heading;
  }

  return payload;
}

/** REST/socket body with lat/lng aliases for backward compatibility. */
export function riderLocationWirePayload(payload: RiderLocationPayload) {
  return {
    lat: payload.latitude,
    lng: payload.longitude,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed: payload.speed,
    heading: payload.heading,
    timestamp: payload.timestamp,
  };
}
