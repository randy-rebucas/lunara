import type { ApiError, ApiResponse } from '@lunara/types';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
}

export function createApiClient({ baseUrl, getAccessToken, onUnauthorized }: ApiClientOptions) {
  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = getAccessToken?.();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

    if (!res.ok || !body.success) {
      const err = body as ApiError;
      throw new Error(err.error?.message ?? 'Request failed');
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
  };
}
