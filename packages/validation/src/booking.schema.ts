import { BookingType } from '@lunara/types';
import { BAG_SIZES } from '@lunara/utils';
import { z } from 'zod';

const BAG_SIZE_IDS = BAG_SIZES.map((b) => b.id) as [string, ...string[]];

export const bookingQuoteSchema = z.object({
  bookingType: z.nativeEnum(BookingType),
  bagSizeId: z.enum(BAG_SIZE_IDS),
  addonIds: z.array(z.string()).optional(),
  couponCode: z.string().trim().min(1).max(32).optional(),
});

export const createBookingOrderSchema = bookingQuoteSchema.extend({
  pickupAddressId: z.string().min(1),
  deliveryAddressId: z.string().min(1).optional(),
  scheduledPickupAt: z.string().datetime(),
});

export type BookingQuoteInput = z.infer<typeof bookingQuoteSchema>;
export type CreateBookingOrderInput = z.infer<typeof createBookingOrderSchema>;
