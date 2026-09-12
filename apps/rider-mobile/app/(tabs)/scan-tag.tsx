import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { LaundryTagLookupResult } from '@lunara/types';
import { QrScanner } from '../../src/components/qr-scanner';
import { riderFetch } from '../../src/api';

/** General-purpose "what order is this tag on" lookup — always available from the tab bar,
 * unlike the task-scoped scans (customer verification, tag assignment, handover) in app/scan.tsx
 * which only make sense from inside an active pickup/delivery task. Filed as scan-tag.tsx (not
 * scan.tsx) — expo-router strips the (tabs) group segment, so app/(tabs)/scan.tsx would collide
 * with the existing app/scan.tsx route. */
export default function ScanTagTab() {
  const [scanKey, setScanKey] = useState(0);

  const handleScan = useCallback(async (payload: string) => {
    // Left uncaught on purpose — QrScanner catches lookup failures itself and shows its own
    // error banner while leaving the camera live for a retry.
    const res = await riderFetch<LaundryTagLookupResult>(
      `/laundry-tags/lookup?code=${encodeURIComponent(payload)}`,
    );
    if (!res.order || !res.customer) {
      Alert.alert('Tag not attached', `Tag ${res.tag.code} isn't currently attached to any order.`);
    } else {
      Alert.alert(
        `Tag ${res.tag.code}`,
        `Order ${res.order.shortCode} · ${res.order.status}\nCustomer: ${res.customer.firstName} ${res.customer.lastName}${res.customer.phone ? `\nPhone: ${res.customer.phone}` : ''}`,
      );
    }
    // Remounts the scanner so it's ready to scan again — this is a standalone tab, not a
    // one-shot modal, so there's no "back" to return to after a successful lookup.
    setScanKey((k) => k + 1);
  }, []);

  return (
    <QrScanner
      key={scanKey}
      title="Scan Tag to Look Up"
      hint="Scan any laundry tag to see which order it belongs to."
      onScan={handleScan}
    />
  );
}
