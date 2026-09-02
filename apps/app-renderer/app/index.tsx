import { Redirect } from 'expo-router';
import { useAppConfig } from '../src/config/config-context';

export default function Index() {
  const config = useAppConfig();
  const homeScreen = config?.screens.find((s) => s.key === 'home') ?? config?.screens[0];
  if (!homeScreen) return null;
  return <Redirect href={`/${homeScreen.key}`} />;
}
