import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { formatCurrency, HANDOFF_QR_LABELS, type HandoffQrKind } from '@lunara/utils';
import { QrScanner } from '../src/components/qr-scanner';
import { riderFetch } from '../src/api';

const SCAN_MODES = [
  'customer_pickup',
  'order_handover',
  'customer_delivery',
  'assign_laundry_tag',
  'lookup_tag',
] as const;
type ScanMode = (typeof SCAN_MODES)[number];

function isScanMode(value: string | undefined): value is ScanMode {
  return SCAN_MODES.includes(value as ScanMode);
}

interface TagLookupResult {
  tag: { code: string; status: string };
  order: { id: string; shortCode: string; status: string; branchId?: string } | null;
  customer: { firstName: string; lastName: string; phone?: string } | null;
}

export default function ScanScreen() {
  const router = useRouter();
  const { orderId, mode } = useLocalSearchParams<{ orderId: string; mode: string }>();

  if (!isScanMode(mode) || (!orderId && mode !== 'lookup_tag')) {
    return (
      <QrScanner
        title="Invalid scan"
        hint="Open scan from a pickup or delivery task."
        onScan={async () => {
          throw new Error('Missing order or scan mode');
        }}
        onCancel={() => router.back()}
      />
    );
  }

  const title = mode === 'assign_laundry_tag'
    ? 'Scan Laundry Tag'
    : mode === 'lookup_tag'
      ? 'Scan Tag to Look Up'
      : HANDOFF_QR_LABELS[mode as HandoffQrKind];
  const hints: Record<ScanMode, string> = {
    customer_pickup: 'Ask the customer to open their Lunara app and show their pickup QR.',
    order_handover: 'Scan the order QR displayed at the partner shop.',
    customer_delivery: 'Ask the customer to show their delivery QR in the Lunara app.',
    assign_laundry_tag: 'Scan an available laundry tag to attach it to this bag.',
    lookup_tag: 'Scan any laundry tag to see which order it belongs to.',
  };

  async function handleScan(payload: string) {
    if (mode === 'lookup_tag') {
      const res = await riderFetch<TagLookupResult>(
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
      router.back();
      return;
    }

    if (mode === 'assign_laundry_tag') {
      const res = await riderFetch<{ tagCode?: string }>(`/riders/pickup-tasks/${orderId}/assign-tag`, {
        method: 'POST',
        body: JSON.stringify({ scannedValue: payload }),
      });
      Alert.alert('Tag assigned', res.tagCode ? `Tag ${res.tagCode} attached to this order.` : 'Tag attached to this order.');
      router.back();
      return;
    }

    if (mode === 'customer_pickup') {
      await riderFetch(`/riders/pickup-tasks/${orderId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ qrPayload: payload }),
      });
      Alert.alert('Verified', 'Customer identity confirmed.');
      router.back();
      return;
    }

    if (mode === 'order_handover') {
      const res = await riderFetch<{
        earnings?: { amount: number; todayEarnings: number };
      }>(`/riders/pickup-tasks/${orderId}/drop-at-shop`, {
        method: 'POST',
        body: JSON.stringify({ qrPayload: payload }),
      });
      const earn = res.earnings;
      Alert.alert(
        'Delivered to shop',
        earn
          ? `Handover confirmed · +${formatCurrency(earn.amount)} (today ${formatCurrency(earn.todayEarnings)})`
          : 'Handover confirmed',
      );
      router.back();
      return;
    }

    await riderFetch(`/riders/delivery-tasks/${orderId}/verify-customer-qr`, {
      method: 'POST',
      body: JSON.stringify({ qrPayload: payload }),
    });
    Alert.alert('Verified', 'Customer handoff confirmed.');
    router.back();
  }

  return (
    <QrScanner
      title={title}
      hint={hints[mode]}
      onScan={handleScan}
      onCancel={() => router.back()}
    />
  );
}
