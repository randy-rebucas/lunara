import { z } from 'zod';

export const testimonialPropsSchema = z.object({
  quote: z.string().min(1),
  authorName: z.string().min(1),
  authorRole: z.string().optional(),
});

export type TestimonialProps = z.infer<typeof testimonialPropsSchema>;

export const testimonialDefaultProps: TestimonialProps = {
  quote: 'Lunara made laundry day disappear. Highly recommend!',
  authorName: 'Happy customer',
};
