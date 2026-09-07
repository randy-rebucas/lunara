import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui/button';
import { colors, radius, spacing, typography } from '../theme';

interface QrScannerProps {
  title: string;
  hint?: string;
  onScan: (payload: string) => void | Promise<void>;
  onCancel?: () => void;
}

export function QrScanner({ title, hint, onScan, onCancel }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scannedRef = useRef(false);

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scannedRef.current || busy) return;
      const payload = result.data?.trim();
      if (!payload) return;

      scannedRef.current = true;
      setBusy(true);
      setError('');
      try {
        await onScan(payload);
      } catch (e) {
        scannedRef.current = false;
        setError(e instanceof Error ? e.message : 'Scan failed');
      } finally {
        setBusy(false);
      }
    },
    [busy, onScan],
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>Camera access is required to scan QR codes.</Text>
        <Button label="Allow camera" onPress={() => requestPermission()} style={styles.action} />
        {onCancel ? (
          <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.action} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : handleScan}
      />
      <View style={styles.overlay}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <View style={styles.frame} />
        {busy ? <ActivityIndicator color={colors.onPrimary} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {onCancel ? (
          <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.cancel} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    ...typography.subheading,
    color: colors.onPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.bodySm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  spinner: { marginTop: spacing.lg },
  error: {
    marginTop: spacing.md,
    color: colors.warning,
    textAlign: 'center',
    fontWeight: '600',
  },
  action: { marginTop: spacing.lg },
  cancel: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
