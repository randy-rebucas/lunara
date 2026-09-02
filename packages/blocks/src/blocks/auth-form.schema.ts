import { z } from 'zod';

export const authFormPropsSchema = z.object({
  mode: z.enum(['login', 'signup']),
  tabs: z.array(z.enum(['otp', 'email'])).optional(),
  showCountryPicker: z.boolean().optional(),
  termsText: z.string().optional(),
  showTrustBadges: z.boolean().optional(),
});

export type AuthFormProps = z.infer<typeof authFormPropsSchema>;

export const authFormDefaultProps: AuthFormProps = {
  mode: 'login',
  tabs: ['otp', 'email'],
  showCountryPicker: true,
  termsText: 'By continuing you agree to our Terms and Privacy Policy',
  showTrustBadges: true,
};
