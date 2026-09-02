import { z } from 'zod';

export const filterChipOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  count: z.number().optional(),
});

export const filterChipListPropsSchema = z.object({
  options: z.array(filterChipOptionSchema),
  selectedId: z.string().optional(),
});

export type FilterChipListProps = z.infer<typeof filterChipListPropsSchema>;

export const filterChipListDefaultProps: FilterChipListProps = {
  selectedId: 'ongoing',
  options: [
    { id: 'ongoing', label: 'Ongoing', count: 2 },
    { id: 'past', label: 'Past', count: 12 },
    { id: 'cancelled', label: 'Cancelled', count: 1 },
  ],
};
