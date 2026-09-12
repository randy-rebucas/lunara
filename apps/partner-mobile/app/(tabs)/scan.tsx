import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { ActionCard } from '../../src/components/ui/action-card';
import { Input } from '../../src/components/ui/input';
import { StatusPill } from '../../src/components/ui/status-pill';
import { EmptyState } from '../../src/components/ui/empty-state';
import { QrScanner } from '../../src/components/qr-scanner';
import { Screen } from '../../src/components/ui/screen';
import { partnerFetch } from '../../src/api';
import { NetworkUnreachableError } from '../../src/lib/network-error';
import { colors, radius, spacing, typography } from '../../src/theme';
import { loadScanHistory, recordScan, type ScanHistoryEntry } from '../../src/lib/scan-history';
import type { LaundryTagLookupResult } from '@lunara/types';

export default function ScanScreen() {
  const navigation = useNavigation();
  const [active, setActive] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [looking, setLooking] = useState(false);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: !active });
  }, [navigation, active]);

  useEffect(() => {
    loadScanHistory().then(setHistory);
  }, []);

  const lookup = useCallback(async (payload: string) => {
    const res = await partnerFetch<LaundryTagLookupResult>(
      `/laundry-tags/lookup?code=${encodeURIComponent(payload)}`,
    );
    const found = !!(res.order && res.customer);
    if (!found) {
      Alert.alert('Tag not attached', `Tag ${res.tag.code} isn't currently attached to any order.`);
    } else {
      Alert.alert(
        `Tag ${res.tag.code}`,
        `Order ${res.order!.shortCode} · ${res.order!.status}\nCustomer: ${res.customer!.firstName} ${res.customer!.lastName}${res.customer!.phone ? `\nPhone: ${res.customer!.phone}` : ''}`,
      );
    }
    const next = await recordScan({
      code: res.tag.code,
      scannedAt: new Date().toISOString(),
      found,
      customerName: found ? `${res.customer!.firstName} ${res.customer!.lastName}` : undefined,
      orderShortCode: found ? res.order!.shortCode : undefined,
    });
    setHistory(next);
  }, []);

  async function handleScan(payload: string) {
    await lookup(payload);
    setActive(false);
  }

  async function handleManualSubmit() {
    const code = manualCode.trim();
    if (!code) return;
    setLooking(true);
    try {
      await lookup(code);
      setManualCode('');
      setManualEntry(false);
    } catch (e) {
      if (e instanceof NetworkUnreachableError) {
        Alert.alert('No connection', e.message);
      } else {
        Alert.alert('Lookup failed', e instanceof Error ? e.message : 'Could not look up that code.');
      }
    } finally {
      setLooking(false);
    }
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
    <Screen inTab scroll>
      <View style={styles.scanCard}>
        <Image
          source={require('../../assets/scan-frame-icon.png')}
          style={styles.frameIcon}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text style={styles.title}>Scan laundry tag</Text>
        <Text style={styles.hint}>
          Point the camera at a laundry tag&apos;s QR code to look up which order and customer
          it belongs to.
        </Text>
        <Button label="Open scanner" icon="scan-outline" onPress={() => setActive(true)} style={styles.action} />
      </View>

      <ActionCard
        icon="search-outline"
        title="Manual lookup"
        hint="Search by order # or tag code"
        onPress={() => setManualEntry((v) => !v)}
        style={styles.actionCard}
      />

      {manualEntry ? (
        <Card style={styles.manualCard}>
          <Input
            placeholder="Order # or tag code"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoFocus
          />
          <Button
            label={looking ? 'Looking up…' : 'Look up'}
            onPress={handleManualSubmit}
            disabled={looking || !manualCode.trim()}
            style={styles.manualAction}
          />
        </Card>
      ) : null}

      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Recent scans</Text>
      </View>

      {history.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No scans yet"
          message="Scanned or looked-up tags will show up here."
        />
      ) : (
        history.map((entry) => (
          <Card
            key={`${entry.code}-${entry.scannedAt}`}
            style={styles.historyRow}
            accessible
            accessibilityLabel={`${entry.code}, ${entry.customerName ?? 'Unknown customer'}, ${
              entry.found ? 'Found' : 'Not found'
            }, ${formatTime(entry.scannedAt)}`}
          >
            <View style={styles.historyIcon}>
              <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.historyInfo}>
              <Text style={styles.historyCode}>{entry.code}</Text>
              <Text style={styles.historyMeta}>
                {entry.customerName ?? 'Unknown customer'} · {formatTime(entry.scannedAt)}
              </Text>
            </View>
            <StatusPill label={entry.found ? 'Found' : 'Not found'} kind={entry.found ? 'accent' : 'warning'} />
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={styles.historyChevron} />
          </Card>
        ))
      )}
    </Screen>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return isToday ? `Today, ${time}` : `${d.toLocaleDateString()}, ${time}`;
}

const styles = StyleSheet.create({
  scanCard: { alignItems: 'center', paddingVertical: spacing.xxl, marginTop: spacing.md },
  frameIcon: {
    width: 160,
    height: 130,
    marginBottom: spacing.md,
  },
  title: { ...typography.heading, textAlign: 'center' },
  hint: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  action: { marginTop: spacing.xl, alignSelf: 'stretch' },
  actionCard: { marginTop: spacing.lg },
  manualCard: { marginTop: spacing.lg, gap: spacing.md },
  manualAction: { alignSelf: 'stretch' },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  historyTitle: { ...typography.subheading, fontSize: 16 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historyCode: { ...typography.body, fontWeight: '600' },
  historyMeta: { ...typography.caption, marginTop: 2 },
  historyChevron: { marginLeft: spacing.xs },
});
