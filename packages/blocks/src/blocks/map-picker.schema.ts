import { z } from 'zod';

export const mapPickerPropsSchema = z.object({
  mode: z.enum(['static', 'live', 'pick']),
  centerLabel: z.string().optional(),
  markerLabel: z.string().optional(),
});

export type MapPickerProps = z.infer<typeof mapPickerPropsSchema>;

export const mapPickerDefaultProps: MapPickerProps = {
  mode: 'live',
  centerLabel: 'Ortigas Center, Pasig City',
  markerLabel: 'Your rider',
};
