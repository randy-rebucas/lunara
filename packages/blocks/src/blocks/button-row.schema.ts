import { z } from 'zod';

export const buttonRowButtonSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  action: z.string().min(1),
});

export const buttonRowPropsSchema = z.object({
  buttons: z.array(buttonRowButtonSchema).default([]),
});

export type ButtonRowProps = z.infer<typeof buttonRowPropsSchema>;

export const buttonRowDefaultProps: ButtonRowProps = {
  buttons: [{ id: 'primary', label: 'Book now', action: 'booking:new' }],
};
