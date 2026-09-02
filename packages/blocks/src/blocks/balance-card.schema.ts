import { z } from 'zod';

export const balanceCardPropsSchema = z.object({
  label: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().optional(),
  subLabel: z.string().optional(),
  ctaLabel: z.string().optional(),
  tier: z.string().optional(),
});

export type BalanceCardProps = z.infer<typeof balanceCardPropsSchema>;

export const balanceCardDefaultProps: BalanceCardProps = {
  label: 'Wallet balance',
  amount: '1,240.00',
  currency: '₱',
  subLabel: 'Available for your next booking',
  ctaLabel: 'Top up',
};
