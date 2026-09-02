import { z } from 'zod';

export const addressListAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const addressListPropsSchema = z.object({
  title: z.string().optional(),
  addresses: z.array(addressListAddressSchema),
  allowAdd: z.boolean().optional(),
  addLabel: z.string().optional(),
});

export type AddressListProps = z.infer<typeof addressListPropsSchema>;

export const addressListDefaultProps: AddressListProps = {
  title: 'Saved addresses',
  allowAdd: true,
  addLabel: 'Add new address',
  addresses: [
    { id: 'a1', label: 'Home', line1: '12 Kalayaan Ave, Unit 4B', line2: 'Quezon City', isDefault: true },
    { id: 'a2', label: 'Office', line1: '8th Floor, Ortigas Tower' },
  ],
};
