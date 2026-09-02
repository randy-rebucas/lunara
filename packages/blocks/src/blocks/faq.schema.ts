import { z } from 'zod';

export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const faqPropsSchema = z.object({
  title: z.string().optional(),
  items: z.array(faqItemSchema).default([]),
});

export type FaqProps = z.infer<typeof faqPropsSchema>;

export const faqDefaultProps: FaqProps = {
  title: 'FAQs',
  items: [],
};
