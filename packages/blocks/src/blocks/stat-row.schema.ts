import { z } from 'zod';

export const statRowStatSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  icon: z.string().optional(),
});

export const statRowPropsSchema = z.object({
  title: z.string().optional(),
  stats: z.array(statRowStatSchema),
});

export type StatRowProps = z.infer<typeof statRowPropsSchema>;

export const statRowDefaultProps: StatRowProps = {
  title: 'Your impact',
  stats: [
    { id: 's1', label: 'Orders', value: '24', icon: 'Package' },
    { id: 's2', label: 'kg washed', value: '132', icon: 'Shirt' },
    { id: 's3', label: 'Water saved', value: '480L', icon: 'Droplet' },
  ],
};
