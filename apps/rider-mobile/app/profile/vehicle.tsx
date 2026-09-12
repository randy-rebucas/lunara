import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRiderOperations } from '../../src/context/rider-operations';
import { Input } from '../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { Screen } from '../../src/components/ui/screen';
import { DataLoadState } from '../../src/components/data-load-state';
import {
  Field,
  FormErrorBanner,
  SaveButton,
  Section,
  profileFormStyles as styles,
} from '../../src/components/profile-form';
import { riderFetch } from '../../src/api';
import { VEHICLE_TYPES, type RiderMe, type VehicleType } from '../../src/lib/rider-types';
import { colors, radius, spacing } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Vehicle chip ──────────────────────────────────────────────────────────────

const VEHICLE_ICONS: Record<string, IoniconName> = {
  motorcycle: 'flash-outline',
  bicycle: 'bicycle',
  car: 'car-outline',
  van: 'bus-outline',
};

function VehicleChip({
  type,
  active,
  onPress,
}: {
  type: string;
  active: boolean;
  onPress: () => void;
}) {
  const icon = VEHICLE_ICONS[type] ?? 'car-outline';
  return (
    <Pressable
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
    >
      <Ionicons name={icon} size={16} color={active ? colors.primary : colors.mutedForeground} />
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'capitalize',
  },
  textActive: { color: colors.primary },
});

// ── Vehicle information screen ──────────────────────────────────────────────────

export default function VehicleScreen() {
  const router = useRouter();
  const { refresh } = useRiderOperations();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [orCrNumber, setOrCrNumber] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await riderFetch<RiderMe>('/riders/me');
      setVehicleType((data.vehicleType as VehicleType) ?? 'motorcycle');
      setPlateNumber(data.plateNumber ?? '');
      setOrCrNumber(data.orCrNumber ?? '');
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicle info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveVehicle() {
    setError('');
    setSaving(true);
    try {
      await riderFetch('/riders/me', {
        method: 'PATCH',
        body: JSON.stringify({
          vehicleType,
          plateNumber: plateNumber.trim() || undefined,
          orCrNumber: orCrNumber.trim() || undefined,
        }),
      });
      refresh();
      Alert.alert('Vehicle info saved', 'Your vehicle information has been updated.');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save vehicle info');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading error="" loadingMessage="Loading vehicle info…" />
      </Screen>
    );
  }

  if (error && !loaded) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen inStack scroll={false}>
      <KeyboardSafeScrollView contentContainerStyle={styles.content}>
        <Section icon="car-outline" title="Vehicle Information">
          <Field label="VEHICLE TYPE">
            <View style={localStyles.vehicleRow}>
              {VEHICLE_TYPES.map((type) => (
                <VehicleChip
                  key={type}
                  type={type}
                  active={vehicleType === type}
                  onPress={() => setVehicleType(type)}
                />
              ))}
            </View>
          </Field>
          <Field label="PLATE NUMBER">
            <Input
              placeholder="ABC 1234"
              value={plateNumber}
              onChangeText={setPlateNumber}
              autoCapitalize="characters"
            />
          </Field>
          <Field label="OR/CR NUMBER">
            <Input
              placeholder="OR/CR number"
              value={orCrNumber}
              onChangeText={setOrCrNumber}
              autoCapitalize="characters"
            />
          </Field>
        </Section>

        <FormErrorBanner message={error} />
        <SaveButton saving={saving} onPress={saveVehicle} />
      </KeyboardSafeScrollView>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  vehicleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
