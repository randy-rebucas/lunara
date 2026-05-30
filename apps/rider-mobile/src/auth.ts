import { useAuthStore } from './store/auth';

export async function riderLogin(email: string, password: string) {
  return useAuthStore.getState().login(email, password);
}

export async function riderLogout() {
  return useAuthStore.getState().logout();
}
