import { z } from 'zod';

export const orderCardSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  status: z.string().min(1),
  branchName: z.string().optional(),
  scheduledAt: z.string().optional(),
  itemsSummary: z.string().optional(),
  total: z.string().optional(),
  showStepper: z.boolean().optional(),
});

export const orderCardListPropsSchema = z.object({
  title: z.string().optional(),
  emptyStateText: z.string().optional(),
  orders: z.array(orderCardSchema),
  ctaLabel: z.string().optional(),
});

export type OrderCardListProps = z.infer<typeof orderCardListPropsSchema>;

export const orderCardListDefaultProps: OrderCardListProps = {
  title: 'Active orders',
  emptyStateText: 'No active orders right now',
  ctaLabel: 'View all',
  orders: [
    {
      id: 'o1',
      orderNumber: 'LN-10245',
      status: 'in_progress',
      branchName: 'Lunara — Ortigas',
      scheduledAt: 'Today, 2:00 PM',
      itemsSummary: 'Wash & Fold · 6kg',
      total: '₱480.00',
      showStepper: true,
    },
  ],
};
