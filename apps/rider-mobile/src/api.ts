import { useAuthStore } from './store/auth';

export async function riderFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return useAuthStore.getState().apiFetch<T>(path, init);
}
