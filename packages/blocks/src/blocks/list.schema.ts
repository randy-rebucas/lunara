import { z } from 'zod';

export const listItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
});

export const listPropsSchema = z.object({
  title: z.string().optional(),
  items: z.array(listItemSchema).default([]),
});

export type ListProps = z.infer<typeof listPropsSchema>;

export const listDefaultProps: ListProps = {
  title: 'Services',
  items: [],
};
