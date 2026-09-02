import { z } from 'zod';

export const promoPropsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  code: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type PromoProps = z.infer<typeof promoPropsSchema>;

export const promoDefaultProps: PromoProps = {
  title: '20% off your first order',
  code: 'WELCOME20',
};
