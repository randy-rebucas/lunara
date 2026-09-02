import { z } from 'zod';

export const bannerPropsSchema = z.object({
  message: z.string().min(1),
  tone: z.enum(['info', 'success', 'warning']).default('info'),
  dismissible: z.boolean().default(true),
});

export type BannerProps = z.infer<typeof bannerPropsSchema>;

export const bannerDefaultProps: BannerProps = {
  message: 'Limited-time offer available now.',
  tone: 'info',
  dismissible: true,
};
