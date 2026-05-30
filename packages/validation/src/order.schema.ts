import { BookingType } from '@lunara/types';
import { z } from 'zod';

export const orderItemSchema = z.object({
  serviceType: z.nativeEnum(BookingType),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

export const createOrderSchema = z.object({
  bookingType: z.nativeEnum(BookingType),
  items: z.array(orderItemSchema).min(1),
  pickupAddressId: z.string().min(1),
  deliveryAddressId: z.string().min(1),
  scheduledPickupAt: z.string().datetime(),
  scheduledDeliveryAt: z.string().datetime().optional(),
  couponCode: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.string().min(1),
  note: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
