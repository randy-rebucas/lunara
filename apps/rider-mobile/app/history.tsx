import { Redirect } from 'expo-router';

export default function HistoryScreen() {
  return <Redirect href="/(tabs)/tasks?filter=completed" />;
}
