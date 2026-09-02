import { z } from 'zod';

export const stepperProgressPropsSchema = z.object({
  steps: z.array(z.string().min(1)),
  currentStep: z.number(),
  variant: z.enum(['booking', 'onboarding', 'signup']).optional(),
});

export type StepperProgressProps = z.infer<typeof stepperProgressPropsSchema>;

export const stepperProgressDefaultProps: StepperProgressProps = {
  variant: 'booking',
  currentStep: 1,
  steps: ['Service', 'Weight', 'Address', 'Schedule', 'Review'],
};
