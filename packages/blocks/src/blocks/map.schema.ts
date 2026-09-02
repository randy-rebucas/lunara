import { z } from 'zod';

export const mapPropsSchema = z.object({
  title: z.string().optional(),
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type MapProps = z.infer<typeof mapPropsSchema>;

export const mapDefaultProps: MapProps = {
  title: 'Find us',
  address: '',
};
