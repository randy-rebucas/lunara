import Constants from 'expo-constants';
import { getApiV1BaseUrl } from '../api-config';
import { parseApiError } from './api-error';
import { apiUnreachableMessage } from './network-error';

/** Baked in at build time per partner-brands/<slug>/manifest.json — null for the default Lunara app. */
export function getPartnerId(): string | null {
  return (Constants.expoConfig?.extra?.partnerId as string | null) ?? null;
}

type RequestBody = { kind: 'json'; init?: RequestInit } | { kind: 'form'; formData: FormData };

/** On a 401 with a refresh function available, try refreshing once and retrying the original
 * request before giving up — mirrors customer-web's AuthProvider, which transparently refreshes
 * instead of forcing a re-login every time the (7-day) access token expires despite a still-valid
 * 30-day refresh token sitting unused.
 *
 * Handles both plain-JSON requests (`{ kind: 'json' }`) and multipart uploads (`{ kind: 'form' }`)
 * — the two previously lived as near-duplicate `authRequest`/`authUpload` functions differing only
 * in how the request body/headers were built. */
export async function authRequest<T>(
  path: string,
  body: RequestBody,
  token?: string | null,
  onUnauthorized?: () => void,
  refreshAndGetToken?: () => Promise<string | null>,
): Promise<T> {
  const baseUrl = getApiV1BaseUrl();
  const partnerId = getPartnerId();

  const doFetch = async (accessToken?: string | null) => {
    try {
      if (body.kind === 'form') {
        return await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(partnerId ? { 'x-lunara-partner-id': partnerId } : {}),
          },
          body: body.formData,
        });
      }
      return await fetch(`${baseUrl}${path}`, {
        ...body.init,
        headers: {
          'Content-Type': 'application/json',
          'x-lunara-client': 'mobile',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(partnerId ? { 'x-lunara-partner-id': partnerId } : {}),
          ...(body.init?.headers ?? {}),
        },
      });
    } catch {
      throw new Error(apiUnreachableMessage(baseUrl));
    }
  };

  let res = await doFetch(token);
  if (res.status === 401 && token && refreshAndGetToken) {
    const refreshed = await refreshAndGetToken().catch(() => null);
    if (refreshed) {
      res = await doFetch(refreshed);
    }
  }
  const responseBody = await res.json();
  if (res.status === 401 && token) {
    onUnauthorized?.();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok || responseBody.success === false) {
    throw new Error(parseApiError(responseBody));
  }
  return responseBody.data as T;
}
