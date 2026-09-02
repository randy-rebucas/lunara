import { z } from 'zod';

export const formFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'toggle', 'rating', 'otp']),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export const formCardPropsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(formFieldSchema),
  submitLabel: z.string().min(1),
});

export type FormCardProps = z.infer<typeof formCardPropsSchema>;

export const formCardDefaultProps: FormCardProps = {
  title: 'Your details',
  description: 'Tell us a bit about you',
  submitLabel: 'Continue',
  fields: [
    { id: 'fullName', label: 'Full name', type: 'text', placeholder: 'Juan Dela Cruz', required: true },
    { id: 'phone', label: 'Mobile number', type: 'phone', placeholder: '09XX XXX XXXX', required: true },
    { id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
  ],
};
