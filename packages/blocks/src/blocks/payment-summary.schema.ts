import { z } from 'zod';

export const paymentSummaryLineItemSchema = z.object({
  label: z.string().min(1),
  amount: z.string().min(1),
});

export const paymentSummaryPropsSchema = z.object({
  lineItems: z.array(paymentSummaryLineItemSchema),
  total: z.string().min(1),
  status: z.enum(['pending', 'paid', 'failed']).optional(),
  methodLabel: z.string().optional(),
  ctaLabel: z.string().optional(),
});

export type PaymentSummaryProps = z.infer<typeof paymentSummaryPropsSchema>;

export const paymentSummaryDefaultProps: PaymentSummaryProps = {
  status: 'pending',
  methodLabel: 'GCash',
  ctaLabel: 'Pay now',
  lineItems: [
    { label: 'Wash & Fold (6kg)', amount: '₱480.00' },
    { label: 'Express return', amount: '₱80.00' },
  ],
  total: '₱560.00',
};
