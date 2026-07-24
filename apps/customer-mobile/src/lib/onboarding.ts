import type { Router } from 'expo-router';

export interface OnboardingStatus {
  needsProfile: boolean;
  needsAddress: boolean;
  isComplete: boolean;
}

export function getOnboardingPath(
  status: Pick<OnboardingStatus, 'needsProfile' | 'needsAddress'>,
): '/onboarding/profile' | '/onboarding/address' | '/(tabs)' {
  if (status.needsProfile) return '/onboarding/profile';
  if (status.needsAddress) return '/onboarding/address';
  return '/(tabs)';
}

export async function fetchOnboardingStatus(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
): Promise<OnboardingStatus> {
  return apiFetch<OnboardingStatus>('/customers/me/onboarding');
}

/** Never throws — a failed onboarding-status check must not surface as a login/signup failure
 * (the auth call it follows already succeeded and persisted tokens by this point) or as an
 * unhandled rejection from the app-start redirect in `_layout.tsx`. Falls back to the tabs root,
 * where deeper checks can still catch an incomplete profile/address on the next screen. */
export async function redirectAfterAuth(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
  router: Pick<Router, 'replace'>,
) {
  try {
    const status = await fetchOnboardingStatus(apiFetch);
    router.replace(getOnboardingPath(status));
  } catch {
    router.replace('/(tabs)');
  }
}
