import { z } from 'zod';

export const heroPropsSchema = z.object({
  headline: z.string().min(1),
  subheadline: z.string().optional(),
  imageUrl: z.string().optional(),
  ctaLabel: z.string().optional(),
});

export type HeroProps = z.infer<typeof heroPropsSchema>;

export const heroDefaultProps: HeroProps = {
  headline: 'Welcome',
  subheadline: 'Fresh laundry, delivered.',
  ctaLabel: 'Book a pickup',
};
