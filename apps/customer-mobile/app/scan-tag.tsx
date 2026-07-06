import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { QrScanner } from '../src/components/qr-scanner';
import { useAuthStore } from '../src/store/auth';

interface TagLookupResult {
  tag: { code: string; status: string };
  order: { id: string; shortCode: string; status: string } | null;
  customer: { firstName: string; lastName: string; phone?: string } | null;
}

export default function ScanTagScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);

  async function handleScan(payload: string) {
    const res = await apiFetch<TagLookupResult>(`/laundry-tags/lookup?code=${encodeURIComponent(payload)}`);
    if (!res.order) {
      Alert.alert('Not your laundry', "This tag isn't linked to one of your orders.");
      return;
    }
    Alert.alert(
      `Tag ${res.tag.code}`,
      `Order ${res.order.shortCode} · ${res.order.status.replace(/_/g, ' ')}`,
    );
    router.back();
  }

  return (
    <QrScanner
      title="Scan Laundry Tag"
      hint="Point your camera at the QR code on your laundry tag."
      onScan={handleScan}
      onCancel={() => router.back()}
    />
  );
}
