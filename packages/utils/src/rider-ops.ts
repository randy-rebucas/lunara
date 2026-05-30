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

export const RIDER_PICKUP_PAYOUT = 80;
export const RIDER_DELIVERY_PAYOUT = 120;

export type RiderEarningType = 'pickup' | 'delivery';
