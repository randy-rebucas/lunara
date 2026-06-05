import { UserRole } from '@lunara/types';
import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(10).max(15).optional(),
    password: z.string().min(8).optional(),
    otp: z.string().length(6).optional(),
  })
  .refine((data: any) => data.email || data.phone, {
    message: 'Email or phone is required',
  });

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).max(15).optional(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
});

export const otpRequestSchema = z.object({
  phone: z.string().min(10).max(15),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
