import { z } from 'zod';

export const dataListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  timestamp: z.string().optional(),
  badge: z.string().optional(),
  badgeVariant: z.string().optional(),
  imageUrl: z.string().optional(),
  actionLabel: z.string().optional(),
  toggleable: z.boolean().optional(),
});

export const dataListPropsSchema = z.object({
  title: z.string().optional(),
  emptyStateText: z.string().optional(),
  items: z.array(dataListItemSchema),
  layout: z.enum(['card', 'row']).optional(),
});

export type DataListProps = z.infer<typeof dataListPropsSchema>;

export const dataListDefaultProps: DataListProps = {
  title: 'Notifications',
  emptyStateText: 'Nothing here yet',
  layout: 'card',
  items: [
    { id: 'n1', title: 'Pickup confirmed', subtitle: 'Your rider is on the way', timestamp: '2m ago', badge: 'New', badgeVariant: 'info' },
    { id: 'n2', title: 'Order delivered', subtitle: 'Thanks for choosing us', timestamp: '1d ago' },
  ],
};
