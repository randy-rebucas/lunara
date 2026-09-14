import { UserRole } from '@lunara/types';

export interface GoogleIdTokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
}

export interface GoogleLoginCandidate {
  role: UserRole;
  isActive: boolean;
}

export type GoogleLoginDecision =
  | { outcome: 'invalid-payload' }
  | { outcome: 'unverified-email' }
  | { outcome: 'non-customer-account' }
  | { outcome: 'deactivated-account' }
  | { outcome: 'proceed' };

/** Pure decision logic behind AuthService.loginWithGoogle's account gating — kept separate from
 * the Mongoose-backed service so the customer-only role invariant can be unit tested without
 * booting the ODM. `existingUser` is whichever account was matched by googleId or, failing that,
 * by email (undefined for a brand-new sign-up). */
export function decideGoogleLogin(
  payload: GoogleIdTokenPayload | undefined,
  existingUser: GoogleLoginCandidate | undefined,
): GoogleLoginDecision {
  if (!payload?.sub || !payload.email) return { outcome: 'invalid-payload' };
  if (!payload.email_verified) return { outcome: 'unverified-email' };
  if (existingUser) {
    if (existingUser.role !== UserRole.CUSTOMER) return { outcome: 'non-customer-account' };
    if (!existingUser.isActive) return { outcome: 'deactivated-account' };
  }
  return { outcome: 'proceed' };
}
