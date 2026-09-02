import { z } from 'zod';

export const tileGridTileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
  value: z.string().optional(),
  imageUrl: z.string().optional(),
  badge: z.string().optional(),
});

export const tileGridPropsSchema = z.object({
  title: z.string().optional(),
  columns: z.number().optional(),
  tiles: z.array(tileGridTileSchema),
});

export type TileGridProps = z.infer<typeof tileGridPropsSchema>;

export const tileGridDefaultProps: TileGridProps = {
  title: 'Quick actions',
  columns: 4,
  tiles: [
    { id: 'book', label: 'Book pickup', icon: 'Shirt' },
    { id: 'track', label: 'Track order', icon: 'MapPin' },
    { id: 'wallet', label: 'Top up', icon: 'Wallet' },
    { id: 'support', label: 'Support', icon: 'MessageCircle' },
  ],
};
