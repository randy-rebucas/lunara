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

export async function redirectAfterAuth(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
  router: Pick<Router, 'replace'>,
) {
  const status = await fetchOnboardingStatus(apiFetch);
  router.replace(getOnboardingPath(status));
}
