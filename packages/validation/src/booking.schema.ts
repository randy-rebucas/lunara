import { BookingType } from '@lunara/types';
import { z } from 'zod';

export const bookingQuoteSchema = z.object({
  bookingType: z.nativeEnum(BookingType),
  weightKg: z.number().min(1).max(50),
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
