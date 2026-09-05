import { resolveApiV1BaseUrl } from '@lunara/utils';
import { parseApiError } from './api-error';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

export interface PartnerSignupPayload {
  ownerFullName: string;
  businessName: string;
  address: {
    line1: string;
    city: string;
    province: string;
    postalCode?: string;
    coordinates?: [number, number];
  };
  wantsBranding: boolean;
  email: string;
  phone: string;
  recaptchaToken?: string;
}

/** Public, unauthenticated self-serve partner signup — no token exists yet, so this bypasses
 * partnerFetch's cookie/bearer auth entirely. */
export async function signupPartner(
  payload: PartnerSignupPayload,
  logo?: File,
): Promise<{ email: string }> {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  if (logo) formData.append('logo', logo);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/partner-onboarding/signup`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error(`Cannot reach API at ${API_URL}. Please try again.`);
  }

  const body = await res.json();
  if (!body.success) throw new Error(parseApiError(body, 'Signup failed'));
  return body.data as { email: string };
}
