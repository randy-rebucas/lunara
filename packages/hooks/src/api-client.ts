import type { ApiError, ApiResponse } from '@lunara/types';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
  /** Retry once after refreshing tokens when the API returns 401. */
  refreshSession?: () => Promise<void>;
  /** Resolves the white-labeled partner's tenant id, if this app is running under a partner brand. */
  getTenantId?: () => string | null;
}

export function createApiClient({
  baseUrl,
  getAccessToken,
  onUnauthorized,
  refreshSession,
  getTenantId,
}: ApiClientOptions) {
  async function request<T>(
    path: string,
    init: RequestInit = {},
    allowRefresh = true,
  ): Promise<ApiResponse<T>> {
    const token = getAccessToken?.();
    const tenantId = getTenantId?.();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'x-lunara-partner-id': tenantId } : {}),
    };

    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error(
          `Cannot reach the API at ${baseUrl}. Make sure it is running (npm run dev --workspace=@lunara/api) and that NEXT_PUBLIC_API_URL is correct.`,
        );
      }
      throw e;
    }

    if (res.status === 401 && allowRefresh && refreshSession) {
      try {
        await refreshSession();
        return request<T>(path, init, false);
      } catch {
        onUnauthorized?.();
        throw new Error('Session expired. Please sign in again.');
      }
    }

    let body: ApiResponse<T> | ApiError;
    try {
      body = (await res.json()) as ApiResponse<T> | ApiError;
    } catch {
      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(
        res.ok
          ? 'Invalid response from API'
          : `API error (${res.status}). Check that NEXT_PUBLIC_API_URL includes /api/v1 or points to port 3001.`,
      );
    }

    if (res.status === 401) {
      onUnauthorized?.();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!res.ok || !('success' in body) || body.success === false) {
      const err = body as ApiError & { message?: string | string[] };
      const nestMessage = Array.isArray(err.message)
        ? err.message[0]
        : typeof err.message === 'string'
          ? err.message
          : undefined;
      throw new Error(err.error?.message ?? nestMessage ?? 'Request failed');
    }

    return body as ApiResponse<T>;
  }

  async function upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const token = getAccessToken?.();
    const tenantId = getTenantId?.();
    const headers: HeadersInit = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'x-lunara-partner-id': tenantId } : {}),
    };

    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: formData });
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error(
          `Cannot reach the API at ${baseUrl}. Make sure it is running (npm run dev --workspace=@lunara/api) and that NEXT_PUBLIC_API_URL is correct.`,
        );
      }
      throw e;
    }

    let body: ApiResponse<T> | ApiError;
    try {
      body = (await res.json()) as ApiResponse<T> | ApiError;
    } catch {
      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(`API error (${res.status}). Upload failed.`);
    }

    if (res.status === 401) {
      onUnauthorized?.();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!res.ok || !('success' in body) || body.success === false) {
      const err = body as ApiError;
      throw new Error(err.error?.message ?? 'Upload failed');
    }

    return body as ApiResponse<T>;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, data: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
    patch: <T>(path: string, data: unknown) =>
      request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
  };
}
