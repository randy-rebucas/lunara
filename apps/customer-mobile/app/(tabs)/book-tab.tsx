import { Redirect } from 'expo-router';

/** Never actually rendered — the tab bar intercepts presses and pushes the real /book flow instead. */
export default function BookTabPlaceholder() {
  return <Redirect href="/book" />;
}
