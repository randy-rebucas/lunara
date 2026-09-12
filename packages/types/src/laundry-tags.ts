import type { BookingType, OrderStatus } from './enums.js';

export type LaundryTagStatus = 'available' | 'assigned' | 'retired';

/** Mirrors apps/api/src/modules/laundry-tags/laundry-tags.service.ts's lookup() response shape. */
export interface LaundryTagLookupResult {
  tag: { code: string; status: LaundryTagStatus };
  order: {
    id: string;
    shortCode: string;
    status: OrderStatus;
    branchId?: string;
    bookingType: BookingType;
    shelfSlot?: string;
    items: Array<{ serviceType: BookingType; quantity: number; notes?: string }>;
  } | null;
  customer: { firstName: string; lastName: string; phone?: string } | null;
}
