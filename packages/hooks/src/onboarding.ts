export interface OnboardingStatus {
  needsProfile: boolean;
  needsAddress: boolean;
  isComplete: boolean;
}

export function getOnboardingPath(status: Pick<OnboardingStatus, 'needsProfile' | 'needsAddress'>) {
  if (status.needsProfile) return '/onboarding/profile';
  if (status.needsAddress) return '/onboarding/address';
  return '/dashboard';
}

export async function fetchOnboardingStatus(
  api: { get: <T>(path: string) => Promise<{ data: T }> },
): Promise<OnboardingStatus> {
  const res = await api.get<OnboardingStatus>('/customers/me/onboarding');
  return res.data;
}
