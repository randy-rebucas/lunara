import { z } from 'zod';

export const productGridItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  price: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const productGridPropsSchema = z.object({
  title: z.string().optional(),
  columns: z.union([z.literal(2), z.literal(3)]).default(2),
  items: z.array(productGridItemSchema).default([]),
});

export type ProductGridProps = z.infer<typeof productGridPropsSchema>;

export const productGridDefaultProps: ProductGridProps = {
  title: 'Popular services',
  columns: 2,
  items: [],
};
