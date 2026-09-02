import { z } from 'zod';

export const menuListItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
  value: z.string().optional(),
  danger: z.boolean().optional(),
  route: z.string().optional(),
});

export const menuListPropsSchema = z.object({
  title: z.string().optional(),
  items: z.array(menuListItemSchema),
});

export type MenuListProps = z.infer<typeof menuListPropsSchema>;

export const menuListDefaultProps: MenuListProps = {
  title: 'Account',
  items: [
    { id: 'addresses', label: 'Saved addresses', icon: 'MapPin', route: '/addresses' },
    { id: 'payment', label: 'Payment methods', icon: 'CreditCard', route: '/payment' },
    { id: 'notifications', label: 'Notification settings', icon: 'Bell', route: '/notifications' },
    { id: 'help', label: 'Help center', icon: 'HelpCircle', route: '/help' },
    { id: 'logout', label: 'Log out', icon: 'LogOut', danger: true },
  ],
};
