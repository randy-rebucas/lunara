import { z } from 'zod';

export const transactionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: z.string().min(1),
  direction: z.enum(['credit', 'debit']),
  timestamp: z.string().min(1),
  status: z.string().optional(),
});

export const transactionListPropsSchema = z.object({
  title: z.string().optional(),
  transactions: z.array(transactionSchema),
});

export type TransactionListProps = z.infer<typeof transactionListPropsSchema>;

export const transactionListDefaultProps: TransactionListProps = {
  title: 'Recent transactions',
  transactions: [
    { id: 't1', label: 'Wallet top-up', amount: '₱500.00', direction: 'credit', timestamp: 'Sep 1, 2026' },
    { id: 't2', label: 'Order LN-10230', amount: '₱420.00', direction: 'debit', timestamp: 'Aug 29, 2026', status: 'paid' },
  ],
};
