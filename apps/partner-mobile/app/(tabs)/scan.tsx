import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/ui/button';
import { QrScanner } from '../../src/components/qr-scanner';
import { Screen } from '../../src/components/ui/screen';
import { partnerFetch } from '../../src/api';
import { colors, spacing, typography } from '../../src/theme';

/** Mirrors apps/partner-web/src/app/scan/page.tsx — GET /laundry-tags/lookup?code=... */
interface TagLookupResult {
  tag: { code: string; status: string };
  order: { id: string; shortCode: string; status: string; branchId?: string } | null;
  customer: { firstName: string; lastName: string; phone?: string } | null;
}

export default function ScanScreen() {
  const [active, setActive] = useState(false);

  async function handleScan(payload: string) {
    const res = await partnerFetch<TagLookupResult>(
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
    setActive(false);
  }

  if (active) {
    return (
      <QrScanner
        title="Scan tag"
        hint="Point the camera at a laundry tag's QR code to see which order and customer it belongs to."
        onScan={handleScan}
        onCancel={() => setActive(false)}
      />
    );
  }

  return (
    <Screen inTab centered>
      <View style={styles.wrap}>
        <Text style={styles.title}>Scan laundry tag</Text>
        <Text style={styles.hint}>
          Point the camera at a laundry tag&apos;s QR code to look up which order and customer
          it belongs to.
        </Text>
        <Button label="Open scanner" onPress={() => setActive(true)} style={styles.action} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.xl },
  title: { ...typography.heading, textAlign: 'center' },
  hint: { ...typography.body, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
  action: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
