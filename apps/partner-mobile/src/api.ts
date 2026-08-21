import { getApiV1BaseUrl } from './api-config';
import { parseApiError } from './lib/api-error';
import { useAuthStore } from './store/auth';

/** Authenticated fetch against the API, bearer-token auth via the partner auth store. */
export async function partnerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return useAuthStore.getState().apiFetch<T>(path, init);
}

/** Authenticated multipart upload — omits the JSON content-type so fetch sets the form boundary. */
export async function partnerUpload<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  const { tokens, logout } = useAuthStore.getState();
  if (!tokens?.accessToken) {
    throw new Error('Please sign in to continue.');
  }
  const baseUrl = getApiV1BaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      body: formData,
    });
  } catch {
    throw new Error(`Cannot reach API at ${baseUrl}.`);
  }
  const body = await res.json();
  if (res.status === 401) {
    void logout();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok || body.success === false) {
    throw new Error(parseApiError(body));
  }
  return body.data as T;
}
