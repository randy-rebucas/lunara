import { useAuthStore } from './store/auth';

export async function riderLogin(email: string, password: string) {
  return useAuthStore.getState().login(email, password);
}

export async function riderLoginWithOtp(phone: string, otp: string) {
  return useAuthStore.getState().loginWithOtp(phone, otp);
}

export async function riderRequestOtp(phone: string) {
  return useAuthStore.getState().requestOtp(phone);
}

export async function riderForgotPassword(email: string) {
  return useAuthStore.getState().forgotPassword(email);
}

export async function riderResetPassword(phone: string, otp: string, password: string) {
  return useAuthStore.getState().resetPassword(phone, otp, password);
}

export async function riderLogout() {
  return useAuthStore.getState().logout();
}
