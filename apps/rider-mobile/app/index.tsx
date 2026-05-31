import { Redirect, type Href } from 'expo-router';
import { useAuthStore } from '../src/store/auth';

export default function Index() {
  const tokens = useAuthStore((s) => s.tokens);

  if (tokens?.accessToken) {
    return <Redirect href={'/(tabs)' as Href} />;
  }

  return <Redirect href="/login" />;
}
