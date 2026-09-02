import { z } from 'zod';

export const statusTimelineStepSchema = z.object({
  status: z.string().min(1),
  label: z.string().min(1),
  timestamp: z.string().optional(),
  description: z.string().optional(),
});

export const statusTimelinePropsSchema = z.object({
  title: z.string().optional(),
  currentStatus: z.string().min(1),
  steps: z.array(statusTimelineStepSchema),
  variant: z.enum(['order', 'refund', 'support']).optional(),
});

export type StatusTimelineProps = z.infer<typeof statusTimelinePropsSchema>;

export const statusTimelineDefaultProps: StatusTimelineProps = {
  title: 'Order status',
  currentStatus: 'in_progress',
  variant: 'order',
  steps: [
    { status: 'placed', label: 'Order placed', timestamp: '9:00 AM' },
    { status: 'picked_up', label: 'Picked up', timestamp: '10:30 AM' },
    { status: 'in_progress', label: 'Washing in progress' },
    { status: 'out_for_delivery', label: 'Out for delivery' },
    { status: 'delivered', label: 'Delivered' },
  ],
};
