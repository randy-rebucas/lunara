import * as Location from 'expo-location';

/** Best-effort location capture for clock in/out — never blocks or fails the action itself.
 * Requests permission (once; subsequent calls reuse the prior grant/denial) and gives up after
 * 3s so a slow GPS fix never stalls the button. */
export async function getBestEffortLocation(): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;

    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!loc) return undefined;

    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return undefined;
  }
}
