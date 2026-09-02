import { z } from 'zod';

export const receiptCardPropsSchema = z.object({
  orderNumber: z.string().min(1),
  amount: z.string().min(1),
  timestamp: z.string().min(1),
  methodLabel: z.string().optional(),
  shareLabel: z.string().optional(),
});

export type ReceiptCardProps = z.infer<typeof receiptCardPropsSchema>;

export const receiptCardDefaultProps: ReceiptCardProps = {
  orderNumber: 'LN-10245',
  amount: '₱560.00',
  timestamp: 'Sep 2, 2026 · 2:14 PM',
  methodLabel: 'GCash',
  shareLabel: 'Share receipt',
};
