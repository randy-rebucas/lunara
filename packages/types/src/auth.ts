import type { UserRole } from './enums.js';

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role: UserRole;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email?: string;
  phone?: string;
  password?: string;
  otp?: string;
}

export interface RegisterRequest {
  email?: string;
  phone?: string;
  password?: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}
